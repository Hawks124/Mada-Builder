import type { Metadata } from "next";
import { Suspense } from "react";
import { LeaderboardContent } from "@/components/ranking/leaderboard-content";
import { VALID_WINDOWS } from "@/services/home.service";
import type { RankingWindow } from "@/services/home.service";
import { getCategoryById } from "@/config/categories";
import { getProductTypeById } from "@/config/product-types";
import { getSessionUser } from "@/lib/supabase/server";
import { getUserVotedIds } from "@/services/votes.service";
import { getFeatured, getLeaderboard, toFeaturedCard } from "@/services/ranking.service";
import { getRevenueViewsForProducts } from "@/services/revenue/views";
import type { FeaturedProductData } from "@/services/home.service";
import { itemListLd } from "@/lib/seo";
import { siteUrl } from "@/lib/site-url";

const LEADERBOARD_TITLE = "Classement de la tech malgache | Mada-Made";
const LEADERBOARD_DESC =
  "Découvrez les produits tech construits à Madagascar, classés par les votes de la communauté : apps, SaaS et outils des makers malgaches.";

export const metadata: Metadata = {
  title: LEADERBOARD_TITLE,
  description: LEADERBOARD_DESC,
  // Canonical de base : les variantes ?w=&cat=&type=&page= partagent le jus
  // (pas de noindex — le contenu reste crawlable, une seule URL fait foi).
  alternates: { canonical: `${siteUrl()}/leaderboard` },
  openGraph: {
    title: "Le classement de la tech malgache",
    description: LEADERBOARD_DESC,
    url: `${siteUrl()}/leaderboard`,
    type: "website",
    images: [
      { url: `${siteUrl()}/og/leaderboard`, width: 1200, height: 630, alt: "Classement Mada-Made" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Le classement de la tech malgache",
    description: LEADERBOARD_DESC,
    images: [`${siteUrl()}/og/leaderboard`],
  },
};

// Toujours dynamique : classement vivant (même raison que la home).
export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function strParam(v: string | string[] | undefined): string | null {
  return typeof v === "string" && v.trim() !== "" ? v : null;
}

// SEO : HTML serveur avec données (plus de coquille cliente sur mocks).
export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const rawW = strParam(sp.w);
  const w: RankingWindow = VALID_WINDOWS.includes(rawW as RankingWindow)
    ? (rawW as RankingWindow)
    : "today";
  // Facettes inconnues (URL éditée) = ignorées, jamais d'erreur.
  const rawCat = strParam(sp.cat);
  const cat = rawCat && getCategoryById(rawCat) ? rawCat : null;
  const rawType = strParam(sp.type);
  const type = rawType && getProductTypeById(rawType).id === rawType ? rawType : null;
  const page = Math.max(1, Number.parseInt(strParam(sp.page) ?? "1", 10) || 1);

  const [chrono, taxo, featured, sessionUser] = await Promise.all([
    getLeaderboard({ window: w, page: 1 }),
    getLeaderboard({ window: "all", category: cat, productType: type, page, order: "weighted" }),
    getFeatured(),
    getSessionUser(),
  ]);
  const votedIds = await getUserVotedIds(sessionUser?.id ?? null, [
    ...chrono.items.map((i) => i.id),
    ...taxo.items.map((i) => i.id),
  ]);
  const voted = [...votedIds];
  let featuredData: FeaturedProductData | null = featured
    ? toFeaturedCard(featured, { initialVoted: voted.includes(featured.productId) })
    : null;
  if (featuredData && featured) {
    const views = await getRevenueViewsForProducts([featured.productId]).catch(() => new Map());
    const view = views.get(featured.productId);
    if (view) {
      featuredData = {
        ...featuredData,
        revenue: {
          provider: view.provider,
          displayMode: view.displayMode,
          mrrCents: view.mrrCents,
          currency: view.currency,
        },
      };
    }
  }

  return (
    <Suspense
      fallback={
        <div className="flex flex-col w-full min-h-[calc(100vh-72px)] items-center justify-center">
          <p className="text-muted-foreground font-medium">Chargement du classement…</p>
        </div>
      }
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            itemListLd(chrono.items, "Classement des produits tech malgaches"),
          ),
        }}
      />
      <LeaderboardContent
        chrono={chrono.items}
        taxo={taxo.items}
        taxoTotal={taxo.total}
        taxoWeight={taxo.totalWeighted}
        featured={featuredData}
        votedIds={voted}
        window={w}
        cat={cat}
        type={type}
        page={page}
      />
    </Suspense>
  );
}
