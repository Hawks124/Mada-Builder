import {
  CaretUpIcon,
  CaretDownIcon,
  StarIcon,
  SealCheckIcon,
} from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";
import {
  formatCompactAr,
  formatCompactCount,
  type DashboardTotals,
} from "@/components/dashboard/dashboard-mock";

type DeltaTone = "up" | "down" | "neutral";

const TONE_CLASS: Record<DeltaTone, string> = {
  up: "text-emerald-600 dark:text-emerald-400",
  down: "text-red-500 dark:text-red-400",
  neutral: "text-muted-foreground",
};

function DeltaIcon({ tone }: { tone: DeltaTone }) {
  if (tone === "up")
    return <CaretUpIcon weight="fill" className="h-3 w-3" aria-hidden="true" />;
  if (tone === "down")
    return (
      <CaretDownIcon weight="fill" className="h-3 w-3" aria-hidden="true" />
    );
  return null;
}

type StatDef = {
  label: string;
  value: string;
  delta: string;
  tone: DeltaTone;
  star?: boolean;
  verifiedBadge?: boolean;
};

// Lightweight strip — type only, no cards (featured metadata pattern).
// Discipline: only meaningful deltas are colored; the rest stays neutral.
// Public mode (§6D strict): upvotes + published products + MRR (display_mode
// respected) — listings, pending, views, comments and rating stay private.
export function OverviewStats({
  totals,
  mode = "full",
  revenueDisplay = "full",
}: {
  totals: DashboardTotals;
  mode?: "full" | "public";
  revenueDisplay?: "full" | "badge_only";
}) {
  const stats: StatDef[] =
    mode === "public"
      ? [
          {
            label: "Total upvotes",
            value: formatCompactCount(totals.totalUpvotes),
            delta: "votes reçus",
            tone: "neutral",
          },
          {
            label: "Produits publiés",
            value: `${totals.liveCount}`,
            delta: "en ligne",
            tone: "neutral",
          },
          revenueDisplay === "full"
            ? {
                label: "MRR vérifié",
                value: formatCompactAr(totals.totalMrrAr),
                delta: "revenus prouvés",
                tone: "up",
              }
            : {
                label: "MRR vérifié",
                value: "",
                delta: "montant masqué par le maker",
                tone: "neutral",
                verifiedBadge: true,
              },
        ]
      : [
          {
            label: "Total upvotes",
            value: formatCompactCount(totals.totalUpvotes),
            delta: "+18 cette semaine",
            tone: "up",
          },
          {
            label: "Apps live",
            value: `${totals.liveCount}`,
            delta: `${totals.liveCount} sur ${totals.totalListings} listings`,
            tone: "neutral",
          },
          {
            label: "Total listings",
            value: `${totals.totalListings}`,
            delta: "tous statuts",
            tone: "neutral",
          },
          {
            label: "Vues fiches",
            value: formatCompactCount(totals.totalViews),
            delta: "+1,2 k cette semaine",
            tone: "up",
          },
          {
            label: "Commentaires",
            value: formatCompactCount(totals.totalComments),
            delta: "+6 cette semaine",
            tone: "up",
          },
          {
            label: "Note globale",
            value: totals.globalRating.toLocaleString("fr-FR", {
              maximumFractionDigits: 1,
            }),
            delta: "tous produits",
            tone: "neutral",
            star: true,
          },
          {
            label: "En attente",
            value: `${totals.pendingCount}`,
            delta:
              totals.pendingCount > 0
                ? "revue sous 24 h"
                : "rien en file de revue",
            tone: "neutral",
          },
          {
            label: "MRR vérifié",
            value: formatCompactAr(totals.totalMrrAr),
            delta: "+8 % cette semaine",
            tone: "up",
          },
        ];

  return (
    <div
      className={cn(
        "grid gap-x-6 gap-y-10",
        mode === "public"
          ? "grid-cols-2 md:grid-cols-3"
          : "grid-cols-2 lg:grid-cols-4",
      )}
    >
      {stats.map((stat) => (
        <div key={stat.label} className="flex flex-col gap-1.5">
          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
            {stat.label}
          </span>
          {stat.verifiedBadge ? (
            <span className="inline-flex items-center gap-1.5 self-start rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[12px] font-black uppercase tracking-[0.14em] text-emerald-600 dark:text-emerald-400">
              <SealCheckIcon weight="fill" className="h-4 w-4" />
              Vérifié
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[28px] md:text-3xl font-black tracking-tighter text-foreground tabular-nums leading-none">
              {stat.value}
              {stat.star && (
                <StarIcon
                  weight="fill"
                  className="w-5 h-5 text-yellow-500"
                  aria-hidden="true"
                />
              )}
            </span>
          )}
          <span
            className={cn(
              "flex items-center gap-1 text-[12px] font-bold",
              TONE_CLASS[stat.tone],
            )}
          >
            <DeltaIcon tone={stat.tone} />
            {stat.delta}
          </span>
        </div>
      ))}
    </div>
  );
}
