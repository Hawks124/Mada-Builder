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
  DownloadSimpleIcon,
  XIcon,
  StarIcon,
  LifebuoyIcon,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { LogoMark } from "@/components/ui/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import type { BadgeKey, BadgeState } from "@/app/api/admin/badges/route";

const ALL_BADGE_KEYS: BadgeKey[] = ["pending", "rejected", "builds", "contact"];

/**
 * État de pastille côté shell = contrat de la route + le motif de l'échec
 * HTTP quand la route n'a pas répondu (`reason`). Affiché dans la
 * infobulle : un compteur indisponible se diagnostique seul (401 = session,
 * 403 = rôle, 503 = backend), sans avoir à deviner depuis un 0 silencieux.
 */
type ShellBadgeState = BadgeState & { reason?: number | null };

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
    badgeKey: "pending" as const,
  },
  {
    href: "/admin/builds",
    label: "Binaires",
    icon: DownloadSimpleIcon,
    match: (pathname: string) => pathname.startsWith("/admin/builds"),
    badgeKey: "builds" as const,
  },
  {
    href: "/admin/rejected",
    label: "Rejetés",
    icon: XIcon,
    match: (pathname: string) => pathname.startsWith("/admin/rejected"),
    badgeKey: "rejected" as const,
  },
  {
    href: "/admin/featured",
    label: "Produit du jour",
    icon: StarIcon,
    match: (pathname: string) => pathname.startsWith("/admin/featured"),
  },
  {
    href: "/admin/contact",
    label: "Contact",
    icon: LifebuoyIcon,
    match: (pathname: string) => pathname.startsWith("/admin/contact"),
    badgeKey: "contact" as const,
  },
];

const STORAGE_KEY = "admin-sidebar-collapsed";

