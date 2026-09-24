"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SquaresFourIcon,
  UsersIcon,
  PackageIcon,
  HourglassIcon,
  CaretDoubleLeftIcon,
  CaretDoubleRightIcon,
  ListIcon,
  XIcon,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { MOCK_REVIEW_QUEUE } from "@/components/admin/admin-mock";

const NAV_ITEMS = [
  {
    href: "/admin",
    label: "Vue d'ensemble",
    icon: SquaresFourIcon,
    match: (pathname: string) => pathname === "/admin",
  },
  {
    href: "/admin/users",
    label: "Utilisateurs",
    icon: UsersIcon,
    match: (pathname: string) => pathname === "/admin/users",
  },
  {
    href: "/admin/products",
    label: "Produits",
    icon: PackageIcon,
    match: (pathname: string) => pathname === "/admin/products",
  },
  {
    href: "/admin/review",
    label: "En revue",
    icon: HourglassIcon,
    match: (pathname: string) => pathname === "/admin/review",
    badgeCount: MOCK_REVIEW_QUEUE.length,
  },
];

const STORAGE_KEY = "admin-sidebar-collapsed";

// Shell présentationnel (client). Garde session+rôle dans
// app/(admin)/layout.tsx (server) — défense en profondeur avec le middleware.
// + table admin_actions (audit trail) à la migration.
export default function AdminShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (localStorage.getItem(STORAGE_KEY) === "1") setCollapsed(true);
    } catch {
      /* private mode — stay expanded */
    }
  }, []);

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
          collapsed ? "w-[76px] px-3" : "w-64 px-4",
        )}
      >
        <AdminSidebarBody
          pathname={pathname}
          collapsed={collapsed}
          onToggle={toggle}
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
            <AdminSidebarBody
              pathname={pathname}
              collapsed={false}
              onClose={() => setMobileOpen(false)}
              onNavigate={() => setMobileOpen(false)}
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
          <span className="rounded-md border border-red-500/25 bg-red-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-red-600 dark:text-red-400">
            Admin
          </span>
        </div>

        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}

function AdminSidebarBody({
  pathname,
  collapsed,
  onToggle,
  onClose,
  onNavigate,
}: {
  pathname: string;
  collapsed: boolean;
  onToggle?: () => void;
  onClose?: () => void;
  onNavigate?: () => void;
}) {
  return (
    <>
      {/* Logo + admin mark + toggle / close */}
      <div
        className={cn(
          "flex items-center mb-2",
          collapsed ? "flex-col gap-4" : "justify-between px-2",
        )}
      >
        <Link
          href="/"
          onClick={onNavigate}
          className="flex items-center gap-2 group"
          aria-label="Retour à l'accueil"
        >
          <LogoMark className="h-8 w-8 shrink-0 shadow-sm transform transition-all duration-300 group-hover:scale-110 group-hover:-rotate-6" />
          {!collapsed && (
            <span className="flex items-center gap-2 whitespace-nowrap">
              <span className="font-bold text-lg tracking-tight">
                Mada-Made
              </span>
              <span className="rounded-md border border-red-500/25 bg-red-500/10 px-1.5 py-px text-[9px] font-black uppercase tracking-[0.14em] text-red-600 dark:text-red-400">
                Admin
              </span>
            </span>
          )}
        </Link>
        {onToggle && (
          <button
            type="button"
            onClick={onToggle}
            aria-label={
              collapsed ? "Agrandir la sidebar" : "Réduire la sidebar"
            }
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

      {!collapsed && (
        <p className="px-2 mb-6 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground/70">
          Zone restreinte
        </p>
      )}
      {collapsed && <div className="mb-6" aria-hidden="true" />}

      {/* Nav */}
      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive = item.match(pathname);
          const Icon = item.icon;
          const badge = "badgeCount" in item ? (item.badgeCount as number) : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              title={collapsed ? item.label : undefined}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex items-center rounded-xl transition-colors",
                collapsed
                  ? "justify-center px-0 py-3"
                  : "gap-3 px-4 py-3 text-[15px]",
                isActive
                  ? "bg-muted/70 text-foreground font-bold"
                  : "text-muted-foreground font-medium hover:bg-muted/50 hover:text-foreground",
              )}
            >
              <Icon
                weight={isActive ? "fill" : "bold"}
                className="h-5 w-5 shrink-0"
              />
              {!collapsed && (
                <span className="whitespace-nowrap">{item.label}</span>
              )}
              {badge > 0 && (
                <span
                  aria-label={`${badge} en attente`}
                  className={cn(
                    "rounded-full bg-amber-500 text-white text-[10px] font-black tabular-nums leading-none flex items-center justify-center shadow-sm",
                    collapsed
                      ? "absolute -top-1 -right-1 min-w-5 h-5 px-1"
                      : "ml-auto min-w-5 h-5 px-1",
                  )}
                >
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer — labeled theme toggle (no dry icon, no user card:
          identity lives next to the logo). */}
      <div
        className={cn(
          "mt-auto flex items-center border-t border-border/40 pt-4",
          collapsed ? "justify-center" : "gap-3 px-2",
        )}
      >
        <ThemeToggle />
        {!collapsed && (
          <div className="flex flex-col min-w-0">
            <span className="text-[14px] font-bold text-foreground leading-tight">
              Apparence
            </span>
            <span className="text-[12px] font-medium text-muted-foreground leading-tight">
              Thème clair / sombre
            </span>
          </div>
        )}
      </div>
    </>
  );
}
