// Server-rendered (SEO §1) — les îlots clients (vote, menu, selects)
// vivent dans les composants enfants. Classement, nouveautés et produit
// du jour : données réelles (Phase 3). Mur des revenus : mock jusqu'au
// lot MRR (jamais de faux chiffres).
// Toujours dynamique : données vivantes (jamais de snapshot baké au build,
// jamais de crash prerender sans clés — CI build sans secrets).
import { after } from "next/server";
import Link from "next/link";
import { GridBackground } from "@/components/ui/grid-background";
import { Hero } from "@/components/home/hero";
import { FeaturedProduct } from "@/components/home/featured-product";
import type { FeaturedProductData } from "@/services/home.service";
import { Leaderboard } from "@/components/home/leaderboard";
import { NewestProducts } from "@/components/home/newest-products";
import { VerifiedRevenueSection } from "@/components/home/verified-revenue-section";
import { CommunityCTA } from "@/components/home/community-cta";
import { EmptyState } from "@/components/ui/empty-state";
import { logPageView } from "@/services/stats.service";
import { getSessionUser } from "@/lib/supabase/server";
import { getUserVotedIds } from "@/services/votes.service";
import { getFeatured, getLeaderboard, getNewest, toFeaturedCard } from "@/services/ranking.service";
import { ratingLabelOf } from "@/services/products.service";
import type { ProductCardProps } from "@/components/product/product-card";

export const dynamic = "force-dynamic";

export default async function Home() {
  // Compteur vitrine anonyme — after() : zéro impact TTFB, jamais
  // d'échec de rendu pour une stat (best-effort interne). Plus de
  // session à résoudre (colonne user_id supprimée — vie-privée §16).
  after(() => logPageView("/"));
  // Page publique : JAMAIS de crash sur incident DB (slot pool mort,
  // hoquet Supabase) — chaque section dégrade vers vide/CTA au lieu de
  // la Runtime Error page blanche (vue en QA : getNewest qui pète).
  const [newest, featured, sessionUser] = await Promise.all([
    getNewest(6).catch(() => []),
    getFeatured().catch(() => null),
    getSessionUser(),
  ]);
  // Teaser classement : première fenêtre non vide (today → week → month →
  // all). La home ne montre JAMAIS un filtre vide quand une autre fenêtre
  // a du contenu — séquentiel conditionnel (1 requête en pratique).
  const homeWindows = ["today", "week", "month", "all"] as const;
  let board = await getLeaderboard({ window: homeWindows[0], page: 1 }).catch(() => null);
  let boardWindow: (typeof homeWindows)[number] = homeWindows[0];
  for (const w of homeWindows.slice(1)) {
    if (board !== null && board.items.length > 0) break;
    boardWindow = w;
    board = await getLeaderboard({ window: w, page: 1 }).catch(() => null);
  }
  if (board === null) board = { items: [], total: 0, totalVotes: 0, totalWeighted: 0 };
  const votedIds = await getUserVotedIds(sessionUser?.id ?? null, [
    ...board.items.map((i) => i.id),
    ...newest.map((n) => n.id),
  ]).catch(() => new Set<string>());
  const voted = [...votedIds];

  const featuredData: FeaturedProductData | null = featured
    ? toFeaturedCard(featured, { initialVoted: voted.includes(featured.productId) })
    : null;

  const newestCards: ProductCardProps[] = newest.map((n) => ({
    id: n.id,
    slug: n.slug,
    name: n.name,
    tagline: n.tagline,
    categoryId: n.categoryId,
    maker: n.makerDisplayName,
    makerUsername: n.makerUsername,
    makerAvatar: n.makerAvatarUrl ?? "",
    votes: n.votes,
    iconGradient: n.iconGradient,
    initials: n.initials,
    pricing: n.pricingId,
    platforms: n.platforms,
    audienceId: n.audienceId,
    comments: 0,
    rating: ratingLabelOf(n.ratingAvg, n.ratingsCount),
    curated: n.curated,
  }));

  return (
    <div className="flex flex-col w-full min-h-[calc(100vh-72px)]">
      {/* ─── DISCOVERY ZONE (Grid continues: Hero → Featured → Leaderboard) ─── */}
      <div className="relative flex flex-col w-full overflow-hidden border-b border-border/20">
        {/* Grid background — extends through the whole discovery zone */}
        <div className="absolute inset-0 pointer-events-none">
          <GridBackground variant="css" showBottomFade={false} />
        </div>

        <Hero />

        {/* ─── FEATURED PRODUCT SECTION ─── */}
        <div className="w-full relative pt-16 pb-12">
          {featuredData ? (
            <FeaturedProduct product={featuredData} />
          ) : (
            <section className="container px-4 md:px-8 max-w-7xl mx-auto w-full">
              <EmptyState
                title="Aucun produit à mettre en avant — soyez le premier."
                description="Publiez votre produit et il occupera cette une dès demain."
                action={
                  <Link
                    href="/products/submit"
                    className="rounded-full bg-foreground px-6 py-2.5 text-[13px] font-bold text-background hover:opacity-90 transition-opacity"
                  >
                    Soumettre un produit
                  </Link>
                }
              />
            </section>
          )}
        </div>

        {/* ─── LEADERBOARD SECTION ─── */}
        <div className="w-full relative border-t border-border/20 pb-8">
          <Leaderboard
            items={board.items}
            totalVotes={board.totalVotes}
            votedIds={voted}
            boardWindow={boardWindow}
          />
        </div>

        {/* Magic fade: grid dissolves into the solid background right at the Newest seam */}
        <div className="absolute inset-x-0 bottom-0 h-60 bg-linear-to-t from-background via-background/85 to-transparent pointer-events-none" />
      </div>

      {/* ─── NEWEST PRODUCTS (FRESHLY SHIPPED) ─── */}
      <div className="w-full bg-background border-t border-border/20 relative">
        <NewestProducts items={newestCards} votedIds={voted} />
      </div>

      {/* ─── VERIFIED REVENUE WALL ─── */}
      <div className="w-full bg-background border-t border-border/20 relative">
        <VerifiedRevenueSection />
      </div>

      {/* ─── COMMUNITY CTA BANNER ─── */}
      <div className="w-full">
        <CommunityCTA />
      </div>
    </div>
  );
}
