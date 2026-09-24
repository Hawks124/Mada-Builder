"use client";
import * as React from "react";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  SquaresFourIcon,
  UserCircleIcon,
  GearIcon,
  KeyIcon,
  PlusIcon,
  SignOutIcon,
  FilesIcon,
  GithubLogoIcon,
  CaretDoubleLeftIcon,
  CaretDoubleRightIcon,
  ListIcon,
  XIcon,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { SignOutConfirm } from "@/components/auth/signout-confirm";
import { AvatarImage } from "@/components/ui/avatar-image";
import { useBanWatcher } from "@/lib/supabase/use-ban-watcher";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { LogoMark } from "@/components/ui/logo";
import { hasUnsavedChanges } from "@/lib/unsaved-guard";

const NAV_ITEMS = [
  {
    href: "/dashboard",
    label: "Vue d'ensemble",
    icon: SquaresFourIcon,
    match: (pathname: string) =>
      pathname === "/dashboard" || pathname.startsWith("/dashboard/products"),
  },
  {
    href: "/dashboard/profile",
    label: "Profil",
    icon: UserCircleIcon,
    match: (pathname: string) => pathname === "/dashboard/profile",
  },
  {
    href: "/dashboard/api",
    label: "Clés API",
    icon: KeyIcon,
    match: (pathname: string) => pathname === "/dashboard/api",
  },
  {
    href: "/dashboard/drafts",
    label: "Brouillons",
    icon: FilesIcon,
    match: (pathname: string) => pathname === "/dashboard/drafts",
  },
  {
    href: "/settings",
    label: "Paramètres",
    icon: GearIcon,
    match: (pathname: string) => pathname === "/settings",
  },
];

const STORAGE_KEY = "dashboard-sidebar-collapsed";

// Full-page shell — no global navbar here (public pages live under (site)).
// Mobile-first: slim top bar + slide-over drawer reusing the same sidebar.
// Garde session dans app/(dashboard)/layout.tsx (server) — ce shell est
// purement présentationnel (client : sidebar state, drawer, pathname).
export type SidebarUser = {
  name: string;
  initials: string;
  avatarUrl: string | null;
} | null;

