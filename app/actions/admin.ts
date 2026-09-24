"use server";

import { revalidatePath } from "next/cache";
import { and, count, desc, eq } from "drizzle-orm";
import { getSessionUser } from "@/lib/supabase/server";
import { db } from "@/db";
import { adminActions, appeals, users } from "@/db/schema";
import {
  ProfileError,
  banUser,
  decodeCursor,
  encodeCursor,
  getAdminUsers,
  setUserRole,
  unbanUser,
} from "@/services/users.service";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import {
  roleNotifyHtml,
  roleNotifySubject,
  roleNotifyText,
} from "@/lib/email-templates/role-notify";
import { banNotifyHtml, banNotifySubject, banNotifyText } from "@/lib/email-templates/ban-notify";
import {
  unbanNotifyHtml,
  unbanNotifySubject,
  unbanNotifyText,
} from "@/lib/email-templates/unban-notify";
import { closePendingAppealsForUser } from "@/services/appeals.service";
import { captureError } from "@/lib/monitoring";
import { appOrigin } from "@/app/actions/auth";
import { logAdminAction } from "@/services/admin-audit.service";

export type AdminActionState = { ok: boolean; message: string | null };

/** Rôle staff : admin + modérateur (panel, ban, appels). */
export type StaffRole = "admin" | "moderateur";

/**
 * Garde staff — DB = vérité (le layout/proxy lisent le miroir JWT,
 * les actions relisent le rôle table, cf. docs/auth.md §2-3).
 */
export async function requireStaffId(): Promise<{ id: string; role: StaffRole }> {
  const user = await getSessionUser();
  if (!user) throw new ProfileError("FORBIDDEN", "Connectez-vous.");
  const [row] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  if (!row || (row.role !== "admin" && row.role !== "moderateur")) {
    throw new ProfileError("FORBIDDEN", "Réservé à l'équipe.");
  }
  return { id: user.id, role: row.role };
}

/**
 * Garde admin — gestion des grades uniquement (un modérateur ne nomme
 * personne). Conservée pour compat : privilégier requireStaffId + test
 * de rôle explicite côté service (setUserRole).
 */
export async function requireAdminId(): Promise<string> {
  const { id, role } = await requireStaffId();
  if (role !== "admin") {
    throw new ProfileError("FORBIDDEN", "Gestion des grades : admin uniquement.");
  }
  return id;
}

function mapAdminError(e: unknown, op: string): AdminActionState {
  if (e instanceof ProfileError) return { ok: false, message: e.message };
  captureError(e, { op });
  return { ok: false, message: "Action impossible pour le moment." };
}

/**
 * Bannir (motif requis, réversible). Auto-ban interdit — on ne scie
 * jamais la branche sur laquelle on est assis. Staff (admin+modo).
 */
export async function banUserAction(input: {
  userId: string;
  reason: string;
}): Promise<AdminActionState> {
  try {
    const { id } = await requireStaffId();
    if (input.userId === id) {
      return { ok: false, message: "Vous ne pouvez pas vous bannir vous-même." };
    }
    const { email, displayName, reason, timeZone } = await banUser(
      true,
      input.userId,
      input.reason,
    );
    await logAdminAction({
      actorId: id,
      targetId: input.userId,
      action: "ban",
      note: reason,
    });
    try {
      const origin = await appOrigin();
      await sendEmail({
        to: email,
        subject: banNotifySubject(),
        html: banNotifyHtml({
          displayName,
          banReason: reason,
          dashboardUrl: `${origin}/dashboard`,
          origin,
          timeZone,
        }),
        text: banNotifyText({
          displayName,
          banReason: reason,
          dashboardUrl: `${origin}/dashboard`,
          origin,
          timeZone,
        }),
      });
    } catch (e) {
      captureError(e, { op: "admin.banEmail" });
    }
    revalidatePath("/admin/users");
    return { ok: true, message: "Utilisateur banni." };
  } catch (e) {
    return mapAdminError(e, "admin.ban");
  }
}

/** Débannir — notifié (unban-notify) + appels clos, jamais muet. */
export async function unbanUserAction(input: { userId: string }): Promise<AdminActionState> {
  try {
    const { id } = await requireStaffId();
    const { email, displayName, timeZone } = await unbanUser(true, input.userId);
    await logAdminAction({
      actorId: id,
      targetId: input.userId,
      action: "unban",
    });
    const closed = await closePendingAppealsForUser(input.userId).catch(() => 0);
    try {
      await sendEmail({
        to: email,
        subject: unbanNotifySubject(),
        html: unbanNotifyHtml({ displayName, origin: await appOrigin(), timeZone }),
        text: unbanNotifyText({ displayName, origin: await appOrigin(), timeZone }),
      });
    } catch (e) {
      captureError(e, { op: "admin.unbanEmail" });
    }
    revalidatePath("/admin/users");
    return {
      ok: true,
      message:
        closed > 0 ? `Utilisateur débanni (${closed} appel(s) clos).` : "Utilisateur débanni.",
    };
  } catch (e) {
    return mapAdminError(e, "admin.unban");
  }
}

export type AdminListItem = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  email: string;
  providers: string[];
  role: "admin" | "moderateur" | "user";
  bannedAt: string | null;
  banReason: string | null;
  appealsCount: number;
  createdAt: string;
};

function serializeListItems(
  items: Awaited<ReturnType<typeof getAdminUsers>>["items"],
): AdminListItem[] {
  return items.map((u) => ({
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    email: u.email,
    providers: u.providers,
    role: u.role,
    bannedAt: u.bannedAt ? u.bannedAt.toISOString() : null,
    banReason: u.banReason,
    appealsCount: u.appealsCount,
    createdAt: u.createdAt.toISOString(),
  }));
}

