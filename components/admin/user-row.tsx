"use client";

import Link from "next/link";
import { AvatarImage } from "@/components/ui/avatar-image";
import { GavelIcon, CaretDownIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { StaffIdentity } from "@/components/admin/user-identity";
import { RowMenu } from "@/components/admin/row-menu";
import type { UserHistory } from "@/app/actions/admin";

/**
 * Ligne user réelle (DB) — avatar (+ fallback initiales), identité, badges
 * Admin/Banni, providers liés, date d'inscription, email (lecture admin),
 * motif + appels si banni. Les compteurs produits reviennent au milestone
 * listings (pas de table products en fondation — aucun faux chiffre ici).
 */
export type AdminUserRow = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  email: string | null;
  providers: string[];
  role: "admin" | "moderateur" | "user";
  status: "active" | "banned";
  banReason: string | null;
  /** ISO du ban en cours (null si actif) — état live, pas d'audit. */
  bannedAt: string | null;
  appeals: number;
  /** ISO — null en démo. */
  joinedAt: string | null;
};

// Pastille sémantique (langage dot-notif du repo : rouge = danger/ban,
// emerald = déban, ambre = grades, neutre = appels).
function HistoryDot({ action }: { action: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "h-1.5 w-1.5 rounded-full shrink-0 self-center",
        action === "ban" && "bg-red-500",
        action === "unban" && "bg-emerald-500",
        (action === "promote" || action === "demote") && "bg-amber-500",
        (action === "appeal_upheld" || action === "appeal_overturned") &&
          "bg-muted-foreground/50",
      )}
    />
  );
}

