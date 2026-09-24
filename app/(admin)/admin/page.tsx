import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { AvatarImage } from "@/components/ui/avatar-image";
import { HourglassIcon } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/page-header";
import { ActionButton } from "@/components/ui/action-button";
import {
  MOCK_ACTIVITY,
  MOCK_REVIEW_QUEUE,
  type ActivityItem,
} from "@/components/admin/admin-mock";
import { MOCK_APPS } from "@/components/dashboard/dashboard-mock";
import { getMakersCount } from "@/services/users.service";
import {
  getBannedCount,
  getHomepageViews,
  getVisitsTotal,
} from "@/services/stats.service";

// noindex strict — jamais indexé, même au backend (robots + middleware).
export const metadata: Metadata = {
  title: "Admin — Vue d'ensemble",
  robots: { index: false, follow: false },
};

type AdminStat = {
  label: string;
  value: string;
  delta: string;
  tone: "up" | "neutral";
};

const STATS_FALLBACK: AdminStat[] = [
  { label: "Visites (7 j)", value: "—", delta: "hits bruts, invités inclus", tone: "neutral" as const },
  { label: "Makers inscrits", value: "—", delta: "comptes actifs", tone: "neutral" as const },
  { label: "Bannis", value: "—", delta: "suspendus", tone: "neutral" as const },
  { label: "Listings publiés", value: "—", delta: "milestone listings", tone: "neutral" as const },
  { label: "MRR vérifié", value: "—", delta: "milestone revenue", tone: "neutral" as const },
];

/** Stats réelles quand le backend répond (makers/visites/bannis) —
 * listings + MRR restent "—" jusqu'à leurs milestones. Zéro faux chiffre. */
async function getStats(): Promise<AdminStat[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return STATS_FALLBACK;
  try {
    const [visits, homeViews, makers, banned] = await Promise.all([
      getVisitsTotal(7),
      getHomepageViews(7),
      getMakersCount(),
      getBannedCount(),
    ]);
    return [
      {
        label: "Visites (7 j)",
        value: visits.toLocaleString("fr-FR"),
        delta: `dont ${homeViews.toLocaleString("fr-FR")} accueil`,
        tone: "neutral" as const,
      },
      {
        label: "Makers inscrits",
        value: makers.toLocaleString("fr-FR"),
        delta: "comptes actifs",
        tone: "neutral" as const,
      },
      {
        label: "Bannis",
        value: banned.toLocaleString("fr-FR"),
        delta: "suspendus",
        tone: "neutral" as const,
      },
      {
        label: "Listings publiés",
        value: "—",
        delta: "milestone listings",
        tone: "neutral" as const,
      },
      {
        label: "MRR vérifié",
        value: "—",
        delta: "milestone revenue",
        tone: "neutral" as const,
      },
    ];
  } catch {
    return STATS_FALLBACK;
  }
}

/** Visuel d'entité — logos/avatars en couleurs naturelles, zéro arc-en-ciel.
 *  Seul le danger garde un point rouge. */
function ActivityVisual({ item }: { item: ActivityItem }) {
  const { subject } = item;

  if (subject.type === "provider") {
    return (
      <span className="h-8 w-8 rounded-xl bg-background border border-border/40 flex items-center justify-center shrink-0 overflow-hidden px-1">
        <Image
          src="/logos/stripe.svg"
          alt="Stripe"
          width={28}
          height={14}
          className="object-contain w-6 dark:brightness-0 dark:invert"
        />
      </span>
    );
  }

  if (subject.type === "users") {
    return (
      <span className="flex -space-x-2 shrink-0">
        {subject.avatars.map((url) => (
          <AvatarImage
            key={url}
            src={url}
            name=""
            size={28}
            className="ring-2 ring-background"
          />
        ))}
        <span className="w-7 h-7 rounded-full ring-2 ring-background bg-muted border border-border/40 flex items-center justify-center text-[9px] font-black text-muted-foreground tabular-nums">
          +{subject.extra}
        </span>
      </span>
    );
  }

  const found =
    MOCK_APPS.find((a) => a.id === subject.productId) ??
    MOCK_REVIEW_QUEUE.find((q) => q.id === subject.productId);
  return (
    <span
      className={cn(
        "h-8 w-8 rounded-xl shrink-0 flex items-center justify-center text-white font-black text-[11px] bg-linear-to-br shadow-sm",
        found?.iconGradient ?? "from-zinc-500 to-zinc-700",
      )}
    >
      {found?.initials ?? "••"}
    </span>
  );
}

// Gate staff au layout (admin). Stats mixtes : réelles quand le backend
// répond (visites, makers, bannis), "—" pour listings/MRR jusqu'à leurs
// milestones.
export default async function AdminOverviewPage() {
  const stats = await getStats();
  return (
    <div className="w-full px-6 lg:px-12 pt-10 lg:pt-14 pb-24 flex flex-col gap-14">
      <PageHeader
        title="Vue d'ensemble"
        subtitle="Santé de la plateforme, activité récente et file de revue."
        actions={
          <ActionButton
            href="/admin/review"
            variant="primary"
            isFullWidthOnMobile={false}
            className="h-11! px-6! text-[14px]!"
          >
            <HourglassIcon weight="fill" className="h-4 w-4" />
            Traiter la file ({MOCK_REVIEW_QUEUE.length})
          </ActionButton>
        }
      />

      {/* Stats strip — réel (makers/visites/bannis), "—" en attente */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-x-6 gap-y-10">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
              {stat.label}
            </span>
            <span className="text-[28px] md:text-3xl font-black tracking-tighter text-foreground tabular-nums leading-none">
              {stat.value}
            </span>
            <span
              className={cn(
                "text-[12px] font-bold",
                stat.tone === "up"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-muted-foreground",
              )}
            >
              {stat.delta}
            </span>
          </div>
        ))}
      </div>

      <div className="w-full h-px bg-border/40" />

      {/* Recent activity */}
      <div className="flex flex-col gap-6">
        <h2 className="text-2xl font-black tracking-tight text-foreground">
          Activité récente
        </h2>
        <div className="flex flex-col">
          {MOCK_ACTIVITY.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="group flex items-center gap-3 py-3 px-3 rounded-2xl hover:bg-muted/40 transition-colors"
            >
              <ActivityVisual item={item} />
              {item.tone === "danger" && (
                <span
                  className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0"
                  aria-hidden="true"
                />
              )}
              <p className="text-[14px] font-medium text-foreground group-hover:text-primary transition-colors flex-1 min-w-0 truncate">
                {item.text}
              </p>
              <span className="text-[12px] font-medium text-muted-foreground shrink-0">
                {item.time}
              </span>
            </Link>
          ))}
        </div>
      </div>

      <p className="text-[12px] font-medium text-muted-foreground/70">
        Visites = hits bruts 7 j (invités inclus, pas des uniques).
        Activité mock — branchée sur l&apos;audit admin (V1.5).
      </p>
    </div>
  );
}
