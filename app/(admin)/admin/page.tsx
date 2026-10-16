import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { AvatarImage } from "@/components/ui/avatar-image";
import { HourglassIcon } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/page-header";
import { ActionButton } from "@/components/ui/action-button";
import { type ActivityItem } from "@/components/admin/admin-mock";
import { getRecentActivity } from "@/services/activity.service";
import { getPendingCountCached, getProductsCount } from "@/services/stats.service";
import { getBuildStats } from "@/services/builds.service";
import {
  getActiveRevenueConnectionsCount,
  getFailingRevenueConnections,
} from "@/services/revenue/views";
import { REVENUE_CONFIG_SPECS } from "@/services/revenue/types";
import { getAdminAnalyticsCached, withTimeout } from "@/services/stats.service";

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
  {
    label: "Visites (7 j)",
    value: "—",
    delta: "hits bruts, invités inclus",
    tone: "neutral" as const,
  },
  { label: "Makers inscrits", value: "—", delta: "comptes actifs", tone: "neutral" as const },
  { label: "Bannis", value: "—", delta: "suspendus", tone: "neutral" as const },
  { label: "Listings publiés", value: "—", delta: "milestone listings", tone: "neutral" as const },
  { label: "Clés revenus", value: "—", delta: "backend injoignable", tone: "neutral" as const },
];

/** Stats plateforme EXHAUSTIVES (admin = toute la plateforme) : réelles
 * quand le backend répond, "0 + Phase 5" pour notes/commentaires
 * (inexistants — jamais de faux chiffres). Les revenus se pilotent au
 * nombre de clés actives, jamais à une somme multi-devises. */
