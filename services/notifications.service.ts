import { and, desc, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { notifications, type NotificationKind } from "@/db/schema";
import { productBuilds, productPageViews, products } from "@/db/schema";
import { users } from "@/db/schema";
import { captureError } from "@/lib/monitoring";
import { adminRecipients, sendEmail } from "@/lib/email";
import { siteUrl } from "@/lib/site-url";
import {
  staffBuildSubmittedHtml,
  staffBuildSubmittedSubject,
  staffBuildSubmittedText,
  staffFicheSubmittedHtml,
  staffFicheSubmittedSubject,
  staffFicheSubmittedText,
} from "@/lib/email-templates/staff-review";
import {
  digestWeeklyHtml,
  digestWeeklySubject,
  digestWeeklyText,
} from "@/lib/email-templates/digest-weekly";
import {
  LEGAL_DOC_LABEL,
  legalNoticeHtml,
  legalNoticeSubject,
  legalNoticeText,
  type LegalDoc,
} from "@/lib/email-templates/legal-notice";

/**
 * Notifications in-app — jumelles des emails (même point d'émission,
 * canaux indépendants). `notify` ne throw JAMAIS (boolean) : une notif
 * ne bloque jamais l'action métier (fail-soft, Sentry en log).
 * Idempotence milestones : index unique partiel (user, produit, titre)
 * + `onConflictDoNothing` — un seuil franchi = une notif, jamais deux.
 */

export type NotifyInput = {
  userId: string;
  kind: NotificationKind;
  title: string;
  body?: string;
  productId?: string | null;
  actorId?: string | null;
};
export async function notify(input: NotifyInput): Promise<boolean> {
  try {
    await db
      .insert(notifications)
      .values({
        userId: input.userId,
        kind: input.kind,
        title: input.title,
        body: input.body ?? null,
        productId: input.productId ?? null,
        actorId: input.actorId ?? null,
      })
      .onConflictDoNothing();
    return true;
  } catch (e) {
    captureError(e instanceof Error ? e : new Error(String(e)), { op: "notifications.notify" });
    return false;
  }
}

/**
 * Notifie le maker d'un produit (revue, modération) : résout le makerId,
 * jamais de notif si le produit a disparu. Fail-soft comme `notify`.
 */
export async function notifyProductMaker(
  productId: string,
  kind: NotificationKind,
  title: string,
  actorId?: string | null,
): Promise<boolean> {
  try {
    const [row] = await db
      .select({ makerId: products.makerId })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);
    if (!row) return false;
    if (actorId && actorId === row.makerId) return true;
    return notify({ userId: row.makerId, kind, title, productId, actorId: actorId ?? null });
  } catch (e) {
    captureError(e instanceof Error ? e : new Error(String(e)), { op: "notifications.maker" });
    return false;
  }
}

export type NotificationItem = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  productId: string | null;
  /** Logo du produit lié (prioritaire à l'affichage). */
  productIconUrl?: string | null;
  /** Avatar de l'acteur (repli quand pas de produit lié). */
  actorAvatarUrl?: string | null;
  readAt: string | null;
  createdAt: string;
};

