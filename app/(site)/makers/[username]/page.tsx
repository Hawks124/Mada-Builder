import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import { AvatarImage } from "@/components/ui/avatar-image";
import { notFound } from "next/navigation";
import {
  GlobeIcon,
  GithubLogoIcon,
  XLogoIcon,
  FacebookLogoIcon,
  InstagramLogoIcon,
  LinkedinLogoIcon,
  TiktokLogoIcon,
  WhatsappLogoIcon,
  MapPinIcon,
} from "@phosphor-icons/react/dist/ssr";
import { getOccupationById } from "@/config/occupations";
import { logPageView } from "@/services/stats.service";
import { OverviewStats } from "@/components/dashboard/overview-stats";
import type { DashboardTotals } from "@/components/dashboard/dashboard-mock";
import { ProductCard } from "@/components/product/product-card";
import { getSessionUser } from "@/lib/supabase/server";
import { getUserVotedIds } from "@/services/votes.service";
import {
  appGradientFor,
  appInitialsFor,
  getMakerPublicProfile,
  ratingLabelOf,
} from "@/services/products.service";
import { siteUrl } from "@/lib/site-url";
import { itemListLd } from "@/lib/seo";

// Profil public maker (PRD §6D, 4C) : avatar, nom, bio, liens, produits
// publiés, total votes reçus. Vues = privées (dashboard). MRR : phase
// revenus. Pas de messagerie in-app (hors V1) : contact via liens sortants.
// Indexable (§7) : données 100 % réelles, 404 sinon (chemin démo supprimé).
const SOCIAL_DEFS = [
  { id: "website", label: "Site web", icon: GlobeIcon },
  { id: "github", label: "GitHub", icon: GithubLogoIcon },
  { id: "x", label: "X", icon: XLogoIcon },
  { id: "facebook", label: "Facebook", icon: FacebookLogoIcon },
  { id: "instagram", label: "Instagram", icon: InstagramLogoIcon },
  { id: "linkedin", label: "LinkedIn", icon: LinkedinLogoIcon },
  { id: "tiktok", label: "TikTok", icon: TiktokLogoIcon },
  { id: "whatsapp", label: "WhatsApp", icon: WhatsappLogoIcon },
] as const;

type Params = { username: string };