// Shell présentationnel (client). Garde session+rôle dans
// app/(admin)/layout.tsx (server) — défense en profondeur avec le middleware.
// Pastilles chargées en LAZY après mount (endpoint batché
// /api/admin/badges) : le shell s'ouvre instantanément, les compteurs
// « se complètent doucement ». Une stat lente/morte ne retient ni les
// autres clés ni la page — échec final = pastille « — », jamais page
// morte, jamais 0 mensonger (contrat {value, ok, at}).
// + table admin_actions (audit trail) à la migration.
export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [badges, setBadges] = React.useState<Partial<Record<BadgeKey, ShellBadgeState>>>({});

  React.useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    // Attentes de retry résolues AU MOMENT DU CLEANUP : un `clearTimeout`
    // seul laisserait la promesse d'endormie pour toujours (`await` bloqué
    // sur un setTimeout annulé) — l'effet fuite alors à chaque navigation.
    const waiters: (() => void)[] = [];

    const load = async (
      keys?: BadgeKey[],
    ): Promise<{ part: Partial<Record<BadgeKey, BadgeState>> | null; http: number | null }> => {
      try {
        const qs = keys && keys.length > 0 ? `?keys=${keys.join(",")}` : "";
        const res = await fetch(`/api/admin/badges${qs}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) return { part: null, http: res.status };
        const body = (await res.json()) as { data?: Partial<Record<BadgeKey, BadgeState>> };
        return { part: body.data ?? null, http: res.status };
      } catch {
        return { part: null, http: null };
      }
    };
    const merge = (part: Partial<Record<BadgeKey, BadgeState>> | null) => {
      if (part && !cancelled) setBadges((prev) => ({ ...prev, ...part }));
    };
    /**
     * Réponse HTTP en erreur = chiffre INCONNU, pas une file vide. On
     * matérialise `{ ok: false }` pour les clés visées : sans ça, aucune
     * pastille n'est rendue et l'admin lit l'absence comme « rien en
     * attente » (exactement le 0 qu'il voyait). Les retries qui suivent
     * écrasent ces marqueurs par la valeur réelle quand la route répond.
     */
    const markUnknown = (keys: BadgeKey[], http: number | null) => {
      if (cancelled) return;
      setBadges((prev) => {
        const next = { ...prev };
        for (const key of keys) {
          if (next[key]?.ok === true) continue;
          next[key] = { value: 0, ok: false, at: Date.now(), reason: http };
        }
        return next;
      });
    };
    // Retry auto des clés en échec SEULEMENT (jamais de re-clic) :
    // batch complet, puis 2 rattrapages espacés (1,5 s / 4 s), puis stop.
    const run = async () => {
      const first = await load();
      merge(first.part);
      if (!first.part) markUnknown(ALL_BADGE_KEYS, first.http);
      let failed = ALL_BADGE_KEYS.filter((k) => !first.part?.[k]?.ok);
      for (const delay of [1500, 4000]) {
        if (cancelled || failed.length === 0) return;
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, delay);
          waiters.push(() => {
            clearTimeout(timer);
            resolve();
          });
        });
        if (cancelled) return;
        const next = await load(failed);
        merge(next.part);
        if (!next.part) markUnknown(failed, next.http);
        failed = failed.filter((k) => !next.part?.[k]?.ok);
      }
    };
    void run();
    // Récupération sans clic : retour focus + navigation admin.
    const onFocus = () => {
      void run();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      controller.abort();
      waiters.forEach((w) => w());
      window.removeEventListener("focus", onFocus);
    };
  }, [pathname]);
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
          collapsed ? "w-19 px-3" : "w-64 px-4",
        )}
      >
        <AdminSidebarBody
          pathname={pathname}
          collapsed={collapsed}
          onToggle={toggle}
          badges={badges}
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
              badges={badges}
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
  badges,
}: {
  pathname: string;
  collapsed: boolean;
  onToggle?: () => void;
  onClose?: () => void;
  onNavigate?: () => void;
  /** Pastilles lazy (endpoint batché) — absentes = pas encore chargées. */
  badges: Partial<Record<BadgeKey, ShellBadgeState>>;
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
              <span className="font-bold text-lg tracking-tight">Mada-Made</span>
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
          // Contrat {value, ok, at} : un nombre ne s'affiche que si la
          // requête a RÉUSSI (ok) — sinon pastille « — » (inconnu, jamais
          // 0). Pas encore chargé = rien (le shell est déjà ouvert).
          const state = "badgeKey" in item ? badges[item.badgeKey as BadgeKey] : undefined;
          const badge = state?.ok === true && state.value > 0 ? state.value : 0;
          const unknown = state !== undefined && state.ok !== true;
          const attemptedAt =
            state !== undefined
              ? new Date(state.at).toLocaleTimeString("fr-FR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })
              : null;
          const unknownTitle =
            state?.reason != null
              ? `Compteur indisponible (HTTP ${state.reason}${
                  state.reason === 401
                    ? " — session expirée"
                    : state.reason === 403
                      ? " — rôle non reconnu"
                      : state.reason === 503
                        ? " — backend injoignable"
                        : ""
                })`
              : attemptedAt
                ? `Dernière tentative à ${attemptedAt} — réessaie tout seul`
                : "Chargement…";
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              title={collapsed ? item.label : undefined}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex items-center rounded-xl transition-colors",
                collapsed ? "justify-center px-0 py-3" : "gap-3 px-4 py-3 text-[15px]",
                isActive
                  ? "bg-muted/70 text-foreground font-bold"
                  : "text-muted-foreground font-medium hover:bg-muted/50 hover:text-foreground",
              )}
            >
              <Icon weight={isActive ? "fill" : "bold"} className="h-5 w-5 shrink-0" />
              {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
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
              {badge === 0 && unknown && (
                <span
                  aria-label="Compteur indisponible"
                  title={unknownTitle}
                  className={cn(
                    "rounded-full border border-border/60 text-muted-foreground text-[10px] font-black tabular-nums leading-none flex items-center justify-center",
                    collapsed
                      ? "absolute -top-1 -right-1 min-w-5 h-5 px-1"
                      : "ml-auto min-w-5 h-5 px-1",
                  )}
                >
                  —
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
            <span className="text-[14px] font-bold text-foreground leading-tight">Apparence</span>
            <span className="text-[12px] font-medium text-muted-foreground leading-tight">
              Thème clair / sombre
            </span>
          </div>
        )}
      </div>
    </>
  );
}