export function UserRow({
  user,
  banning,
  banReason,
  pending,
  isSelf,
  rolePending,
  showRoleActions,
  expanded,
  history,
  historyLoading,
  onToggleBan,
  onBanReasonChange,
  onCancelBan,
  onConfirmBan,
  onUnban,
  onToggleRole,
  onToggleHistory,
}: {
  user: AdminUserRow;
  banning: boolean;
  banReason: string;
  pending: boolean;
  /** Ligne de l'admin connecté : ni ban ni rôle modifiables. */
  isSelf: boolean;
  rolePending: boolean;
  /** Boutons de grade : acteur admin seul (jamais pour un modérateur). */
  showRoleActions: boolean;
  expanded: boolean;
  history: UserHistory | null;
  historyLoading: boolean;
  onToggleBan: () => void;
  onBanReasonChange: (value: string) => void;
  onCancelBan: () => void;
  onConfirmBan: () => void;
  onUnban: () => void;
  onToggleRole: () => void;
  onToggleHistory: () => void;
}) {
  const initials = user.displayName
    .split(/[\s_.-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

  return (
    <div>
      <div className="flex gap-4 py-6 px-3 rounded-2xl hover:bg-muted/40 transition-colors">
        {/* Avatar → profil public */}
        <Link
          href={`/makers/${user.username}`}
          className="shrink-0 self-start hover:opacity-80 transition-opacity"
          aria-label={`Voir le profil de ${user.displayName}`}
        >
          {user.avatarUrl ? (
            <AvatarImage
              src={user.avatarUrl}
              name={user.displayName}
              size={56}
            />
          ) : (
            <span
              aria-hidden="true"
              className="w-14 h-14 rounded-full bg-[#EA580C] flex items-center justify-center text-white font-bold text-lg"
            >
              {initials || "M"}
            </span>
          )}
        </Link>

        {/* Colonne centrale */}
        <div className="flex flex-col gap-3 min-w-0 flex-1">
          {/* Identité — composant partagé avec la carte appel (même
              rendu, mêmes infos, mêmes espacements). */}
          <StaffIdentity
            id={user.id}
            username={user.username}
            displayName={user.displayName}
            email={user.email}
            providers={user.providers}
            joinedAt={user.joinedAt}
            badges={
              user.role === "admin" ? (
                <span className="inline-flex items-center rounded border border-red-500/25 bg-red-500/10 px-1.5 py-px text-[9px] font-black uppercase tracking-[0.14em] text-red-600 dark:text-red-400 shrink-0">
                  Admin
                </span>
              ) : user.role === "moderateur" ? (
                <span className="inline-flex items-center rounded border border-amber-500/25 bg-amber-500/10 px-1.5 py-px text-[9px] font-black uppercase tracking-[0.14em] text-amber-600 dark:text-amber-400 shrink-0">
                  Modo
                </span>
              ) : user.status === "banned" ? (
                <span className="inline-flex items-center rounded-md border border-red-500/25 bg-red-500/10 px-1.5 py-[3px] text-[9px] font-black uppercase tracking-[0.14em] leading-none text-red-600 dark:text-red-400 shrink-0">
                  Banni
                </span>
              ) : null
            }
          />

          {user.status === "banned" && user.banReason && (
            <p className="text-[12px] font-medium text-red-600 dark:text-red-400 leading-snug">
              Motif : {user.banReason} · Appels : {user.appeals}
            </p>
          )}
        </div>

        {/* Actions — chevron historique toujours visible (lecture).
            Desktop : boutons inline. Mobile : menu ⋯ (mêmes gardes,
            mêmes callbacks — l'identité respire, rien ne s'empile). */}
        <div className="flex items-center self-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onToggleHistory}
            aria-expanded={expanded}
            title={expanded ? "Masquer l'historique" : "Voir l'historique"}
            className={cn(
              "flex items-center justify-center h-9 w-9 rounded-full border transition-colors cursor-pointer",
              expanded
                ? "border-foreground/30 bg-muted/60 text-foreground"
                : "border-border/40 text-muted-foreground hover:text-foreground hover:border-border/80 hover:bg-muted/50",
            )}
          >
            <CaretDownIcon
              weight="bold"
              className={cn(
                "h-4 w-4 transition-transform",
                expanded && "rotate-180",
              )}
            />
          </button>
          <span className="hidden md:flex items-center gap-1">
          {!isSelf && showRoleActions && user.role === "user" && (
            <button
              type="button"
              onClick={onToggleRole}
              disabled={rolePending}
              title="Nommer modérateur"
              className="inline-flex items-center gap-1.5 rounded-full border border-border/40 px-4 py-2 text-[13px] font-bold text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400 hover:border-amber-500/40 hover:bg-amber-500/10 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
            >
              {rolePending && <Spinner size="xs" />}
              Rendre modo
            </button>
          )}
          {!isSelf && showRoleActions && user.role === "moderateur" && (
            <button
              type="button"
              onClick={onToggleRole}
              disabled={rolePending}
              title="Retirer le rôle modérateur"
              className="inline-flex items-center gap-1.5 rounded-full border border-border/40 px-4 py-2 text-[13px] font-bold text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400 hover:border-amber-500/40 hover:bg-amber-500/10 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
            >
              {rolePending && <Spinner size="xs" />}
              Rétrograder
            </button>
          )}
          {user.role === "user" &&
            (user.status === "banned" ? (
              <button
                type="button"
                onClick={onUnban}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 px-4 py-2 text-[13px] font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
              >
                {pending && <Spinner size="xs" />}
                Débannir
              </button>
            ) : (
              <button
                type="button"
                onClick={onToggleBan}
                aria-expanded={banning}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-4 py-2 text-[13px] font-bold transition-colors cursor-pointer whitespace-nowrap",
                  banning
                    ? "border-foreground/30 bg-muted/60 text-foreground"
                    : "border-border/40 text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/10",
                )}
              >
                <GavelIcon weight="bold" className="w-4 h-4" />
                Bannir
              </button>
            ))}
          </span>
          {!isSelf &&
            (user.role === "user" ||
              (showRoleActions && user.role === "moderateur")) && (
              <RowMenu
                canManageRole={showRoleActions}
                roleLabel={
                  user.role === "moderateur" ? "Rétrograder" : "Rendre modo"
                }
                rolePending={rolePending}
                onToggleRole={onToggleRole}
                canBan={user.role === "user"}
                banLabel={user.status === "banned" ? "Débannir" : "Bannir"}
                banTone={user.status === "banned" ? "success" : "danger"}
                actionPending={pending}
                onAction={user.status === "banned" ? onUnban : onToggleBan}
              />
            )}
        </div>
      </div>

      {/* Ban reason — inline, obligatoire. Indent aligné avatar sur
          desktop, resserré sur mobile (72 px récupérés). */}
      {banning && user.status === "active" && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 pl-3 sm:pl-[84px] pr-3 pb-5">
          <input
            type="text"
            value={banReason}
            onChange={(e) => onBanReasonChange(e.target.value)}
            placeholder="Motif du ban (visible par l'utilisateur)…"
            autoFocus
            className="flex-1 min-w-0 bg-background border border-border/60 rounded-2xl px-4 py-2.5 text-[14px] font-medium placeholder:text-muted-foreground/40 text-foreground outline-none focus:border-red-500/50 transition-colors"
          />
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onCancelBan}
              className="rounded-full px-4 py-2 text-[13px] font-bold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={onConfirmBan}
              disabled={banReason.trim() === "" || pending}
              className="rounded-full bg-red-600 px-4 py-2 text-[13px] font-bold text-white hover:bg-red-500 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {pending && <Spinner size="xs" />}
              {pending ? "Ban en cours…" : "Confirmer le ban"}
            </button>
          </div>
        </div>
      )}
      {/* Historique paresseux — Zero UI (pas de carte : pile
          typographique alignée, tons sémantiques). L'état LIVE passe
          d'abord (vérité d'état, pas d'audit). La ligne de compteurs ne
          montre QUE les compteurs non nuls : bans/unbans viennent de
          l'audit post-suivi (un ban pré-suivi vaut 0 — l'afficher serait
          un mensonge), appels vient de la table (fiable). Zéro "0×". */}
      {expanded && (
        <div className="pl-[84px] pr-3 pb-5">
          {historyLoading || !history ? (
            <p className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground py-2">
              <Spinner size="xs" />
              Chargement de l&apos;historique…
            </p>
          ) : (
            <HistoryBody user={user} history={history} />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Corps de l'historique : état live → compteurs non-nuls → timeline.
 * Cas rendus (aucun n'affiche "0×") :
 * - banni : "Actuellement banni — motif · depuis le…" (+ timeline si events,
 *   + note antérieures si vide) ;
 * - actif avec events : "Banni 1× · appels 2" (seuls les > 0) + timeline ;
 * - actif sans trace : "Aucune sanction — bon travail."
 */
function HistoryBody({
  user,
  history,
}: {
  user: AdminUserRow;
  history: UserHistory;
}) {
  const parts: string[] = [];
  if (history.bans > 0) parts.push(`Banni ${history.bans}×`);
  if (history.unbans > 0) parts.push(`Débanni ${history.unbans}×`);
  if (history.appeals > 0) parts.push(`appels ${history.appeals}`);

  // Ban fantôme : bans === 0 mais débans/appels > 0 ⇒ l'utilisateur a
  // FORCÉMENT été banni avant le suivi (on ne débanne ni ne conteste
  // sans ban). Entrée synthétique en bas de timeline (la plus ancienne),
  // labellisée "avant le suivi" — ni acteur ni date inventés. Pas pour
  // un banni en cours : la ligne live "Actuellement banni" le couvre.
  const ghostBan =
    user.status !== "banned" &&
    history.bans === 0 &&
    (history.unbans > 0 || history.appeals > 0);

  return (
    <div className="flex flex-col gap-2.5">
      {user.status === "banned" && (
        <p className="text-[13px] font-bold text-foreground tabular-nums">
          Actuellement banni
          {user.banReason && (
            <span className="font-medium text-red-600 dark:text-red-400">
              {" "}
              — {user.banReason}
            </span>
          )}
          {user.bannedAt && (
            <span className="font-medium text-muted-foreground">
              {" "}
              · depuis le{" "}
              {new Intl.DateTimeFormat("fr-FR", {
                day: "numeric",
                month: "short",
                year: "numeric",
              }).format(new Date(user.bannedAt))}
            </span>
          )}
        </p>
      )}
      {parts.length > 0 && (
        <p className="text-[13px] font-bold text-foreground tabular-nums">
          {parts.join(" · ")}
        </p>
      )}
      {history.events.length === 0 ? (
        user.status === "banned" || history.appeals > 0 ? (
          <p className="text-[12px] font-medium text-muted-foreground">
            Actions antérieures au suivi non détaillées.
          </p>
        ) : (
          <p className="text-[13px] font-medium text-muted-foreground">
            Aucune sanction — bon travail.
          </p>
        )
      ) : (
        <ul className="flex flex-col divide-y divide-border/40">
          {history.events.map((event) => (
            <li
              key={event.id}
              className="flex items-baseline gap-2 py-2 text-[13px] leading-relaxed"
            >
              <HistoryDot action={event.action} />
              <span
                className={cn(
                  "font-bold shrink-0",
                  event.action === "ban" &&
                    "text-red-600 dark:text-red-400",
                  event.action === "unban" &&
                    "text-emerald-600 dark:text-emerald-400",
                  (event.action === "promote" ||
                    event.action === "demote") &&
                    "text-amber-600 dark:text-amber-400",
                  (event.action === "appeal_upheld" ||
                    event.action === "appeal_overturned") &&
                    "text-foreground",
                )}
              >
                {event.label}
              </span>
              <span className="text-muted-foreground">
                par {event.actor}
              </span>
              {event.note && (
                <span className="text-muted-foreground truncate">
                  — {event.note}
                </span>
              )}
              <span className="ml-auto text-[12px] font-medium text-muted-foreground/70 tabular-nums shrink-0">
                {new Intl.DateTimeFormat("fr-FR", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                }).format(new Date(event.at))}
              </span>
            </li>
          ))}
          {ghostBan && (
            <li className="flex items-baseline gap-2 py-2 text-[13px] leading-relaxed">
              <HistoryDot action="ban" />
              <span className="font-bold shrink-0 text-red-600 dark:text-red-400">
                Banni
              </span>
              <span className="text-muted-foreground">avant le suivi</span>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
