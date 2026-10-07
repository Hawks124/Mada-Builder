"use client";

import * as React from "react";
import Link from "next/link";
import { BellIcon, SealCheckIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";

export type BellNotification = {
  id: string;
  title: string;
  time: string;
  tone: "success" | "alert";
  /** Visuel réel (logo produit > avatar acteur) — sinon icône de tone. */
  image?: string | null;
};

const TONE_ICON: Record<BellNotification["tone"], React.ReactNode> = {
  success: <SealCheckIcon weight="fill" className="h-5 w-5 text-emerald-500 shrink-0" />,
  alert: <WarningCircleIcon weight="fill" className="h-5 w-5 text-red-500 shrink-0" />,
};

// Cloche maker — notifications RÉELLES (emails liés à ses produits +
// paliers). Pastille = non-lues réelles (colonne read_at). Jamais de mock.
export function NotificationsBell({
  initial,
  unreadCount,
}: {
  initial: BellNotification[];
  unreadCount: number;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

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
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} non lues` : ""}`}
        className={cn(
          "relative flex h-11 w-11 items-center justify-center rounded-full border transition-colors cursor-pointer",
          isOpen
            ? "border-foreground/30 bg-muted/60 text-foreground"
            : "border-border/60 bg-background text-muted-foreground hover:text-foreground hover:border-foreground/30 hover:bg-muted/50",
        )}
      >
        <BellIcon weight="bold" className="h-5 w-5" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-600 text-white text-[10px] font-black tabular-nums leading-none flex items-center justify-center shadow-sm"
            aria-hidden="true"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-80 rounded-2xl border border-border/60 bg-background/95 backdrop-blur-2xl p-2.5 shadow-2xl flex flex-col gap-1"
        >
          <p className="px-3 pt-2 pb-1 text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">
            Notifications
          </p>
          {initial.length === 0 ? (
            <EmptyState
              illustration="none"
              size="sm"
              title="Aucune notification."
              description="Les décisions de la revue apparaîtront ici."
            />
          ) : (
            initial.map((notif) => (
              <div
                key={notif.id}
                className="flex items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-muted/60 transition-colors"
              >
                {notif.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={notif.image}
                    alt=""
                    loading="lazy"
                    className="h-5 w-5 rounded-full object-cover shrink-0"
                  />
                ) : (
                  TONE_ICON[notif.tone]
                )}
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <span className="text-[14px] leading-snug font-medium text-foreground">
                    {notif.title}
                  </span>
                  <span className="text-[12px] font-medium text-muted-foreground/70">
                    {notif.time}
                  </span>
                </div>
              </div>
            ))
          )}
          {initial.length > 0 && (
            <Link
              href="/dashboard/notifications"
              className="mx-1 mt-1 rounded-xl px-3 py-2.5 text-center text-[13px] font-bold text-foreground hover:bg-muted/60 transition-colors"
            >
              Tout voir
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