/** Liste keyset (createdAt, id) + compteur non-lu — cloche et page. */
export async function getNotifications(
  userId: string,
  input?: { limit?: number; cursor?: { at: Date; id: string } | null; unreadOnly?: boolean },
): Promise<{
  items: NotificationItem[];
  nextCursor: { at: string; id: string } | null;
  unreadCount: number;
}> {
  const limit = Math.min(Math.max(input?.limit ?? 20, 1), 50);
  const conditions = [eq(notifications.userId, userId)];
  if (input?.unreadOnly) conditions.push(isNull(notifications.readAt));
  if (input?.cursor) {
    conditions.push(
      sql`(${notifications.createdAt}, ${notifications.id}) < (${input.cursor.at.toISOString()}::timestamptz, ${input.cursor.id}::uuid)`,
    );
  }
  const [rows, [{ value: unread }]] = await Promise.all([
    db
      .select({
        id: notifications.id,
        kind: notifications.kind,
        title: notifications.title,
        body: notifications.body,
        productId: notifications.productId,
        actorId: notifications.actorId,
        readAt: notifications.readAt,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(limit + 1),
    db
      .select({ value: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt))),
  ]);
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  // Visuels (logos produits + avatars acteurs, 2 requêtes groupées —
  // jamais de N+1). Absents = icône de tone côté UI (repli inchangé).
  const productIds = [
    ...new Set(page.map((r) => r.productId).filter((id): id is string => id !== null)),
  ];
  const actorIds = [
    ...new Set(page.map((r) => r.actorId).filter((id): id is string => id !== null)),
  ];
  const [prodRows, actorRows] = await Promise.all([
    productIds.length > 0
      ? db
          .select({ id: products.id, iconUrl: products.iconUrl })
          .from(products)
          .where(inArray(products.id, productIds))
      : [],
    actorIds.length > 0
      ? db
          .select({ id: users.id, avatarUrl: users.avatarUrl })
          .from(users)
          .where(inArray(users.id, actorIds))
      : [],
  ]);
  const iconByProduct = new Map(prodRows.map((p) => [p.id, p.iconUrl]));
  const avatarByActor = new Map(actorRows.map((a) => [a.id, a.avatarUrl]));
  return {
    items: page.map((r) => ({
      id: r.id,
      kind: r.kind,
      title: r.title,
      body: r.body,
      productId: r.productId,
      productIconUrl: r.productId ? (iconByProduct.get(r.productId) ?? null) : null,
      actorAvatarUrl: r.actorId ? (avatarByActor.get(r.actorId) ?? null) : null,
      readAt: r.readAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
    nextCursor:
      rows.length > limit && last ? { at: last.createdAt.toISOString(), id: last.id } : null,
    unreadCount: unread,
  };
}

/** Marquer lues (tout ou liste) — n'appartient qu'au propriétaire. */
export async function markNotificationsRead(
  userId: string,
  ids?: string[],
): Promise<{ updated: number }> {
  const conditions = [eq(notifications.userId, userId), isNull(notifications.readAt)];
  if (ids && ids.length > 0) {
    conditions.push(inArray(notifications.id, ids));
  }
  const updatedRows = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(...conditions))
    .returning({ id: notifications.id });
  return { updated: updatedRows.length };
}

/** Purge : lues de plus de 90 j (run-jobs, jamais de bloat). */
export async function purgeNotifications(): Promise<{ purged: number }> {
  const cutoff = new Date(Date.now() - 90 * 24 * 3_600_000);
  const rows = await db
    .delete(notifications)
    .where(and(lt(notifications.readAt, cutoff)))
    .returning({ id: notifications.id });
  // `lt(read_at, ...)` exclut les NULL (non-lues gardées pour toujours —
  // une non-lue de 2 ans reste due, pas purgée).
  return { purged: rows.length };
}

const VOTE_MILESTONES = [10, 50, 100, 500, 1000, 5000];
const VIEW_MILESTONES = [100, 1000, 10000, 100000];

/**
 * Milestones (votes + vues) : seuils fixes, une fois chacun (index
 * unique partiel — conflit silencieux). Appelé après recompte exact.
 * Jamais de notif au maker pour... si, justement au maker (vanité
 * positive, décision lot notifs).
 */
export async function checkMilestones(productId: string): Promise<void> {
  try {
    const [row] = await db
      .select({
        name: products.name,
        makerId: products.makerId,
        upvotes: products.upvoteCount,
      })
      .from(products)
      .where(and(eq(products.id, productId), isNull(products.deletedAt)))
      .limit(1);
    if (!row) return;
    const [{ value: views }] = await db
      .select({ value: sql<number>`count(*)::int` })
      .from(productPageViews)
      .where(eq(productPageViews.productId, productId));
    const jobs: Promise<boolean>[] = [];
    for (const t of VOTE_MILESTONES) {
      if (row.upvotes >= t) {
        jobs.push(
          notify({
            userId: row.makerId,
            kind: "vote_milestone",
            title: `${row.name} a dépassé ${t} votes`,
            productId,
          }),
        );
      }
    }
    for (const t of VIEW_MILESTONES) {
      if (views >= t) {
        jobs.push(
          notify({
            userId: row.makerId,
            kind: "view_milestone",
            title: `${row.name} a dépassé ${t} vues`,
            productId,
          }),
        );
      }
    }
    await Promise.all(jobs);
  } catch {
    // Milestones best-effort : jamais bloquants.
  }
}

/**
 * Digest hebdo (`run-jobs digest`, manuel / scheduler externe) : users
 * éligibles (ni supprimés, ni bannis, ni opt-out, email réel) avec ≥1
 * non-lue (7 j) → email récap. Ne marque RIEN comme lu (rappel seul).
 * `dryRun` = comptes sans envoyer (verify + prod check).
 */
export async function sendWeeklyDigest(input?: {
  dryRun?: boolean;
}): Promise<{ eligible: number; sent: number }> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 3_600_000);
  const candidates = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      timeZone: users.timeZone,
    })
    .from(users)
    .where(and(isNull(users.deletedAt), isNull(users.bannedAt), eq(users.digestOptOut, false)));
  const origin = siteUrl();
  let eligible = 0;
  let sent = 0;
  for (const u of candidates) {
    if (u.email.trim().toLowerCase().endsWith("@placeholder.local")) continue;
    const unread = await db
      .select({
        id: notifications.id,
        title: notifications.title,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, u.id),
          isNull(notifications.readAt),
          sql`${notifications.createdAt} >= ${weekAgo.toISOString()}::timestamptz`,
        ),
      )
      .orderBy(desc(notifications.createdAt))
      .limit(6);
    if (unread.length === 0) continue;
    eligible++;
    if (input?.dryRun) continue;
    const [{ value: total }] = await db
      .select({ value: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, u.id), isNull(notifications.readAt)));
    const lines = unread.slice(0, 5).map((n) => n.title);
    try {
      await sendEmail({
        to: u.email,
        subject: digestWeeklySubject(total),
        template: "digest-weekly",
        userId: u.id,
        html: digestWeeklyHtml({
          displayName: u.displayName,
          unread: total,
          lines,
          dashboardUrl: `${origin}/dashboard`,
          origin,
          timeZone: u.timeZone,
        }),
        text: digestWeeklyText({
          displayName: u.displayName,
          unread: total,
          lines,
          dashboardUrl: `${origin}/dashboard`,
          origin,
          timeZone: u.timeZone,
        }),
      });
      sent++;
    } catch {
      // Un digest en échec n'empêche pas les autres.
    }
  }
  return { eligible, sent };
}