async function getStats(): Promise<{
  stats: AdminStat[];
  revenueFailing: Awaited<ReturnType<typeof getFailingRevenueConnections>>;
}> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return { stats: STATS_FALLBACK, revenueFailing: [] };
  try {
    // Split décisionnel vs analytique (perf overview) : la file et les
    // builds restent FRAIS (jamais de décision sur du daté), avec timeout
    // 8 s et repli « — » par item (plus de tout-ou-rien). Le reste vient
    // du cache 90 s.
    const [pending, builds, a, revenueFailing, activeRevenue] = await Promise.all([
      withTimeout(
        getProductsCount("pending").catch(() => -1),
        8000,
        -1,
      ),
      withTimeout(
        getBuildStats().catch(() => null),
        8000,
        null,
      ),
      getAdminAnalyticsCached(),
      getFailingRevenueConnections().catch(() => []),
      withTimeout(
        getActiveRevenueConnectionsCount().catch(() => -1),
        8000,
        -1,
      ),
    ]);
    const {
      visits,
      visits30,
      visitsTotal,
      homeViews,
      makers,
      users,
      banned,
      published,
      drafts,
      rejected,
      upvotes,
      views,
      views7,
      clicks,
      clicks7,
      emails,
      emails7,
      feedback,
    } = a;
    const total = drafts + (pending >= 0 ? pending : 0) + published + rejected;
    const n = (v: number): string => v.toLocaleString("fr-FR");
    const stats: AdminStat[] = [
      {
        label: "Visites (7 j)",
        value: n(visits),
        delta: `dont ${n(homeViews)} accueil`,
        tone: visits > 0 ? ("up" as const) : ("neutral" as const),
      },
      {
        label: "Visites (30 j)",
        value: n(visits30),
        delta: `dont ${n(visits)} (7 j)`,
        tone: visits30 > 0 ? ("up" as const) : ("neutral" as const),
      },
      {
        label: "Visites totales",
        value: n(visitsTotal),
        delta: "cumulé, tous chemins",
        tone: "neutral" as const,
      },
      {
        label: "Comptes totaux",
        value: n(users),
        delta: "non supprimés",
        tone: "neutral" as const,
      },
      {
        label: "Makers inscrits",
        value: n(makers),
        delta: "comptes actifs",
        tone: "neutral" as const,
      },
      { label: "Bannis", value: n(banned), delta: "suspendus", tone: "neutral" as const },
      { label: "Produits total", value: n(total), delta: "tous statuts", tone: "neutral" as const },
      {
        label: "Listings publiés",
        value: n(published),
        delta: "en ligne",
        tone: "neutral" as const,
      },
      {
        label: "En revue",
        value: pending >= 0 ? n(pending) : "—",
        delta: "file pending",
        tone: "neutral" as const,
      },
      {
        label: "Binaires en revue",
        value: builds ? n(builds.pending) : "—",
        delta: builds
          ? `${n(builds.approved)} approuvés · ${n(builds.rejected)} rejetés`
          : "indisponible",
        tone: "neutral" as const,
      },
      {
        label: "Binaires total",
        value: builds ? n(builds.pending + builds.approved + builds.rejected) : "—",
        delta: "APK envoyés, tous statuts",
        tone:
          builds && builds.pending + builds.approved + builds.rejected > 0
            ? ("up" as const)
            : ("neutral" as const),
      },
      {
        label: "Brouillons",
        value: n(drafts),
        delta: "travail en cours",
        tone: "neutral" as const,
      },
      { label: "Rejetés", value: n(rejected), delta: "refusés", tone: "neutral" as const },
      {
        label: "Upvotes totaux",
        value: n(upvotes),
        delta: "tous produits",
        tone: "neutral" as const,
      },
      {
        label: "Vues fiches",
        value: n(views),
        delta: `dont ${n(views7)} (7 j)`,
        tone: views7 > 0 ? ("up" as const) : ("neutral" as const),
      },
      {
        label: "Clics sortants",
        value: n(clicks),
        delta: `dont ${n(clicks7)} (7 j)`,
        tone: clicks7 > 0 ? ("up" as const) : ("neutral" as const),
      },
      {
        label: "Notes moyennes",
        value:
          feedback.avgRating !== null
            ? feedback.avgRating.toLocaleString("fr-FR", { maximumFractionDigits: 1 })
            : "—",
        delta: `${n(feedback.reviews)} avis`,
        tone: feedback.reviews > 0 ? ("up" as const) : ("neutral" as const),
      },
      {
        label: "Commentaires",
        value: n(feedback.comments),
        delta: "visibles",
        tone: feedback.comments > 0 ? ("up" as const) : ("neutral" as const),
      },
      {
        label: "Emails envoyés",
        value: n(emails.sent + emails.delivered),
        delta: `dont ${n(emails7.sent + emails7.delivered)} (7 j)`,
        tone: emails7.sent + emails7.delivered > 0 ? ("up" as const) : ("neutral" as const),
      },
      {
        label: "Échecs emails",
        value: n(emails.failed),
        delta: `dont ${n(emails7.failed)} (7 j) — webhooks Resend`,
        tone: "neutral" as const,
      },
      activeRevenue >= 0
        ? {
            label: "Clés revenus",
            value: n(activeRevenue),
            delta:
              revenueFailing.length > 0
                ? `dont ${n(revenueFailing.length)} en échec`
                : "lecture seule, sync horaire",
            tone: "neutral" as const,
          }
        : {
            label: "Clés revenus",
            value: "—",
            delta: "compteur indisponible",
            tone: "neutral" as const,
          },
    ];

    return { stats, revenueFailing };
  } catch {
    return {
      stats: STATS_FALLBACK,
      revenueFailing: [] as Awaited<ReturnType<typeof getFailingRevenueConnections>>,
    };
  }
}

/** Visuel d'entité — logos/avatars en couleurs naturelles, zéro arc-en-ciel.
 *  Seul le danger garde un point rouge. */
