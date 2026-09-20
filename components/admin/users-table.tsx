"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { SearchInput } from "@/components/ui/search-input";
import { UserRow } from "@/components/admin/user-row";
import {
  MOCK_ADMIN_USERS,
  type AdminUser,
} from "@/components/admin/admin-mock";

type UserFilter = "all" | "makers" | "non-makers" | "banned";

const FILTERS: { id: UserFilter; label: string; withCount?: boolean }[] = [
  { id: "all", label: "Tous" },
  { id: "makers", label: "Makers" },
  { id: "non-makers", label: "Non-makers" },
  { id: "banned", label: "Bannis", withCount: true },
];

const EMPTY_COPY: Record<UserFilter, string> = {
  all: "Aucun utilisateur pour le moment.",
  makers: "Aucun maker pour le moment.",
  "non-makers": "Aucun non-maker pour le moment.",
  banned: "Aucun banni — bon travail.",
};

// Modération users — BAN UNIQUEMENT (réversible, appels illimités).
// Pas de suppression user côté admin : l'arme lourde vit au niveau
// produit (delete manuel) + auto-suppression RGPD côté user.
// Backend : banned_at + ban_reason + table appeals.
export function UsersTable() {
  const [users, setUsers] = React.useState<AdminUser[]>(MOCK_ADMIN_USERS);
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<UserFilter>("all");
  const [banningId, setBanningId] = React.useState<string | null>(null);
  const [banReason, setBanReason] = React.useState("");

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = users.filter((u) => {
    const matchesStatus =
      filter === "all" ||
      (filter === "makers" && u.products.length >= 1) ||
      (filter === "non-makers" && u.products.length === 0) ||
      (filter === "banned" && u.status === "banned");
    const matchesQuery =
      normalizedQuery === "" ||
      u.displayName.toLowerCase().includes(normalizedQuery) ||
      u.username.toLowerCase().includes(normalizedQuery) ||
      (u.email ?? "").toLowerCase().includes(normalizedQuery);
    return matchesStatus && matchesQuery;
  });

  const bannedCount = users.filter((u) => u.status === "banned").length;

  const confirmBan = (user: AdminUser) => {
    if (banReason.trim() === "") return;
    setUsers((prev) =>
      prev.map((u) =>
        u.id === user.id
          ? {
              ...u,
              status: "banned" as const,
              banReason: banReason.trim(),
              appeals: 0,
            }
          : u,
      ),
    );
    setBanningId(null);
    setBanReason("");
  };

  const unban = (user: AdminUser) => {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === user.id
          ? { ...u, status: "active" as const, banReason: undefined }
          : u,
      ),
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <SearchInput
        variant="page"
        placeholder="Rechercher un utilisateur…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {/* Filters + counter */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const isActive = filter === f.id;
            return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              aria-pressed={isActive}
              className={cn(
                "relative flex items-center gap-2 rounded-full px-4 py-2 text-[13px] transition-colors cursor-pointer border",
                isActive
                  ? "bg-foreground text-background border-transparent font-bold"
                  : "bg-background text-muted-foreground border-border/40 font-medium hover:text-foreground hover:border-border/80",
              )}
            >
              {f.label}
              {f.withCount && (
                <span
                  aria-hidden="true"
                  className="absolute -top-2 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-black tabular-nums leading-none flex items-center justify-center shadow-sm"
                >
                  {bannedCount}
                </span>
              )}
              </button>
            );
          })}
        </div>
        <span className="text-[13px] font-medium text-muted-foreground whitespace-nowrap">
          {filtered.length} sur {users.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="text-[14px] font-medium text-muted-foreground py-8 text-center">
          {normalizedQuery !== ""
            ? `Aucun résultat pour « ${query.trim()} ».`
            : EMPTY_COPY[filter]}
        </p>
      ) : (
        <div className="flex flex-col">
          {filtered.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              banning={banningId === user.id}
              banReason={banReason}
              onToggleBan={() =>
                setBanningId(banningId === user.id ? null : user.id)
              }
              onBanReasonChange={setBanReason}
              onCancelBan={() => {
                setBanningId(null);
                setBanReason("");
              }}
              onConfirmBan={() => confirmBan(user)}
              onUnban={() => unban(user)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