/**
 * Historique d'un user (expansion paresseuse d'une ligne — jamais dans
 * la liste : pas de N+1). Compteurs par COUNT + 10 derniers événements
 * (acteur, libellé FR, note, date). Acteur supprimé → "ancien admin".
 */
export type UserHistory = {
  bans: number;
  unbans: number;
  appeals: number;
  events: {
    id: string;
    action: string;
    label: string;
    actor: string;
    note: string | null;
    at: string;
  }[];
};

const ACTION_LABELS: Record<string, string> = {
  ban: "Banni",
  unban: "Débanni",
  promote: "Nommé modérateur",
  demote: "Rétrogradé",
  appeal_upheld: "Appel maintenu",
  appeal_overturned: "Appel accepté",
};

export async function getUserHistoryAction(input: {
  userId: string;
}): Promise<{ ok: true; history: UserHistory } | { ok: false; error: string }> {
  try {
    await requireStaffId();
    const [[bans], [unbans], [appealsCount]] = await Promise.all([
      db
        .select({ value: count() })
        .from(adminActions)
        .where(and(eq(adminActions.targetId, input.userId), eq(adminActions.action, "ban"))),
      db
        .select({ value: count() })
        .from(adminActions)
        .where(and(eq(adminActions.targetId, input.userId), eq(adminActions.action, "unban"))),
      db.select({ value: count() }).from(appeals).where(eq(appeals.userId, input.userId)),
    ]);
    const events = await db
      .select({
        id: adminActions.id,
        action: adminActions.action,
        note: adminActions.note,
        createdAt: adminActions.createdAt,
        actorName: users.displayName,
      })
      .from(adminActions)
      .leftJoin(users, eq(adminActions.actorId, users.id))
      .where(eq(adminActions.targetId, input.userId))
      .orderBy(desc(adminActions.createdAt))
      .limit(10);
    return {
      ok: true,
      history: {
        bans: bans.value,
        unbans: unbans.value,
        appeals: appealsCount.value,
        events: events.map((e) => ({
          id: e.id,
          action: e.action,
          label: ACTION_LABELS[e.action] ?? e.action,
          actor: e.actorName ?? "ancien admin",
          note: e.note,
          at: e.createdAt.toISOString(),
        })),
      },
    };
  } catch (e) {
    if (e instanceof ProfileError) return { ok: false, error: e.message };
    captureError(e, { op: "admin.history" });
    return { ok: false, error: "Historique indisponible." };
  }
}
export async function loadMoreUsersAction(input: {
  q?: string;
  status?: "all" | "banned";
  cursor?: string | null;
}): Promise<
  { ok: true; items: AdminListItem[]; nextCursor: string | null } | { ok: false; error: string }
> {
  try {
    await requireStaffId();
    const { items, nextCursor } = await getAdminUsers({
      isStaff: true,
      q: input.q,
      status: input.status,
      cursor: decodeCursor(input.cursor),
      limit: 20,
    });
    return { ok: true, items: serializeListItems(items), nextCursor: encodeCursor(nextCursor) };
  } catch (e) {
    if (e instanceof ProfileError) return { ok: false, error: e.message };
    captureError(e, { op: "admin.listMore" });
    return { ok: false, error: "Chargement impossible." };
  }
}

/**

/**
 * Grades user ↔ modérateur (voie UI normale — le grade admin est
 * inaltérable via UI, SQL founder only, voir setUserRole).
 * Miroir JWT (merge app_metadata, jamais d'écrasement) : effectif au
 * prochain refresh token / login — l'email le dit explicitement.
 * Notification best-effort (jamais bloquante).
 */
export async function setUserRoleAction(input: {
  userId: string;
  role: "moderateur" | "user";
}): Promise<AdminActionState> {
  try {
    const adminId = await requireAdminId();
    const { email, displayName, role, timeZone } = await setUserRole(
      adminId,
      input.userId,
      input.role,
    );
    await logAdminAction({
      actorId: adminId,
      targetId: input.userId,
      action: role === "moderateur" ? "promote" : "demote",
    });

    // Miroir JWT : lu par proxy.ts + layout (zéro requête DB par hit).
    // Merge avec l'existant — un écrasement effacerait d'autres clés.
    try {
      const admin = createAdminClient();
      const { data } = await admin.auth.admin.getUserById(input.userId);
      const current = (data.user?.app_metadata ?? {}) as Record<string, unknown>;
      const { error } = await admin.auth.admin.updateUserById(input.userId, {
        app_metadata: { ...current, role },
      });
      if (error) throw error;
    } catch (e) {
      captureError(e, { op: "admin.roleMirror" });
      return {
        ok: false,
        message: "Rôle table OK, miroir JWT en échec — réessayez.",
      };
    }

    try {
      const promoted = role === "moderateur";
      const origin = await appOrigin();
      await sendEmail({
        to: email,
        subject: roleNotifySubject(promoted),
        html: roleNotifyHtml({ displayName, promoted, origin, timeZone }),
        text: roleNotifyText({ displayName, promoted, origin, timeZone }),
      });
    } catch (e) {
      captureError(e, { op: "admin.roleEmail" });
    }

    revalidatePath("/admin/users");
    return {
      ok: true,
      message: role === "moderateur" ? "Modérateur nommé." : "Rôle retiré.",
    };
  } catch (e) {
    return mapAdminError(e, "admin.role");
  }
}
