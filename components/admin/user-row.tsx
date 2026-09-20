"use client";

import Link from "next/link";
import {
  GavelIcon,
  SealCheckIcon,
  GithubLogoIcon,
  XLogoIcon,
  GlobeIcon,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { AdminUser } from "@/components/admin/admin-mock";

const STACK_VISIBLE = 3;

// Provider : mini logo + label (GitHub monochrome, Google officiel).
function ProviderMark({ provider }: { provider: AdminUser["provider"] }) {
  if (provider === "google") {
    return (
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logos/google.svg"
          alt="Google"
          className="w-3.5 h-3.5 shrink-0"
        />
        Google
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-muted-foreground">
      <GithubLogoIcon weight="fill" className="w-3.5 h-3.5 shrink-0" />
      GitHub
    </span>
  );
}

// Stack produits — +N en dernier cercle overlapé (pattern contributeurs),
// pas en texte séparé.
function ProductStack({ user }: { user: AdminUser }) {
  const count = user.products.length;
  if (count === 0) {
    return (
      <span className="text-[12px] font-medium text-muted-foreground/60">
        Aucun produit
      </span>
    );
  }
  const visible = user.products.slice(0, STACK_VISIBLE);
  const extra = count - visible.length;
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex -space-x-2.5">
        {visible.map((p) => (
          <span
            key={p.id}
            title={p.id}
            className={cn(
              "w-9 h-9 rounded-full ring-2 ring-background shrink-0 flex items-center justify-center text-white font-black text-[11px] bg-linear-to-br shadow-sm",
              p.iconGradient,
            )}
          >
            {p.initials}
          </span>
        ))}
        {extra > 0 && (
          <span
            title={`${extra} de plus`}
            className="w-9 h-9 rounded-full ring-2 ring-background shrink-0 flex items-center justify-center bg-muted border border-border/40 text-[11px] font-black text-muted-foreground tabular-nums"
          >
            +{extra}
          </span>
        )}
      </span>
      <span className="text-[12px] font-bold text-foreground tabular-nums whitespace-nowrap">
        {count} produit{count > 1 ? "s" : ""}
      </span>
    </span>
  );
}

// Sociaux + site — liens externes (inspection modération).
function SocialLinks({ user }: { user: AdminUser }) {
  const items = [
    user.socials.github && {
      href: user.socials.github,
      label: "GitHub",
      icon: <GithubLogoIcon weight="fill" className="w-4 h-4" />,
    },
    user.socials.x && {
      href: user.socials.x,
      label: "X",
      icon: <XLogoIcon weight="fill" className="w-4 h-4" />,
    },
    user.socials.website && {
      href: user.socials.website,
      label: "Site web",
      icon: <GlobeIcon weight="bold" className="w-4 h-4" />,
    },
  ].filter(Boolean) as { href: string; label: string; icon: React.ReactNode }[];

  if (items.length === 0) return null;

  return (
    <span className="flex items-center gap-1 shrink-0">
      {items.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          title={item.label}
          aria-label={`${item.label} de ${user.displayName} (nouvel onglet)`}
          className="flex items-center justify-center h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        >
          {item.icon}
        </Link>
      ))}
    </span>
  );
}

export function UserRow({
  user,
  banning,
  banReason,
  onToggleBan,
  onBanReasonChange,
  onCancelBan,
  onConfirmBan,
  onUnban,
}: {
  user: AdminUser;
  banning: boolean;
  banReason: string;
  onToggleBan: () => void;
  onBanReasonChange: (value: string) => void;
  onCancelBan: () => void;
  onConfirmBan: () => void;
  onUnban: () => void;
}) {
  const isMaker = user.products.length >= 1;

  return (
    <div>
      <div className="flex gap-4 py-6 px-3 rounded-2xl hover:bg-muted/40 transition-colors">
        {/* Avatar → profil public */}
        <Link
          href={`/makers/${user.username}`}
          className="shrink-0 self-start hover:opacity-80 transition-opacity"
          aria-label={`Voir le profil de ${user.displayName}`}
        >
          <img
            src={user.avatarUrl}
            alt={user.displayName}
            className="w-14 h-14 rounded-full object-cover"
          />
        </Link>

        {/* Colonne centrale */}
        <div className="flex flex-col gap-3 min-w-0 flex-1">
          {/* Identité */}
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/makers/${user.username}`}
                className="text-[16px] font-extrabold tracking-tight text-foreground hover:text-primary transition-colors truncate"
              >
                {user.displayName}
              </Link>
              {user.role === "admin" ? (
                <span className="inline-flex items-center rounded border border-red-500/25 bg-red-500/10 px-1.5 py-px text-[9px] font-black uppercase tracking-[0.14em] text-red-600 dark:text-red-400 shrink-0">
                  Admin
                </span>
              ) : user.status === "banned" ? (
                <span className="inline-flex items-center rounded-md border border-red-500/25 bg-red-500/10 px-1.5 py-[3px] text-[9px] font-black uppercase tracking-[0.14em] leading-none text-red-600 dark:text-red-400 shrink-0">
                  Banni
                </span>
              ) : null}
              {isMaker && user.status === "active" && (
                <SealCheckIcon
                  weight="fill"
                  className="w-4 h-4 text-blue-500 shrink-0"
                  aria-label="Maker vérifié — au moins un produit publié"
                />
              )}
            </div>
            <p className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground truncate">
              <span className="truncate">@{user.username}</span>
              <span aria-hidden="true">·</span>
              <ProviderMark provider={user.provider} />
              <span aria-hidden="true">·</span>
              <span className="truncate">{user.joinedText}</span>
            </p>
          </div>

          {/* Produits + sociaux — split asymétrique */}
          <div className="flex items-center justify-between gap-4">
            <ProductStack user={user} />
            <SocialLinks user={user} />
          </div>

          {/* Email — donnée de lecture admin */}
          {user.email && (
            <p className="text-[12px] font-medium text-muted-foreground/70 truncate">
              {user.email}
            </p>
          )}

          {user.status === "banned" && user.banReason && (
            <p className="text-[12px] font-medium text-red-600 dark:text-red-400 leading-snug">
              Motif : {user.banReason} · Appels : {user.appeals}
            </p>
          )}
        </div>

        {/* Actions — centrées verticalement */}
        <div className="flex items-center self-center gap-1 shrink-0">
          {user.role !== "admin" &&
            (user.status === "banned" ? (
              <button
                type="button"
                onClick={onUnban}
                className="rounded-full border border-emerald-500/40 px-4 py-2 text-[13px] font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer whitespace-nowrap"
              >
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
                    : "border-border/40 text-muted-foreground hover:text-foreground hover:border-border/80 hover:bg-muted/50",
                )}
              >
                <GavelIcon weight="bold" className="w-4 h-4" />
                Bannir
              </button>
            ))}
        </div>
      </div>

      {/* Ban reason — inline, obligatoire */}
      {banning && user.status === "active" && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 pl-[84px] pr-3 pb-5">
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
              disabled={banReason.trim() === ""}
              className="rounded-full bg-red-600 px-4 py-2 text-[13px] font-bold text-white hover:bg-red-500 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Confirmer le ban
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
