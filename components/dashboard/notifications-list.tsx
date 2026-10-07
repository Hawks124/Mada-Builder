"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SealCheckIcon, WarningCircleIcon, TrophyIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import type { NotificationItem } from "@/services/notifications.service";
import { markAllNotificationsRead } from "@/app/actions/notifications";

const KIND_ICON: Record<string, React.ReactNode> = {
  product_approved: <SealCheckIcon weight="fill" className="h-5 w-5 text-emerald-500 shrink-0" />,
  product_rejected: <WarningCircleIcon weight="fill" className="h-5 w-5 text-red-500 shrink-0" />,
  product_removed: <WarningCircleIcon weight="fill" className="h-5 w-5 text-red-500 shrink-0" />,
  vote_milestone: <TrophyIcon weight="fill" className="h-5 w-5 text-amber-500 shrink-0" />,
  view_milestone: <TrophyIcon weight="fill" className="h-5 w-5 text-amber-500 shrink-0" />,
};

function timeAgoFr(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "à l'instant";
  const m = Math.floor(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "hier";
  if (d < 7) return `il y a ${d} j`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

/** Historique paginé (serveur en props initiales, "charger plus" client). */
export function NotificationsList({
  initial,
  initialCursor,
  unreadCount,
}: {
  initial: NotificationItem[];
  /** Curseur opaque (déjà encodé côté serveur, jamais de JSON brut en URL). */
  initialCursor: string | null;
  unreadCount: number;
}) {
  const router = useRouter();
  const [marking, setMarking] = React.useState(false);

  const markAll = async () => {
    setMarking(true);
    await markAllNotificationsRead();
    setMarking(false);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-[13px] font-bold text-muted-foreground tabular-nums">
          {unreadCount > 0 ? `${unreadCount} non lue${unreadCount > 1 ? "s" : ""}` : "Tout est lu"}
        </p>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAll}
            disabled={marking}
            className="text-[13px] font-bold text-foreground underline decoration-border/60 underline-offset-4 hover:decoration-foreground transition-colors cursor-pointer disabled:opacity-50"
          >
            {marking ? "…" : "Tout marquer comme lu"}
          </button>
        )}
      </div>

      {initial.length === 0 ? (
        <EmptyState
          title="Aucune notification pour le moment."
          description="Les décisions de la revue, les votes et les paliers apparaîtront ici."
        />
      ) : (
        <div className="flex flex-col">
          {initial.map((n) => (
            <div
              key={n.id}
              className={cn(
                "flex items-start gap-3 py-3 px-3 rounded-2xl",
                n.readAt === null && "bg-muted/40",
              )}
            >
              {(n.productIconUrl ?? n.actorAvatarUrl) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={(n.productIconUrl ?? n.actorAvatarUrl) as string}
                  alt=""
                  loading="lazy"
                  className="h-5 w-5 rounded-full object-cover shrink-0"
                />
              ) : (
                (KIND_ICON[n.kind] ?? (
                  <SealCheckIcon weight="fill" className="h-5 w-5 text-muted-foreground shrink-0" />
                ))
              )}
              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                <p
                  className={cn(
                    "text-[14px] leading-snug",
                    n.readAt === null
                      ? "font-bold text-foreground"
                      : "font-medium text-muted-foreground",
                  )}
                >
                  {n.title}
                </p>
                {n.body && (
                  <p className="text-[13px] font-medium text-muted-foreground/80 leading-relaxed">
                    {n.body}
                  </p>
                )}
                <span className="text-[12px] font-medium text-muted-foreground/70">
                  {timeAgoFr(n.createdAt)}
                </span>
              </div>
              {n.readAt === null && (
                <span
                  className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0"
                  aria-hidden="true"
                />
              )}
            </div>
          ))}
        </div>
      )}

      {initialCursor && (
        <div className="text-center">
          <Link
            href={`/dashboard/notifications?cursor=${encodeURIComponent(initialCursor)}`}
            className="text-[13px] font-bold text-muted-foreground hover:text-foreground transition-colors"
          >
            Charger plus →
          </Link>
        </div>
      )}
    </div>
  );
}
