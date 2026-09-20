"use client";

import * as React from "react";
import {
  BellIcon,
  SealCheckIcon,
  CaretUpIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

type NotificationTone = "success" | "milestone" | "alert";

type DashboardNotification = {
  id: string;
  tone: NotificationTone;
  title: string;
  time: string;
  unread: boolean;
};

const MOCK_NOTIFICATIONS: DashboardNotification[] = [
  {
    id: "n1",
    tone: "success",
    title: "Avotra HR a été approuvé",
    time: "il y a 2 h",
    unread: true,
  },
  {
    id: "n2",
    tone: "milestone",
    title: "TsenaConnect a dépassé 100 votes",
    time: "hier",
    unread: true,
  },
  {
    id: "n3",
    tone: "alert",
    title: "Sync RevenueCat échouée pour Vatsy",
    time: "il y a 3 j",
    unread: false,
  },
];

const TONE_ICON: Record<NotificationTone, React.ReactNode> = {
  success: (
    <SealCheckIcon weight="fill" className="h-5 w-5 text-emerald-500 shrink-0" />
  ),
  milestone: (
    <CaretUpIcon weight="fill" className="h-5 w-5 text-amber-500 shrink-0" />
  ),
  alert: (
    <WarningCircleIcon weight="fill" className="h-5 w-5 text-red-500 shrink-0" />
  ),
};

// Circular bell + unread dot, next to the submit CTA.
// Same open/close pattern as ui/select.tsx.
export function NotificationsBell() {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const unreadCount = MOCK_NOTIFICATIONS.filter((n) => n.unread).length;

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
            {unreadCount}
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
          {MOCK_NOTIFICATIONS.map((notif) => (
            <div
              key={notif.id}
              className="flex items-start gap-3 rounded-xl px-3 py-2.5 hover:bg-muted/60 transition-colors"
            >
              {TONE_ICON[notif.tone]}
              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                <span
                  className={cn(
                    "text-[14px] leading-snug",
                    notif.unread
                      ? "font-bold text-foreground"
                      : "font-medium text-muted-foreground",
                  )}
                >
                  {notif.title}
                </span>
                <span className="text-[12px] font-medium text-muted-foreground/70">
                  {notif.time}
                </span>
              </div>
              {notif.unread && (
                <span
                  className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0"
                  aria-hidden="true"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
