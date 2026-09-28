"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SearchInput } from "@/components/ui/search-input";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ProductDropdown } from "./product-dropdown";
import { CommunityDropdown, FACEBOOK_GROUP_URL } from "./community-dropdown";
import { UserMenu } from "./user-menu";
import { LogoMark } from "@/components/ui/logo";
import {
  ListIcon,
  XIcon,
  CompassIcon,
  ArrowUpRightIcon,
  TrophyIcon,
  SquaresFourIcon,
  CoinsIcon,
  ShieldCheckIcon,
  FacebookLogoIcon,
  LifebuoyIcon,
} from "@phosphor-icons/react";

export type NavbarUser = {
  id: string;
  /** Slug maker (null si ligne DB absente : fallback démo). */
  username: string | null;
  name: string;
  initials: string;
  avatarUrl: string | null;
  /** Compte suspendu : badge + actions gelées (dashboard actif). */
  banned: boolean;
  provider: string | null;
} | null;

// Shell client — reçoit l'utilisateur résolu côté serveur.
// Anonyme : bouton "Se connecter" (CTA conversion principal de la nav).
export function NavbarShell({ user }: { user: NavbarUser }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [navQuery, setNavQuery] = React.useState("");
  const router = useRouter();

  // Block scrolling when mobile menu is open
  React.useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
  }, [isMobileMenuOpen]);

  // Alt+K global : focus le search visible prioritaire (page discover > nav).
  // Garde : jamais en cours de frappe. Le badge "Alt K" du SearchInput est réel.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.metaKey || e.ctrlKey) return;
      if (e.key.toLowerCase() !== "k") return;
      const el = e.target as HTMLElement | null;
      if (
        el != null &&
        (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)
      )
        return;
      const visible = (input: HTMLInputElement | null) =>
        input != null && input.offsetParent !== null;
      const primary = document.querySelector<HTMLInputElement>('input[data-search-primary="true"]');
      const target =
        primary != null && visible(primary)
          ? primary
          : Array.from(document.querySelectorAll<HTMLInputElement>('input[type="search"]')).find(
              visible,
            );
      if (target != null) {
        e.preventDefault();
        target.focus();
        target.select?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const submitNavSearch = () => {
    const q = navQuery.trim();
    setIsMobileMenuOpen(false);
    router.push(q !== "" ? `/discover?q=${encodeURIComponent(q)}` : "/discover");
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-background/30 backdrop-blur-xl border-b border-transparent">
      <div className="container mx-auto px-4 md:px-8 h-18 flex items-center justify-between">
        {/* Left: Logo & Nav Links */}
        <div className="flex items-center gap-10">
          <Link href="/" className="flex items-center gap-2 group">
            <LogoMark className="h-8 w-8 shadow-sm transform transition-all duration-300 group-hover:scale-110 group-hover:-rotate-6" />
            <span className="font-bold text-lg tracking-tight hidden lg:inline-block">
              Mada-Made
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-2">
            <Link
              href="/discover"
              className="flex items-center gap-2.5 px-3.5 py-2 text-[15px] font-medium text-muted-foreground hover:bg-muted/70 hover:text-foreground rounded-xl transition-all group"
            >
              <CompassIcon
                weight="bold"
                className="h-5 w-5 text-foreground/80 group-hover:text-foreground transition-colors"
              />
              Explorer
            </Link>
            <ProductDropdown />
            <CommunityDropdown />
          </nav>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3 sm:gap-4">
          <SearchInput
            variant="nav"
            placeholder="Rechercher des produits"
            value={navQuery}
            onChange={(e) => setNavQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitNavSearch();
            }}
          />

          <div className="hidden sm:flex items-center gap-3">
            <ThemeToggle />
            {user ? (
              <UserMenu size="lg" user={user} submitHref="/products/submit" />
            ) : (
              <Link
                href="/signin"
                className="inline-flex items-center justify-center h-10 px-5 rounded-full bg-foreground text-background text-[14px] font-bold hover:opacity-90 active:scale-[0.98] transition-all whitespace-nowrap"
              >
                Se connecter
              </Link>
            )}
          </div>

          <div className="md:hidden flex items-center gap-1.5">
            <ThemeToggle />
            {user ? (
              <UserMenu size="sm" user={user} submitHref="/products/submit" />
            ) : (
              <Link
                href="/signin"
                className="inline-flex items-center justify-center h-9 px-4 rounded-full bg-foreground text-background text-[13px] font-bold hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
              >
                Se connecter
              </Link>
            )}
            <button
              className="flex items-center justify-center text-foreground"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? (
                <div className="h-10 w-10 rounded-xl bg-muted/60 flex items-center justify-center transition-colors">
                  <XIcon weight="bold" className="h-5 w-5" />
                </div>
              ) : (
                <div className="h-10 w-10 rounded-xl flex items-center justify-center transition-colors hover:bg-muted/40">
                  <ListIcon weight="bold" className="h-6 w-6" />
                </div>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-18 left-0 w-full h-[calc(100vh-72px)] bg-background/95 backdrop-blur-xl p-6 flex flex-col gap-6 z-40 border-t border-border/40 overflow-y-auto">
          <div className="w-full mb-2">
            <SearchInput
              variant="page"
              placeholder="Rechercher des produits..."
              value={navQuery}
              onChange={(e) => setNavQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitNavSearch();
              }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <MobileNavItem
              href="/discover"
              icon={<CompassIcon weight="fill" className="h-6 w-6" />}
              label="Explorer"
              onClick={() => setIsMobileMenuOpen(false)}
            />

            <div className="mt-8 mb-4">
              <span className="text-[13px] font-bold text-muted-foreground tracking-widest uppercase ml-1">
                Communauté
              </span>
            </div>

            <MobileNavItem
              href="/regles"
              icon={<ShieldCheckIcon weight="fill" className="h-6 w-6" />}
              label="Charte de la communauté"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <MobileNavItem
              href={FACEBOOK_GROUP_URL}
              icon={<FacebookLogoIcon weight="fill" className="h-6 w-6" />}
              label="Groupe Facebook"
              external
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <MobileNavItem
              icon={<LifebuoyIcon weight="fill" className="h-6 w-6" />}
              label="Contact"
              badge="Bientôt"
              dead
            />

            <div className="mt-8 mb-4">
              <span className="text-[13px] font-bold text-muted-foreground tracking-widest uppercase ml-1">
                Produits
              </span>
            </div>

            <MobileNavItem
              href="/leaderboard"
              icon={<TrophyIcon weight="fill" className="h-6 w-6" />}
              label="Classement"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <MobileNavItem
              href="/categories"
              icon={<SquaresFourIcon weight="fill" className="h-6 w-6" />}
              label="Catégories"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <MobileNavItem
              href="/revenue"
              icon={<CoinsIcon weight="fill" className="h-6 w-6" />}
              label="Revenus vérifiés"
              onClick={() => setIsMobileMenuOpen(false)}
            />
          </div>
        </div>
      )}
    </header>
  );
}

function MobileNavItem({
  href,
  icon,
  label,
  onClick,
  external,
  badge,
  dead,
}: {
  href?: string;
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  external?: boolean;
  badge?: string;
  dead?: boolean;
}) {
  const inner = (
    <>
      <div className="flex items-center gap-4 text-foreground font-semibold text-[19px]">
        <span className="text-foreground/90 group-hover:text-foreground transition-colors">
          {icon}
        </span>
        {label}
        {badge && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            {badge}
          </span>
        )}
      </div>
      {!dead && (
        <ArrowUpRightIcon
          weight="bold"
          className="h-5 w-5 text-muted-foreground/60 group-hover:text-foreground transition-colors"
        />
      )}
    </>
  );

  const className =
    "flex items-center justify-between p-3.5 -mx-3.5 rounded-2xl transition-colors group";

  if (dead) {
    return <div className={`${className} opacity-60 cursor-default`}>{inner}</div>;
  }

  return (
    <Link
      href={href ?? "#"}
      onClick={onClick}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={`${className} hover:bg-muted/60`}
    >
      {inner}
    </Link>
  );
}