/**
 * Préavis légal (modification substantielle confidentialité/conditions) :
 * in-app + email direct à TOUS les membres actifs, opt-out digest
 * IGNORÉ (préavis contractuel, pas du marketing — le récap lui respecte
 * l'opt-out). `dryRun` = comptes sans écrire ni envoyer. L'opérateur
 * rédige `summary` (une phrase : ce qui change) et la date d'effet
 * (≥ 15 jours, promise au légal).
 */
export async function announceLegalUpdate(input: {
  doc: LegalDoc;
  summary: string;
  effectiveLabel: string;
  dryRun?: boolean;
}): Promise<{ members: number; notified: number; emailed: number }> {
  const members = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      timeZone: users.timeZone,
    })
    .from(users)
    .where(and(isNull(users.deletedAt), isNull(users.bannedAt)));
  const origin = siteUrl();
  const docPath = input.doc === "confidentialite" ? "/confidentialite" : "/conditions";
  const title = `${LEGAL_DOC_LABEL[input.doc]} — mise à jour annoncée`;
  let notified = 0;
  let emailed = 0;
  for (const u of members) {
    if (u.email.trim().toLowerCase().endsWith("@placeholder.local")) continue;
    if (input.dryRun) {
      notified++;
      continue;
    }
    if (await notify({ userId: u.id, kind: "legal_updated", title, body: input.summary })) {
      notified++;
    }
    try {
      await sendEmail({
        to: u.email,
        subject: legalNoticeSubject(input.doc),
        template: "legal-notice",
        userId: u.id,
        html: legalNoticeHtml({
          displayName: u.displayName,
          doc: input.doc,
          summary: input.summary,
          docUrl: `${origin}${docPath}`,
          effectiveLabel: input.effectiveLabel,
          origin,
          timeZone: u.timeZone,
        }),
        text: legalNoticeText({
          displayName: u.displayName,
          doc: input.doc,
          summary: input.summary,
          docUrl: `${origin}${docPath}`,
          effectiveLabel: input.effectiveLabel,
          origin,
          timeZone: u.timeZone,
        }),
      });
      emailed++;
    } catch {
      // Un préavis en échec n'empêche pas les autres (in-app déjà posé).
    }
  }
  return { members: members.length, notified, emailed };
}