function ActivityVisual({ item }: { item: ActivityItem }) {
  const { subject } = item;

  if (subject.type === "provider") {
    // Logo réel du provider (jamais Stripe en dur : 5 providers possibles).
    const spec = REVENUE_CONFIG_SPECS[subject.provider];
    return (
      <span className="h-8 w-8 rounded-xl bg-background border border-border/40 flex items-center justify-center shrink-0 overflow-hidden px-1">
        <Image
          src={spec.logo}
          alt={spec.label}
          width={28}
          height={28}
          className="object-contain w-6 h-6"
        />
      </span>
    );
  }

  if (subject.type === "users") {
    return (
      <span className="flex -space-x-2 shrink-0">
        {subject.avatars.map((url) => (
          <AvatarImage key={url} src={url} name="" size={28} className="ring-2 ring-background" />
        ))}
        {subject.extra > 0 && (
          <span className="w-7 h-7 rounded-full ring-2 ring-background bg-muted border border-border/40 flex items-center justify-center text-[9px] font-black text-muted-foreground tabular-nums">
            +{subject.extra}
          </span>
        )}
      </span>
    );
  }

  // Visuel réel : logo produit si fourni, sinon initiales/gradient —
  // "••" gris seulement pour les sujets sans visuel (jamais de mock).
  if (subject.type === "product" && subject.iconUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={subject.iconUrl}
        alt=""
        loading="lazy"
        className="h-8 w-8 rounded-xl object-cover border border-border/40 shrink-0 shadow-sm"
      />
    );
  }
  const found =
    item.subject.type === "product"
      ? {
          iconGradient: item.subject.iconGradient ?? "from-zinc-500 to-zinc-700",
          initials: item.subject.initials ?? "••",
        }
      : undefined;
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
// répond (visites, makers, bannis, clés revenus), "—" pour listings
// jusqu'à son milestone.
export default async function AdminOverviewPage() {
  // eslint-disable-next-line react-hooks/purity -- diagnostic dev : mesure de durée, aucun impact rendu.
  const pageT0 = Date.now();
  const [{ stats, revenueFailing }, pendingCount, activity] = await Promise.all([
    getStats(),
    // Compteur CTA borné (8 s) : sans borne, c'était un await infini dans
    // le stream — -1 = compteur inconnu, le bouton reste sans chiffre
    // (jamais de « (0) » mensonger).
    withTimeout(
      getPendingCountCached().catch(() => -1),
      8000,
      -1,
    ),
    // Activité RÉELLE (audit + soumissions + inscriptions) — vide honnête.
    getRecentActivity(10).catch(() => []),
  ]);
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line react-hooks/purity -- diagnostic dev : mesure de durée, aucun impact rendu.
    console.log(`[admin] overview ${(Date.now() - pageT0).toFixed(0)}ms`);
  }
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
            {pendingCount >= 0 ? `Traiter la file (${pendingCount})` : "Traiter la file"}
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

      {/* Sync revenus en échec (monitoring bêta) — vide = rien à voir. */}
      {revenueFailing.length > 0 && (
        <div className="flex flex-col gap-6">
          <h2 className="text-2xl font-black tracking-tight text-foreground">
            Sync revenus en échec ({revenueFailing.length})
          </h2>
          <div className="flex flex-col">
            {revenueFailing.map((f) => (
              <Link
                key={f.connectionId}
                href={`/products/${f.productSlug}`}
                className="group flex items-center gap-3 py-3 px-3 rounded-2xl hover:bg-muted/40 transition-colors"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" aria-hidden="true" />
                <p className="text-[14px] font-medium text-foreground group-hover:text-primary transition-colors flex-1 min-w-0 truncate">
                  {f.productName} · {REVENUE_CONFIG_SPECS[f.provider].label}
                  {f.lastError ? ` — ${f.lastError}` : ""}
                </p>
                <span className="text-[12px] font-medium text-muted-foreground shrink-0 tabular-nums">
                  {f.failedCount} échecs
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent activity — réelle (audit + soumissions + inscriptions). */}
      <div className="flex flex-col gap-6">
        <h2 className="text-2xl font-black tracking-tight text-foreground">Activité récente</h2>
        {activity.length === 0 ? (
          <p className="text-[14px] font-medium text-muted-foreground py-8 text-center">
            Aucune activité pour le moment — les modérations, soumissions et inscriptions
            apparaîtront ici.
          </p>
        ) : (
          <div className="flex flex-col">
            {activity.map((item) => (
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
        )}
      </div>

      <p className="text-[12px] font-medium text-muted-foreground/70">
        Visites = hits bruts 7 j (invités inclus, pas des uniques). L&apos;historique démarre à la
        mise en prod (pas de rétroactif).
      </p>
    </div>
  );
}
