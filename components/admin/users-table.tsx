"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { SearchInput } from "@/components/ui/search-input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Spinner } from "@/components/ui/spinner";
import { UserRow, type AdminUserRow } from "@/components/admin/user-row";
import { AppealsPanel, type AppealRow } from "@/components/admin/appeals-panel";
import { toast } from "@/components/ui/toast";
import {
  banUserAction,
  getUserHistoryAction,
  loadMoreUsersAction,
  setUserRoleAction,
  unbanUserAction,
  type UserHistory,
} from "@/app/actions/admin";
import { useAppealsWatcher } from "@/lib/supabase/use-appeals-watcher";
import type { AdminUserStatus } from "@/services/users.service";

type ListFilter = AdminUserStatus | "appeals";

const FILTERS: { id: ListFilter; label: string; withCount?: boolean }[] = [
  { id: "all", label: "Tous" },
  // Filtres makers/non-makers : reviennent au milestone listings (table
  // products + comptes). Aucun faux chiffre d'ici là.
  { id: "banned", label: "Bannis", withCount: true },
  { id: "appeals", label: "Appels", withCount: true },
];

// Modération users — BAN UNIQUEMENT (réversible, appels illimités).
// Pas de suppression user côté admin : l'arme lourde vit au niveau
// produit (delete manuel) + auto-suppression RGPD côté user.
// Page initiale serveur (?q= ?status= ?cursor=) + "Charger plus" (keyset,
// append client — jamais d'OFFSET) ; pré-filtre instantané local.
export function UsersTable({
  initial,
  initialCursor,
  total,
  bannedTotal,
  appeals,
  appealsCount,
  q,
  status,
  adminId,
  canManageRoles,
}: {
  initial: AdminUserRow[];
  initialCursor: string | null;
  total: number;
  bannedTotal: number;
  /** Appels pending (rendus quand l'onglet Appels est actif). */
  appeals: AppealRow[];
  appealsCount: number;
  q: string;
  status: ListFilter;
  adminId: string;
  /** Grades user↔modo : admin seul (un modérateur ne nomme personne). */
  canManageRoles: boolean;
}) {
  const [rows, setRows] = React.useState(initial);
  const [cursor, setCursor] = React.useState<string | null>(initialCursor);
  const [query, setQuery] = React.useState(q);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [banningId, setBanningId] = React.useState<string | null>(null);
  const [banReason, setBanReason] = React.useState("");
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [rolePendingId, setRolePendingId] = React.useState<string | null>(null);
  const [roleConfirm, setRoleConfirm] = React.useState<AdminUserRow | null>(null);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [histories, setHistories] = React.useState<Record<string, UserHistory>>({});
  const [historyLoadingId, setHistoryLoadingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Appels temps réel par event (socket postgres_changes sur appeals —
  // RLS `appeals_select_staff`) : INSERT → toast + refresh (file
  // rechargée, liens signés frais). Zéro sondage, zéro coût Auth répété.
  // Silencieux si coupé (le refresh manuel reste).
  useAppealsWatcher(true);

  // Re-sync quand le serveur renvoie une nouvelle page (?q= ?status=).
  const pageKey = `${q}|${status}|${initialCursor ?? ""}`;
  const [seenKey, setSeenKey] = React.useState(pageKey);
  if (seenKey !== pageKey) {
    setSeenKey(pageKey);
    setRows(initial);
    setCursor(initialCursor);
    setQuery(q);
    setBanningId(null);
    setBanReason("");
    setError(null);
  }

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = rows.filter((u) => {
    if (normalizedQuery === "") return true;
    return (
      u.displayName.toLowerCase().includes(normalizedQuery) ||
      u.username.toLowerCase().includes(normalizedQuery) ||
      (u.email ?? "").toLowerCase().includes(normalizedQuery)
    );
  });

  const loadMore = () => {
    if (!cursor || loadingMore) return;
    setError(null);
    setLoadingMore(true);
    React.startTransition(async () => {
      // Onglet Appels : pas de pagination users (bouton masqué — garde type).
      const result = await loadMoreUsersAction({
        q,
        status: status === "appeals" ? "all" : status,
        cursor,
      });
      setLoadingMore(false);
      if (!result.ok) {
        setError(result.error);
        toast("err", result.error);
        return;
      }
      setRows((prev) => {
        const known = new Set(prev.map((u) => u.id));
        const fresh = result.items
          .filter((u) => !known.has(u.id))
          .map((u) => ({
            ...u,
            status: (u.bannedAt ? "banned" : "active") as AdminUserRow["status"],
            banReason: u.banReason,
            bannedAt: u.bannedAt,
            appeals: u.appealsCount,
            joinedAt: u.createdAt,
          }));
        return [...prev, ...fresh];
      });
      setCursor(result.nextCursor);
    });
  };

  const confirmBan = (user: AdminUserRow) => {
    if (banReason.trim() === "") return;
    setError(null);
    setPendingId(user.id);
    React.startTransition(async () => {
      const result = await banUserAction({
        userId: user.id,
        reason: banReason.trim(),
      });
      setPendingId(null);
      if (!result.ok) {
        const message = result.message ?? "Ban impossible.";
        setError(message);
        toast("err", message);
        return;
      }
      setBanningId(null);
      setBanReason("");
      toast("ok", result.message ?? "Utilisateur banni.");
      setRows((prev) =>
        prev.map((u) =>
          u.id === user.id ? { ...u, status: "banned" as const, banReason: banReason.trim() } : u,
        ),
      );
    });
  };

  // Historique paresseux : fetch à l'expansion uniquement (jamais de
  // N+1 sur la liste). Replié = conservé en cache local (pas de re-fetch).
  const toggleHistory = (user: AdminUserRow) => {
    if (expandedId === user.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(user.id);
    if (histories[user.id]) return;
    setHistoryLoadingId(user.id);
    React.startTransition(async () => {
      const result = await getUserHistoryAction({ userId: user.id });
      setHistoryLoadingId(null);
      if (!result.ok) {
        toast("err", result.error);
        setExpandedId(null);
        return;
      }
      setHistories((prev) => ({ ...prev, [user.id]: result.history }));
    });
  };

  const unban = (user: AdminUserRow) => {
    setError(null);
    setPendingId(user.id);
    React.startTransition(async () => {
      const result = await unbanUserAction({ userId: user.id });
      setPendingId(null);
      if (!result.ok) {
        const message = result.message ?? "Débannissement impossible.";
        setError(message);
        toast("err", message);
        return;
      }
      toast("ok", result.message ?? "Utilisateur débanni.");
      setRows((prev) =>
        prev.map((u) =>
          u.id === user.id ? { ...u, status: "active" as const, banReason: null } : u,
        ),
      );
    });
  };

  const confirmRole = () => {
    const user = roleConfirm;
    if (!user) return;
    setError(null);
    setRolePendingId(user.id);
    const targetRole = user.role === "moderateur" ? "user" : "moderateur";
    React.startTransition(async () => {
      const result = await setUserRoleAction({
        userId: user.id,
        role: targetRole,
      });
      setRolePendingId(null);
      setRoleConfirm(null);
      if (!result.ok) {
        const message = result.message ?? "Changement de rôle impossible.";
        setError(message);
        toast("err", message);
        return;
      }
      toast("ok", result.message ?? "Rôle mis à jour.");
      setRows((prev) => prev.map((u) => (u.id === user.id ? { ...u, role: targetRole } : u)));
    });
  };

  const tabHref = (s: ListFilter) => {
    const params = new URLSearchParams();
    if (q !== "") params.set("q", q);
    if (s !== "all") params.set("status", s);
    const query = params.toString();
    return `/admin/users${query ? `?${query}` : ""}`;
  };

  return (
    <div className="flex flex-col gap-6">
      <ConfirmDialog
        open={roleConfirm !== null}
        title={
          roleConfirm?.role === "moderateur"
            ? "Retirer le rôle modérateur ?"
            : "Nommer modérateur ?"
        }
        description={
          roleConfirm?.role === "moderateur"
            ? `${roleConfirm?.displayName} perdra l'accès au panel admin. Son compte maker reste inchangé.`
            : `${roleConfirm?.displayName} accédera au panel admin (modération, appels — sans gestion des grades). Effectif à sa prochaine connexion.`
        }
        confirmLabel={roleConfirm?.role === "moderateur" ? "Rétrograder" : "Nommer modo"}
        confirmPending={rolePendingId !== null}
        onConfirm={confirmRole}
        onCancel={() => setRoleConfirm(null)}
      />
      {/* Recherche serveur (?q=) + pré-filtre local — onglets users seuls */}
      {status !== "appeals" && (
        <form method="get" action="/admin/users" className="w-full">
          {status !== "all" && <input type="hidden" name="status" value={status} />}
          <SearchInput
            variant="page"
            placeholder="Rechercher un utilisateur…"
            name="q"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </form>
      )}

      {/* Filters + counter */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const isActive = status === f.id;
            // Badge affiché seulement si non-zéro (pas de bruit à 0).
            const count = f.id === "appeals" ? appealsCount : f.id === "banned" ? bannedTotal : 0;
            return (
              <Link
                key={f.id}
                href={tabHref(f.id)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-2 rounded-full px-4 py-2 text-[13px] transition-colors cursor-pointer border",
                  isActive
                    ? "bg-foreground text-background border-transparent font-bold"
                    : "bg-background text-muted-foreground border-border/40 font-medium hover:text-foreground hover:border-border/80",
                )}
              >
                {f.label}
                {f.withCount && count > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute -top-2 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-black tabular-nums leading-none flex items-center justify-center shadow-sm"
                  >
                    {count}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
        <span className="text-[13px] font-medium text-muted-foreground whitespace-nowrap">
          {status === "appeals"
            ? `${appeals.length} en attente`
            : `Affichés ${filtered.length} sur ${total}`}
        </span>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-2xl border border-red-500/25 bg-red-500/10 px-5 py-3 text-[13px] font-medium text-red-600 dark:text-red-400 leading-relaxed"
        >
          {error}
        </p>
      )}

      {status === "appeals" ? (
        <AppealsPanel initial={appeals} />
      ) : filtered.length === 0 ? (
        <p className="text-[14px] font-medium text-muted-foreground py-8 text-center">
          {normalizedQuery !== "" || q !== ""
            ? `Aucun résultat pour « ${(query || q).trim()} ».`
            : EMPTY_COPY[status]}
        </p>
      ) : (
        <div className="flex flex-col">
          {filtered.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              banning={banningId === user.id}
              banReason={banReason}
              pending={pendingId === user.id}
              isSelf={user.id === adminId}
              rolePending={rolePendingId === user.id}
              showRoleActions={canManageRoles}
              expanded={expandedId === user.id}
              history={histories[user.id] ?? null}
              historyLoading={historyLoadingId === user.id}
              onToggleBan={() => setBanningId(banningId === user.id ? null : user.id)}
              onBanReasonChange={setBanReason}
              onCancelBan={() => {
                setBanningId(null);
                setBanReason("");
              }}
              onConfirmBan={() => confirmBan(user)}
              onUnban={() => unban(user)}
              onToggleRole={() => setRoleConfirm(user)}
              onToggleHistory={() => toggleHistory(user)}
            />
          ))}
        </div>
      )}

      {/* Pagination keyset — append, jamais d'OFFSET (onglets users seuls) */}
      {status !== "appeals" && cursor && filtered.length > 0 && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="inline-flex items-center gap-2 rounded-full border border-border/60 px-6 py-2.5 text-[13px] font-bold text-foreground hover:border-foreground/30 hover:bg-muted/50 transition-colors cursor-pointer disabled:opacity-50"
          >
            {loadingMore && <Spinner size="xs" />}
            {loadingMore ? "Chargement…" : "Charger plus"}
          </button>
        </div>
      )}
    </div>
  );
}

const EMPTY_COPY: Record<ListFilter, string> = {
  all: "Aucun utilisateur pour le moment.",
  banned: "Aucun banni — bon travail.",
  appeals: "Aucun appel en attente — bon travail.",
};