export default function DashboardShell({
  children,
  sidebarUser = null,
  userId = null,
}: {
  children: React.ReactNode;
  /** Identité réelle (layout server) — null = fallback démo. */
  sidebarUser?: SidebarUser;
  /** Id auth (layout server) — watcher ban temps réel, null = inactif. */
  userId?: string | null;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [signoutOpen, setSignoutOpen] = React.useState(false);

  // Déconnexion confirmée (dialog partagé, rendu une seule fois) — ferme
  // aussi le drawer mobile avant d'ouvrir.
  const openSignOut = () => {
    setMobileOpen(false);
    setSignoutOpen(true);
  };

  // Temps réel : ban/déban sans refresh manuel (toast + refresh ciblé).
  useBanWatcher(userId);

  // Restore persisted state without SSR mismatch (localStorage is an
  // external system — reading it post-mount is the correct pattern here).
  React.useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(STORAGE_KEY) === "1") setCollapsed(true);
    } catch {
      /* private mode — stay expanded */
    }
  }, []);

  // Drawer: Escape to close + body scroll lock
  React.useEffect(() => {
    if (!mobileOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-background flex items-start">
      {/* Sidebar — desktop */}
      <aside
        className={cn(
          "hidden lg:flex shrink-0 flex-col border-r border-border/40 sticky top-0 h-screen py-6 transition-all duration-300",
          collapsed ? "w-19 px-3" : "w-64 px-4",
        )}
      >
        <SidebarBody
          pathname={pathname}
          collapsed={collapsed}
          onToggle={toggle}
          onSignOut={openSignOut}
          sidebarUser={sidebarUser}
        />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute left-0 top-0 h-full w-72 bg-background border-r border-border/40 px-4 py-6 overflow-y-auto flex flex-col">
            <SidebarBody
              pathname={pathname}
              collapsed={false}
              onClose={() => setMobileOpen(false)}
              onNavigate={() => setMobileOpen(false)}
              onSignOut={openSignOut}
              sidebarUser={sidebarUser}
            />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-40 flex items-center justify-between h-14 px-4 border-b border-border/40 bg-background/90 backdrop-blur-xl">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Ouvrir le menu"
            className="flex items-center justify-center h-10 w-10 -ml-2 rounded-xl text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
          >
            <ListIcon weight="bold" className="h-6 w-6" />
          </button>
          <div
            className="h-8 w-8 rounded-full bg-[#EA580C] flex items-center justify-center text-white font-bold text-[11px] shrink-0 overflow-hidden"
            title={sidebarUser?.name ?? "Kaliana R."}
          >
            {sidebarUser?.avatarUrl ? (
              <AvatarImage src={sidebarUser.avatarUrl} name={sidebarUser.name} size={32} />
            ) : (
              (sidebarUser?.initials ?? "KR")
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0">{children}</div>
      </div>
      <SignOutConfirm open={signoutOpen} onCancel={() => setSignoutOpen(false)} />
    </div>
  );
}

function SidebarBody({
  pathname,
  collapsed,
  onToggle,
  onClose,
  onNavigate,
  onSignOut,
  sidebarUser,
}: {
  pathname: string;
  collapsed: boolean;
  onToggle?: () => void;
  onClose?: () => void;
  onNavigate?: () => void;
  onSignOut: () => void;
  sidebarUser: SidebarUser;
}) {
  const router = useRouter();
  // Sortie gardée : lien ou déconnexion en attente de confirmation.
  const [confirmNav, setConfirmNav] = React.useState<{ href: string } | { signout: true } | null>(
    null,
  );

  // Intercepte les sorties quand un formulaire est sale (le beforeunload
  // natif ne couvre QUE refresh/fermeture — pas la navigation SPA).
  // Lien vers la page courante = jamais bloqué (pas de perte possible).
  const guarded = (href: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (href === pathname || !hasUnsavedChanges()) {
      onNavigate?.();
      return;
    }
    e.preventDefault();
    setConfirmNav({ href });
  };

  const confirmLeave = () => {
    const target = confirmNav;
    setConfirmNav(null);
    if (!target) return;
    onNavigate?.();
    if ("signout" in target) {
      onSignOut();
    } else {
      router.push(target.href);
    }
  };

  return (
    <>
      <ConfirmDialog
        open={confirmNav !== null}
        title="Modifications non enregistrées ?"
        description="Quitter maintenant fera perdre vos modifications. Enregistrez d'abord pour les conserver."
        confirmLabel="Quitter sans enregistrer"
        onConfirm={confirmLeave}
        onCancel={() => setConfirmNav(null)}
      />
      {/* Logo + toggle / close */}
      <div
        className={cn(
          "flex items-center mb-8",
          collapsed ? "flex-col gap-4" : "justify-between px-2",
        )}
      >
        <Link
          href="/"
          onClick={guarded("/")}
          className="flex items-center gap-2 group"
          aria-label="Retour à l'accueil"
        >
          <LogoMark className="h-8 w-8 shrink-0 shadow-sm transform transition-all duration-300 group-hover:scale-110 group-hover:-rotate-6" />
          {!collapsed && (
            <span className="font-bold text-lg tracking-tight whitespace-nowrap">Mada-Made</span>
          )}
        </Link>
        {onToggle && (
          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? "Agrandir la sidebar" : "Réduire la sidebar"}
            aria-pressed={collapsed}
            className="flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors cursor-pointer shrink-0"
          >
            {collapsed ? (
              <CaretDoubleRightIcon weight="bold" className="h-4 w-4" />
            ) : (
              <CaretDoubleLeftIcon weight="bold" className="h-4 w-4" />
            )}
          </button>
        )}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer le menu"
            className="flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors cursor-pointer shrink-0"
          >
            <XIcon weight="bold" className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Submit CTA — always visible */}
      <Link
        href="/products/submit"
        onClick={guarded("/products/submit")}
        title="Soumettre un produit"
        className={cn(
          "flex items-center justify-center gap-2 rounded-full bg-foreground text-background font-bold transition-all hover:opacity-90 active:scale-[0.98] mb-6 shrink-0",
          collapsed ? "h-11 w-11 mx-auto" : "h-11 w-full px-5 text-[14px]",
        )}
      >
        <PlusIcon weight="bold" className="h-4 w-4 shrink-0" />
        {!collapsed && <span className="whitespace-nowrap">Nouveau produit</span>}
      </Link>

      {/* Nav */}
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive = item.match(pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={guarded(item.href)}
              title={collapsed ? item.label : undefined}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex items-center rounded-xl transition-colors",
                collapsed ? "justify-center px-0 py-3" : "gap-3 px-4 py-3 text-[15px]",
                isActive
                  ? "bg-muted/70 text-foreground font-bold"
                  : "text-muted-foreground font-medium hover:bg-muted/50 hover:text-foreground",
              )}
            >
              <Icon weight={isActive ? "fill" : "bold"} className="h-5 w-5 shrink-0" />
              {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
            </Link>
          );
        })}

        {/* Sign out — last, red-tinted, confirmé via dialog partagé */}
        <div className={cn(!collapsed && "mt-1 pt-1 border-t border-border/40")}>
          <button
            type="button"
            onClick={() => {
              if (hasUnsavedChanges()) {
                setConfirmNav({ signout: true });
                return;
              }
              onNavigate?.();
              onSignOut();
            }}
            title={collapsed ? "Se déconnecter" : undefined}
            aria-label="Se déconnecter"
            className={cn(
              "w-full flex items-center rounded-xl transition-colors cursor-pointer",
              collapsed ? "justify-center px-0 py-3" : "gap-3 px-4 py-3 text-[15px]",
              "text-muted-foreground font-medium hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400",
            )}
          >
            <SignOutIcon weight="bold" className="h-5 w-5 shrink-0" />
            {!collapsed && <span className="whitespace-nowrap">Se déconnecter</span>}
          </button>
        </div>
      </nav>

      {/* User footer — no container, provider icon inline + theme toggle */}
      <div
        className={cn(
          "mt-auto flex items-center border-t border-border/40 pt-4",
          collapsed ? "flex-col gap-3 justify-center" : "gap-2.5 px-2",
        )}
      >
        <div
          className="h-9 w-9 rounded-full bg-[#EA580C] flex items-center justify-center text-white font-bold text-[12px] shrink-0 overflow-hidden"
          title={sidebarUser?.name ?? "Kaliana R."}
        >
          {sidebarUser?.avatarUrl ? (
            <AvatarImage src={sidebarUser.avatarUrl} name={sidebarUser.name} size={36} />
          ) : (
            (sidebarUser?.initials ?? "KR")
          )}
        </div>
        {!collapsed && (
          <div className="flex flex-col min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-[14px] font-bold text-foreground truncate">
              {sidebarUser?.name ?? "Kaliana R."}
              <GithubLogoIcon
                weight="fill"
                className="h-3.5 w-3.5 text-muted-foreground shrink-0"
              />
            </span>
            <span className="text-[12px] font-medium text-muted-foreground truncate">
              via GitHub
            </span>
          </div>
        )}
        <ThemeToggle />
      </div>
    </>
  );
}
