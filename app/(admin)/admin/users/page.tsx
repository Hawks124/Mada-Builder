import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { UsersTable } from "@/components/admin/users-table";
import type { AdminUserRow } from "@/components/admin/user-row";
import { MOCK_ADMIN_USERS } from "@/components/admin/admin-mock";
import { requireStaffId } from "@/app/actions/admin";
import {
  decodeCursor,
  encodeCursor,
  getAdminUsers,
  type AdminUserStatus,
} from "@/services/users.service";
import { getPendingAppeals, getPendingAppealsCount } from "@/services/appeals.service";
import type { AppealRow } from "@/components/admin/appeals-panel";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBannedCount, getUsersTotal } from "@/services/stats.service";
// noindex strict — jamais indexé, même au backend.
export const metadata: Metadata = {
  title: "Admin — Utilisateurs",
  robots: { index: false, follow: false },
};

const PAGE_SIZE = 20;

// Démo sans backend : mock documenté (mêmes lignes, joinedAt inconnu,
// pas de pagination — liste courte par construction).
const MOCK_ROWS: AdminUserRow[] = MOCK_ADMIN_USERS.map((u) => ({
  id: u.id,
  username: u.username,
  displayName: u.displayName,
  avatarUrl: u.avatarUrl,
  email: u.email ?? null,
  providers: [u.provider],
  role: u.role,
  status: u.status,
  banReason: u.banReason ?? null,
  bannedAt: null,
  appeals: u.appeals,
  joinedAt: null,
}));

function toRows(items: Awaited<ReturnType<typeof getAdminUsers>>["items"]): AdminUserRow[] {
  return items.map((u) => ({
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    email: u.email,
    providers: u.providers,
    role: u.role,
    status: u.bannedAt ? "banned" : ("active" as const),
    banReason: u.banReason,
    bannedAt: u.bannedAt ? u.bannedAt.toISOString() : null,
    appeals: u.appealsCount,
    joinedAt: u.createdAt.toISOString(),
  }));
}

// Modération users : BAN UNIQUEMENT (réversible + appels illimités).
// Pas de suppression user côté admin. Grades via l'UI (admin seul),
// grade admin inaltérable (SQL founder, voir docs/auth.md §2).
// Recherche (?q=) + filtre (?status=) + keyset (?cursor=) serveur ;
// "Charger plus" append côté client (jamais d'OFFSET).
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; cursor?: string }>;
}) {
  const params = await searchParams;
  const q = (params.q ?? "").slice(0, 100);
  const status: AdminUserStatus | "appeals" =
    params.status === "banned" ? "banned" : params.status === "appeals" ? "appeals" : "all";

  type ListData = {
    rows: AdminUserRow[];
    cursor: string | null;
    total: number;
    bannedTotal: number;
    appeals: AppealRow[];
    appealsCount: number;
    adminId: string;
    canManageRoles: boolean;
  };
  let data: ListData | null = null;
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const staff = await requireStaffId();
      const [list, total, bannedTotal, pendingCount] = await Promise.all([
        getAdminUsers({
          isStaff: true,
          q,
          status: status === "appeals" ? "all" : status,
          cursor: decodeCursor(params.cursor),
          limit: PAGE_SIZE,
        }),
        getUsersTotal(),
        getBannedCount(),
        getPendingAppealsCount(),
      ]);
      // Appels + liens signés 72 h (jamais persistés — expirent).
      let appeals: AppealRow[] = [];
      if (status === "appeals") {
        const pending = await getPendingAppeals();
        const admin = createAdminClient();
        appeals = await Promise.all(
          pending.map(async (a) => {
            const evidenceLinks: string[] = [];
            for (const path of a.evidencePaths) {
              try {
                const { data: signed, error } = await admin.storage
                  .from("appeals")
                  .createSignedUrl(path, 72 * 3600);
                if (!error && signed?.signedUrl) {
                  evidenceLinks.push(signed.signedUrl);
                }
              } catch {
                // Pièce omise plutôt que page en échec.
              }
            }
            return {
              id: a.id,
              userId: a.userId,
              seq: a.seq,
              username: a.username,
              displayName: a.displayName,
              email: a.email,
              avatarUrl: a.avatarUrl,
              providers: a.providers,
              joinedAt: a.joinedAt.toISOString(),
              banReason: a.banReason,
              explanation: a.explanation,
              evidenceLinks,
              createdAt: a.createdAt.toISOString(),
            };
          }),
        );
      }
      data = {
        rows: toRows(list.items),
        cursor: encodeCursor(list.nextCursor),
        total,
        bannedTotal,
        appeals,
        appealsCount: pendingCount,
        adminId: staff.id,
        canManageRoles: staff.role === "admin",
      };
    } catch {
      data = null;
    }
  }
  let content: React.ReactNode;
  if (data) {
    content = (
      <UsersTable
        initial={data.rows}
        initialCursor={data.cursor}
        total={data.total}
        bannedTotal={data.bannedTotal}
        appeals={data.appeals}
        appealsCount={data.appealsCount}
        q={q}
        status={status}
        adminId={data.adminId}
        canManageRoles={data.canManageRoles}
      />
    );
  } else if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    content = (
      <p className="text-[14px] font-medium text-muted-foreground py-8 text-center">
        Chargement impossible pour le moment.
      </p>
    );
  } else {
    content = (
      <UsersTable
        initial={MOCK_ROWS}
        initialCursor={null}
        total={MOCK_ROWS.length}
        bannedTotal={MOCK_ROWS.filter((u) => u.status === "banned").length}
        appeals={[]}
        appealsCount={MOCK_ROWS.reduce((n, u) => n + u.appeals, 0)}
        q=""
        status="all"
        adminId=""
        canManageRoles={false}
      />
    );
  }
  return (
    <div className="w-full px-6 lg:px-12 pt-10 lg:pt-14 pb-24 flex flex-col gap-10">
      <PageHeader
        title="Utilisateurs"
        subtitle="Bannir (motif requis, réversible) ou débannir. Aucune suppression — l'arme lourde vit au niveau produit."
      />
      {content}
    </div>
  );
}
