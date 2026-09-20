"use client";

import * as React from "react";
import Link from "next/link";
import {
  GridFourIcon,
  GearIcon,
  GithubLogoIcon,
  PlusIcon,
  SignOutIcon,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { ActionButton } from "@/components/ui/action-button";

// Mock user — will be replaced by the Supabase session when auth lands
const MOCK_USER = {
  name: "Kaliana R.",
  initials: "KR",
  avatarUrl: "https://i.pravatar.cc/150?u=kaliana",
  provider: "GitHub",
};

type UserMenuSize = "sm" | "lg";

export function UserMenu({ size = "lg" }: { size?: UserMenuSize }) {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Close on outside click + Escape (same pattern as ui/select.tsx)
  React.useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
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
          "rounded-full bg-[#EA580C] flex items-center justify-center text-white font-bold shadow-md transform transition hover:scale-105 cursor-pointer",
          size === "lg"
            ? "h-10 w-10 text-[14px]"
            : "h-8.5 w-8.5 text-[12px] shadow-sm",
          isOpen && "ring-2 ring-foreground/30 ring-offset-2 ring-offset-background",
        )}
      >
        {MOCK_USER.initials}
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-64 rounded-2xl border border-border/60 bg-background/95 backdrop-blur-2xl p-2.5 shadow-2xl flex flex-col gap-1"
        >
          {/* User header */}
          <div className="flex items-center gap-3 px-3 pt-2 pb-3 border-b border-border/40">
            <img
              src={MOCK_USER.avatarUrl}
              alt={MOCK_USER.name}
              className="h-10 w-10 rounded-full object-cover shrink-0"
            />
            <div className="flex flex-col gap-0.5 min-w-0">
              <Link
                href="/makers/kaliana"
                onClick={() => setIsOpen(false)}
                className="text-[15px] font-bold text-foreground hover:text-primary transition-colors truncate w-fit"
              >
                {MOCK_USER.name}
              </Link>
              <span className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
                <GithubLogoIcon weight="fill" className="h-3.5 w-3.5" />
                Connecté via {MOCK_USER.provider}
              </span>
            </div>
          </div>

          {/* Submit CTA */}
          <div className="pt-2">
            <ActionButton
              href="/products/submit"
              variant="primary"
              className="w-full! h-10! rounded-xl! px-4! text-[14px]! font-bold!"
              onClick={() => setIsOpen(false)}
            >
              <PlusIcon weight="bold" className="h-4 w-4" />
              Soumettre un produit
            </ActionButton>
          </div>

          <div className="w-full h-px bg-border/40 my-1" />

          {/* Menu items */}
          <UserMenuItem
            href="/dashboard"
            icon={<GridFourIcon weight="fill" className="h-5 w-5" />}
            title="Tableau de bord"
            onNavigate={() => setIsOpen(false)}
          />
          <UserMenuItem
            href="/settings"
            icon={<GearIcon weight="fill" className="h-5 w-5" />}
            title="Paramètres du compte"
            onNavigate={() => setIsOpen(false)}
          />
          <UserMenuItem
            href="/"
            icon={<SignOutIcon weight="bold" className="h-5 w-5" />}
            title="Se déconnecter"
            onNavigate={() => setIsOpen(false)}
          />
        </div>
      )}
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