// Toujours dynamique : votes initiaux + session (jamais de HTML statique
// partagé — même raison que la fiche produit).
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { username } = await params;
  const data = await getMakerPublicProfile(username);
  if (!data) return { robots: { index: false, follow: false } };
  const { profile, totals } = data;
  const title = `${profile.displayName} (@${profile.username}) — maker malgache`;
  const description =
    profile.bio ??
    `Découvrez les ${totals.products} produit${totals.products === 1 ? "" : "s"} de ${profile.displayName}, maker malgache.`;
  const url = `${siteUrl()}/makers/${profile.username}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "profile",
      ...(profile.avatarUrl
        ? { images: [{ url: profile.avatarUrl, alt: profile.displayName }] }
        : {}),
    },
    twitter: {
      card: "summary",
      title,
      description,
      ...(profile.avatarUrl ? { images: [profile.avatarUrl] } : {}),
    },
  };
}

export default async function MakerPage({ params }: { params: Promise<Params> }) {
  const { username } = await params;
  const data = await getMakerPublicProfile(username);
  if (!data) notFound();
  const { profile, products, totals } = data;

  // Compteur vitrine anonyme (même pattern que la home).
  after(() => logPageView(`/makers/${profile.username}`));

  const sessionUser = await getSessionUser();
  const votedIds = await getUserVotedIds(
    sessionUser?.id ?? null,
    products.map((p) => p.id),
  );

  const occupation = getOccupationById(profile.occupation) ?? getOccupationById("maker")!;
  const location = [profile.city, profile.country].filter(Boolean).join(", ");
  const links = SOCIAL_DEFS.flatMap((def) => {
    const href =
      def.id === "website"
        ? (profile.websiteUrl ?? profile.socialLinks.website)
        : profile.socialLinks[def.id];
    return typeof href === "string" && href !== "" ? [{ ...def, href }] : [];
  });
  const initials = profile.displayName
    .split(/[\s_.-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

  // Stats publiques réelles (§6D strict) : upvotes + produits (+ MRR à 0,
  // réel : aucune connexion). Champs privés à 0 = non rendus en mode public.
  const publicTotals: DashboardTotals = {
    totalUpvotes: totals.upvotes,
    liveCount: totals.products,
    totalListings: totals.products,
    totalViews: 0,
    totalClicks: 0,
    totalViews7d: 0,
    pendingCount: 0,
    totalMrrCents: 0,
    totalComments: 0,
    globalRating: 0,
  };

  const pageUrl = `${siteUrl()}/makers/${profile.username}`;
  const personLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url: pageUrl,
    mainEntity: {
      "@type": "Person",
      name: profile.displayName,
      ...(profile.bio ? { description: profile.bio } : {}),
      ...(profile.avatarUrl ? { image: profile.avatarUrl } : {}),
      ...(location !== "" ? { homeLocation: location } : {}),
    },
  };

  return (
    <main className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(itemListLd(products, `Produits de ${profile.displayName}`)),
        }}
      />
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 md:pt-20 pb-24 flex flex-col gap-12">
        {/* Identity */}
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-5 md:gap-6">
            {profile.avatarUrl ? (
              <AvatarImage src={profile.avatarUrl} name={profile.displayName} size={96} />
            ) : (
              <span
                aria-hidden="true"
                className="h-20 w-20 md:h-24 md:w-24 rounded-full bg-[#EA580C] flex items-center justify-center text-white font-bold text-3xl shrink-0"
              >
                {initials || "M"}
              </span>
            )}
            <div className="flex flex-col gap-1.5 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-3xl md:text-4xl font-black tracking-tight text-foreground truncate">
                  {profile.displayName}
                </h1>
                {profile.banned && (
                  <span className="inline-flex items-center rounded-full border border-red-500/25 bg-red-500/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-widest text-red-600 dark:text-red-400 shrink-0">
                    Suspendu
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 text-[11px] font-bold text-muted-foreground shrink-0">
                  <occupation.icon weight="fill" className="w-3.5 h-3.5" aria-hidden="true" />
                  {occupation.label}
                </span>
              </div>
              {profile.bio && (
                <p className="text-[15px] font-medium text-muted-foreground leading-relaxed">
                  {profile.bio}
                </p>
              )}
              {location !== "" && (
                <p className="flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
                  <MapPinIcon weight="fill" className="w-4 h-4" aria-hidden="true" />
                  {location}
                </p>
              )}
            </div>
          </div>

          {/* Outbound links — le contact passe par ici, pas de DM (hors V1) */}
          {links.length > 0 && (
            <div className="flex items-center gap-2">
              {links.map((social) => (
                <Link
                  key={social.id}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={social.label}
                  aria-label={`${social.label} de ${profile.displayName} (nouvel onglet)`}
                  className="flex items-center justify-center h-10 w-10 rounded-full border border-border/40 text-muted-foreground hover:text-foreground hover:border-foreground/30 hover:bg-muted/50 transition-colors"
                >
                  <social.icon weight="fill" className="w-4.5 h-4.5" />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Stats publiques réelles — jamais de mock */}
        <OverviewStats totals={publicTotals} mode="public" revenueDisplay="full" />

        <div className="w-full h-px bg-border/40" />

        {/* Produits publiés */}
        <div className="flex flex-col gap-6">
          <div className="flex items-baseline gap-3">
            <h2 className="text-2xl font-black tracking-tight text-foreground">Produits</h2>
            <span className="text-[13px] font-medium text-muted-foreground">
              {totals.products} publié{totals.products === 1 ? "" : "s"}
            </span>
          </div>

          {products.length === 0 ? (
            <p className="text-[14px] font-medium text-muted-foreground py-8 text-center">
              Aucun produit publié pour le moment.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {products.map((p) => (
                <ProductCard
                  key={p.id}
                  product={{
                    id: p.id,
                    slug: p.slug,
                    name: p.name,
                    tagline: p.tagline,
                    categoryId: p.categoryId,
                    maker: profile.displayName,
                    makerUsername: profile.username,
                    makerAvatar: profile.avatarUrl,
                    votes: p.upvotes,
                    initialVoted: votedIds.has(p.id),
                    iconGradient: appGradientFor(p.id),
                    initials: appInitialsFor(p.name),
                    pricing: p.pricing,
                    platforms: p.platforms,
                    audienceId: p.audienceId,
                    publishedAt: p.publishedAt,
                    rating: ratingLabelOf(p.ratingAvg, p.ratingsCount),
                    curated: p.curated,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
