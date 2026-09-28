"use client";

import Link from "next/link";
import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

interface PaginationProps {
  /** Page courante (1-based). */
  page: number;
  /** Nombre total de pages — vient du comptage réel en prod, jamais inventé. */
  totalPages: number;
  /** Construit le href d'une page (ex. (p) => `?w=week&page=${p}`). */
  buildHref: (page: number) => string;
  className?: string;
}

/**
 * Pagination Zero-UI partagée (discover + leaderboard).
 * Centrée via son wrapper w-full — l'asymétrie sidebar ne la décale pas.
 */
export function Pagination({ page, totalPages, buildHref, className }: PaginationProps) {
  if (totalPages <= 1) return null;
  const prev = Math.max(1, page - 1);
  const next = Math.min(totalPages, page + 1);

  // Fenêtre : 1 2 3 … N (premières pages + dernière).
  const windowed = [1, 2, 3].filter((p) => p <= totalPages);
  const showLast = totalPages > 4;

  return (
    <nav
      aria-label="Pagination"
      className={cn("w-full flex items-center justify-center gap-1 mt-8 pb-10", className)}
    >
      <PaginationLink href={buildHref(prev)} disabled={page <= 1} label="Page précédente">
        <CaretLeftIcon weight="bold" />
      </PaginationLink>

      {windowed.map((p) => (
        <PaginationLink
          key={p}
          href={buildHref(p)}
          isActive={p === page}
          label={`Page ${p}`}
          current={p === page}
        >
          {p}
        </PaginationLink>
      ))}

      {showLast && (
        <>
          <span
            aria-hidden="true"
            className="hidden sm:inline px-3 py-2 text-muted-foreground/50 select-none"
          >
            ...
          </span>
          <PaginationLink
            href={buildHref(totalPages)}
            isActive={totalPages === page}
            label={`Page ${totalPages}`}
            current={totalPages === page}
            className="hidden sm:flex"
          >
            {totalPages}
          </PaginationLink>
        </>
      )}

      <PaginationLink href={buildHref(next)} disabled={page >= totalPages} label="Page suivante">
        <CaretRightIcon weight="bold" />
      </PaginationLink>
    </nav>
  );
}

function PaginationLink({
  href,
  isActive,
  disabled,
  label,
  current,
  className,
  children,
}: {
  href: string;
  isActive?: boolean;
  disabled?: boolean;
  label: string;
  current?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span
        aria-label={label}
        aria-disabled="true"
        className={cn(
          "w-10 h-10 flex items-center justify-center rounded-full text-muted-foreground/30 font-semibold cursor-not-allowed select-none",
          className,
        )}
      >
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={current ? "page" : undefined}
      className={cn(
        "w-10 h-10 flex items-center justify-center rounded-full font-bold text-sm transition-all",
        isActive
          ? "bg-foreground text-background shadow-md border border-transparent scale-105"
          : "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95",
        className,
      )}
    >
      {children}
    </Link>
  );
}
