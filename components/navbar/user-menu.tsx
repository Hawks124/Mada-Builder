"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  GridFourIcon,
  GearIcon,
  GithubLogoIcon,
  PlusIcon,
  SignOutIcon,
  EnvelopeIcon,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { ActionButton } from "@/components/ui/action-button";
import { SignOutConfirm } from "@/components/auth/signout-confirm";
import { AvatarImage } from "@/components/ui/avatar-image";
import { useBanWatcher } from "@/lib/supabase/use-ban-watcher";

export type UserMenuUser = {
  id: string;
  username: string | null;
  name: string;
  initials: string;
  avatarUrl: string | null;
  /** Compte suspendu : badge + gel (dashboard + déconnexion actifs). */
  banned: boolean;
  provider: string | null;
};

type UserMenuSize = "sm" | "lg";

export function UserMenu({
  size = "lg",
  user,
  submitHref = "/products/submit",
}: {
  size?: UserMenuSize;
  user: UserMenuUser;
  /** Login wall explicite pour les anonymes redirigés (jamais en menu). */
  submitHref?: string;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [signoutOpen, setSignoutOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Temps réel : ban/déban sans refresh (toast + refresh ciblé).
  useBanWatcher(user.id);

  // Close on outside click + Escape (same pattern as ui/select.tsx)
  React.useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      {/* Avatar trigger */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="Menu utilisateur"
        className={cn(
          "rounded-full bg-[#EA580C] flex items-center justify-center text-white font-bold shadow-md transform transition hover:scale-105 cursor-pointer overflow-hidden",
          size === "lg" ? "h-10 w-10 text-[14px]" : "h-8.5 w-8.5 text-[12px] shadow-sm",
          isOpen && "ring-2 ring-foreground/30 ring-offset-2 ring-offset-background",
        )}
      >
        {user.avatarUrl ? (
          <AvatarImage src={user.avatarUrl} name={user.name} size={size === "lg" ? 40 : 34} />
        ) : (
          user.initials
        )}
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-64 rounded-2xl border border-border/60 bg-background/95 backdrop-blur-2xl p-2.5 shadow-2xl flex flex-col gap-1"
        >
          {/* User header */}
          <div className="flex items-center gap-3 px-3 pt-2 pb-3 border-b border-border/40">
            {user.avatarUrl ? (
              <AvatarImage src={user.avatarUrl} name={user.name} size={40} />
            ) : (
              <span
                aria-hidden="true"
                className="h-10 w-10 rounded-full bg-[#EA580C] flex items-center justify-center text-white font-bold text-[13px] shrink-0"
              >
                {user.initials}
              </span>
            )}
            <div className="flex flex-col gap-0.5 min-w-0">
              {/* Vrai username DB ; fallback démo sans backend. */}
              <span className="flex items-center gap-2 min-w-0">
                <Link
                  href={user.username ? `/makers/${user.username}` : "/makers/kaliana"}
                  onClick={() => setIsOpen(false)}
                  className="text-[15px] font-bold text-foreground hover:text-primary transition-colors truncate w-fit"
                >
                  {user.name}
                </Link>
                {user.banned && (
                  <span className="inline-flex items-center rounded-md border border-red-500/25 bg-red-500/10 px-1.5 py-[3px] text-[9px] font-black uppercase tracking-[0.14em] leading-none text-red-600 dark:text-red-400 shrink-0">
                    Suspendu
                  </span>
                )}
              </span>
              {user.provider && (
                <span className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
                  <ProviderMark provider={user.provider} />
                  Connecté via {user.provider}
                </span>
              )}
            </div>
          </div>

          {/* Submit CTA — gelé si suspendu (le dashboard reste la porte). */}
          <div className="pt-2">
            {user.banned ? (
              <span
                title="Compte suspendu"
                aria-disabled="true"
                className="w-full! h-10! rounded-xl! px-4! text-[14px]! font-bold! inline-flex items-center justify-center gap-2 opacity-40 cursor-not-allowed bg-muted text-muted-foreground"
              >
                <PlusIcon weight="bold" className="h-4 w-4" />
                Soumettre un produit
              </span>
            ) : (
              <ActionButton
                href={submitHref}
                variant="primary"
                className="w-full! h-10! rounded-xl! px-4! text-[14px]! font-bold!"
                onClick={() => setIsOpen(false)}
              >
                <PlusIcon weight="bold" className="h-4 w-4" />
                Soumettre un produit
              </ActionButton>
            )}
          </div>

          <div className="w-full h-px bg-border/40 my-1" />

          {/* Menu items — dashboard ACTIF (chemin vers l'appel), params gelés. */}
          <UserMenuItem
            href="/dashboard"
            icon={<GridFourIcon weight="fill" className="h-5 w-5" />}
            title="Tableau de bord"
            onNavigate={() => setIsOpen(false)}
          />
          {user.banned ? (
            <span
              title="Compte suspendu"
              aria-disabled="true"
              className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-[15px] font-medium text-muted-foreground/50 cursor-not-allowed group/item"
            >
              <span className="text-foreground/40 transition-colors">
                <GearIcon weight="fill" className="h-5 w-5" />
              </span>
              Paramètres du compte
            </span>
          ) : (
            <UserMenuItem
              href="/settings"
              icon={<GearIcon weight="fill" className="h-5 w-5" />}
              title="Paramètres du compte"
              onNavigate={() => setIsOpen(false)}
            />
          )}
          {/* Déconnexion — confirmée (ton neutre : pas une destruction). */}
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              setSignoutOpen(true);
            }}
            className="w-full flex items-center gap-3.5 rounded-xl px-4 py-3 text-[15px] font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors group/item cursor-pointer"
          >
            <span className="text-foreground/80 group-hover/item:text-foreground transition-colors">
              <SignOutIcon weight="bold" className="h-5 w-5" />
            </span>
            Se déconnecter
          </button>
        </div>
      )}
      <SignOutConfirm open={signoutOpen} onCancel={() => setSignoutOpen(false)} />
    </div>
  );
}

function UserMenuItem({
  href,
  title,
  icon,
  onNavigate,
}: {
  href: string;
  title: string;
  icon: React.ReactNode;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-[15px] font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors group/item"
    >
      <span className="text-foreground/80 group-hover/item:text-foreground transition-colors">
        {icon}
      </span>
      {title}
    </Link>
  );
}

// Icône du VRAI provider (jamais hardcodée — cf. bug "logo GitHub sur
// session Google"). Google = logo officiel, GitHub = mark, Email = enveloppe.
function ProviderMark({ provider }: { provider: string }) {
  if (provider === "Google") {
    return (
      <Image
        src="/logos/google.svg"
        alt=""
        aria-hidden="true"
        width={14}
        height={14}
        className="h-3.5 w-3.5 shrink-0"
      />
    );
  }
  if (provider === "GitHub") {
    return <GithubLogoIcon weight="fill" className="h-3.5 w-3.5" />;
  }
  return <EnvelopeIcon weight="bold" className="h-3.5 w-3.5" />;
}