/**
 * Notification staff — file de revue (D6) : fiche qui ENTRE en pending
 * ou build enregistré. Best-effort total (jamais de throw) : la revue
 * ne doit jamais dépendre de l'email. Silencieux si ADMIN_EMAILS vide.
 * Jamais sur les brouillons ni les edits sans re-revue (pas de spam) —
 * c'est l'appelant qui décide (entrée en pending / record réussi).
 */
export async function notifyAdminsReview(input: {
  productId: string;
  buildId?: string | null;
}): Promise<void> {
  try {
    const to = adminRecipients();
    if (to.length === 0) return;
    const origin = siteUrl();
    const [p] = await db
      .select({
        id: products.id,
        name: products.name,
        status: products.status,
        makerDisplayName: users.displayName,
      })
      .from(products)
      .innerJoin(users, eq(users.id, products.makerId))
      .where(eq(products.id, input.productId))
      .limit(1);
    if (!p) return;
    const reviewUrl = `${origin}/admin/review/${p.id}`;
    if (input.buildId) {
      const [b] = await db
        .select({
          versionCode: productBuilds.versionCode,
          versionName: productBuilds.versionName,
          package: productBuilds.package,
        })
        .from(productBuilds)
        .where(eq(productBuilds.id, input.buildId))
        .limit(1);
      if (!b) return;
      const versionLabel =
        b.versionCode === null && !b.versionName
          ? "sans version"
          : `v${b.versionName ?? "?"} (${b.versionCode ?? "?"})`;
      const ficheNote =
        p.status === "pending"
          ? "Fiche en revue elle aussi — tout est à revoir d'un coup."
          : p.status === "published"
            ? "Fiche déjà en ligne."
            : "Fiche rejetée — à revoir avec la fiche corrigée.";
      await sendEmail({
        to,
        subject: staffBuildSubmittedSubject(p.name),
        template: "staff-build-submitted",
        productId: p.id,
        html: staffBuildSubmittedHtml({
          productName: p.name,
          makerDisplayName: p.makerDisplayName,
          versionLabel,
          package: b.package,
          reviewUrl,
          origin,
          ficheNote,
        }),
        text: staffBuildSubmittedText({
          productName: p.name,
          makerDisplayName: p.makerDisplayName,
          versionLabel,
          package: b.package,
          reviewUrl,
          origin,
          ficheNote,
        }),
      });
      return;
    }
    const buildRows = await db
      .select({ status: productBuilds.status })
      .from(productBuilds)
      .where(eq(productBuilds.productId, p.id))
      .limit(20);
    const buildNote = buildRows.some((r) => r.status === "pending")
      ? "Un APK est encore en revue sur cette fiche."
      : buildRows.some((r) => r.status === "approved")
        ? "Son APK est déjà en ligne."
        : null;
    await sendEmail({
      to,
      subject: staffFicheSubmittedSubject(p.name),
      template: "staff-fiche-submitted",
      productId: p.id,
      html: staffFicheSubmittedHtml({
        productName: p.name,
        makerDisplayName: p.makerDisplayName,
        reviewUrl,
        origin,
        buildNote,
      }),
      text: staffFicheSubmittedText({
        productName: p.name,
        makerDisplayName: p.makerDisplayName,
        reviewUrl,
        origin,
        buildNote,
      }),
    });
  } catch {
    // Best-effort : la soumission ne dépend jamais de cet email.
  }
}
