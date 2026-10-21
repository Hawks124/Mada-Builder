import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { ProductSheet } from "@/components/product/product-sheet";
import { ProductBuilds } from "@/components/product/product-builds";
import { getApprovedBuilds } from "@/services/builds.service";
import { RelatedProducts } from "@/components/product/related-products";
import { ProductReviews } from "@/components/product/product-reviews";
import { ProductComments } from "@/components/product/product-comments";
import { getCategoryById } from "@/config/categories";
import { getProductTypeById } from "@/config/product-types";
import { getSessionUser } from "@/lib/supabase/server";
import { getUserVotedIds } from "@/services/votes.service";
import { fetchProductBySlug, logProductView } from "@/services/products.service";
import { getProductComments, getProductReviews } from "@/services/feedback.service";
import { fetchOwnProfile } from "@/services/users.service";
import { siteUrl } from "@/lib/site-url";
import { getRelatedProducts } from "@/services/ranking.service";
import { getLinkVerdicts } from "@/services/url-check.service";
import { appGradientFor, appInitialsFor } from "@/services/products.service";

type Params = { slug: string };

// Toujours dynamique : votes et compteurs vivants (même raison que home).
export const dynamic = "force-dynamic";

function excerpt(text: string, max = 160): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trim()}…` : flat;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const row = await fetchProductBySlug(slug);
  if (!row) return { robots: { index: false, follow: false } };
  // Title = nom seul (la tagline fait jusqu'à 220 signes — un title
  // de 300 signes serait tronqué et dilué ; la tagline vit dans la
  // description meta + OG). Template layout : " — Made in Madagascar".
  const title = row.name;
  const description = excerpt(row.description || row.tagline);
  // Canonical ABSOLUE (metadataBase global) + OG générée par listing.
  const url = `${siteUrl()}/products/${row.slug}`;
  const ogImage = `${siteUrl()}/og/${row.slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "website",
      images: [{ url: ogImage, width: 1200, height: 630, alt: row.name }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

// Fiche produit (SEO, §6) : TOUTE la donnée vient de la DB (Phase 4).
// Sections avis/commentaires : mocks conservés (décision — V1.5).
// Vues anonymes : after() best-effort (jamais bloquant, jamais de PII).
export default async function ProductPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const row = await fetchProductBySlug(slug);
  if (!row) notFound();
  after(() => logProductView(row.id));

  const [related, sessionUser] = await Promise.all([
    getRelatedProducts(row.id, row.category, 3, {
      // Algo des similaires : on complète avec les autres catégories du
      // produit puis les produits du même type (les alternatives).
      otherCategories: row.categories,
      productType: row.productType,
    }),
    getSessionUser(),
  ]);
  // Builds approuvés (D5) : invisibles si aucun (pending/rejected jamais
  // exposés). Échec = fiche sans binaire (jamais de page blanche).
  const approvedBuilds = await getApprovedBuilds(row.id).catch(() => []);
  const publicBuilds = approvedBuilds.map((b) => ({
    versionCode: b.versionCode,
    versionName: b.versionName,
    createdAt: b.createdAt.toISOString(),
    sizeBytes: b.sizeBytes,
    whatsnew: b.whatsnew,
  }));
  const downloadPath = `/api/products/${row.id}/download`;
  const latestBuild = publicBuilds[0] ?? null;
  const versionLabel =
    latestBuild && (latestBuild.versionCode !== null || latestBuild.versionName)
      ? `v${latestBuild.versionName ?? "?"} (${latestBuild.versionCode ?? "?"})`
      : null;
  const viewerId = sessionUser?.id ?? null;
  // Avis/comments avec le viewer (flags own/votes) + profil pour le composer.
  const [reviewsData, commentsData, ownProfile] = await Promise.all([
    getProductReviews(row.id, viewerId),
    getProductComments(row.id, viewerId),
    viewerId ? fetchOwnProfile(viewerId).catch(() => null) : Promise.resolve(null),
  ]);
  const isMaker = viewerId !== null && viewerId === row.makerId;
  const votedIds = await getUserVotedIds(sessionUser?.id ?? null, [
    row.id,
    ...related.map((r) => r.id),
  ]);
  const verdicts = await getLinkVerdicts(row.links).catch(() => null);
  // Pastilles : tout verdict non-ok (warn inclus) signale à vérifier.
  const warnCount = verdicts
    ? Object.keys(row.links).filter((id) => {
        const v = (verdicts as Record<string, { verdict?: string }>)[id];
        return v && v.verdict !== "ok";
      }).length
    : 0;

  const category = getCategoryById(row.category);
  const socialLinks: Record<string, string> = {};
  const rawSocial = row.makerSocialLinks as unknown;
  if (rawSocial && typeof rawSocial === "object") {
    for (const [k, v] of Object.entries(rawSocial as Record<string, unknown>)) {
      if (typeof v === "string" && v !== "") socialLinks[k] = v;
    }
  }

  // JSON-LD HONNÊTE : que du réel. Avis réels → aggregateRating
  // (décision : seulement avec de vrais avis, lot avis/comments).
  // SoftwareApplication + fil d'Ariane (compréhension Google).
  const pageUrl = `${siteUrl()}/products/${row.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: row.name,
    description: excerpt(row.description || row.tagline, 500),
    url: pageUrl,
    ...(row.iconUrl ? { image: row.iconUrl } : {}),
    applicationCategory: row.productType,
    operatingSystem: row.platforms.join(", "),
    inLanguage: row.languagesSupported.length > 0 ? row.languagesSupported : ["fr"],
    ...(row.tags.length > 0 ? { keywords: row.tags.join(", ") } : {}),
    author: {
      "@type": "Person",
      name: row.makerDisplayName,
      ...(row.makerWebsiteUrl ? { url: row.makerWebsiteUrl } : {}),
    },
    ...(row.publishedAt ? { datePublished: row.publishedAt.toISOString() } : {}),
    // Build approuvé uniquement (jamais de version inventée).
    ...(latestBuild?.versionName ? { softwareVersion: latestBuild.versionName } : {}),
    ...(latestBuild ? { downloadUrl: `${siteUrl()}${downloadPath}` } : {}),
    // Gratuit avéré → prix 0. Sinon : RIEN (jamais de prix inventé).
    ...(row.pricingModel === "free"
      ? { offers: { "@type": "Offer", price: 0, priceCurrency: "MGA" } }
      : {}),
    // Avis réels uniquement (jamais de note structurée sans avis).
    ...(reviewsData.distribution.count > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: reviewsData.distribution.avg,
            reviewCount: reviewsData.distribution.count,
          },
        }
      : {}),
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: siteUrl() },
      ...(category
        ? [
            {
              "@type": "ListItem",
              position: 2,
              name: category.name,
              item: `${siteUrl()}/categories/${category.id}`,
            },
          ]
        : []),
      {
        "@type": "ListItem",
        position: 3,
        name: row.name,
        item: pageUrl,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      {/* La FICHE = une seule vue (cf. `ProductSheet`) : l'aperçu d'une
          fiche en revue rend EXACTEMENT la même chose. */}
      <ProductSheet
        breadcrumb={
          <div className="flex items-center gap-2 text-[12px] md:text-[13px] font-semibold text-muted-foreground mb-6 md:mb-8">
            <Link href="/products" className="hover:text-foreground transition-colors">
              {getProductTypeById(row.productType)?.label ?? "Produits"}
            </Link>
            <span className="opacity-50">/</span>
            {category ? (
              <Link
                href={`/categories/${category.id}`}
                className="hover:text-foreground transition-colors"
              >
                {category.name}
              </Link>
            ) : (
              <span className="text-muted-foreground">Non classé</span>
            )}
            <span className="opacity-50">/</span>
            <span className="text-foreground">{row.name}</span>
          </div>
        }
        header={{
          id: row.id,
          name: row.name,
          tagline: row.tagline,
          categoryId: row.category,
          makerUsername: row.makerUsername,
          makerDisplayName: row.makerDisplayName,
          makerAvatarUrl: row.makerAvatarUrl,
          votes: row.upvoteCount,
          initialVoted: votedIds.has(row.id),
          iconUrl: row.iconUrl,
          initials: appInitialsFor(row.name),
          iconGradient: appGradientFor(row.id),
          curated: row.curated,
          commentsCount: row.commentsCount,
          apk: latestBuild && versionLabel ? { downloadPath, versionLabel } : null,
        }}
        shots={row.screenshots.map((s, i) => ({
          src: s.url,
          alt: s.caption || `Capture ${i + 1} de ${row.name}`,
          orientation: (s.orientation === "portrait" ? "portrait" : "landscape") as
            "portrait" | "landscape",
          width: s.width,
          height: s.height,
        }))}
        galleryOrientation={row.galleryOrientation === "portrait" ? "portrait" : "landscape"}
        description={row.description}
        productName={row.name}
        productId={row.id}
        videoUrl={row.links.video ?? null}
        sidebar={{
          productId: row.id,
          slug: row.slug,
          productName: row.name,
          tagline: row.tagline,
          productType: row.productType,
          links: row.links,
          installCommand: row.installCommand,
          unverifiedCount: warnCount,
          makerUsername: row.makerUsername,
          makerDisplayName: row.makerDisplayName,
          makerAvatarUrl: row.makerAvatarUrl,
          makerWebsiteUrl: row.makerWebsiteUrl,
          makerSocialLinks: socialLinks,
          categoryId: row.category,
          lifecycle: (["dev", "beta", "live"] as const).includes(
            row.lifecycle as "dev" | "beta" | "live",
          )
            ? (row.lifecycle as "dev" | "beta" | "live")
            : "live",
          tags: row.tags,
          pricingId: row.pricingModel,
          platforms: row.platforms,
          publishedAt: (row.publishedAt ?? row.createdAt).toISOString(),
          version: row.version,
          changelogUrl: row.links.changelog,
          license: row.license,
          requirements: row.requirements,
          audienceId: row.audience,
          hasAds: row.hasAds,
          hasInAppPurchase: row.hasInAppPurchase,
          sharesData: row.sharesData,
          targetCountries: row.targetCountries,
          languagesSupported: row.languagesSupported,
          votes: row.upvoteCount,
          initialVoted: votedIds.has(row.id),
          iconUrl: row.iconUrl,
          initials: appInitialsFor(row.name),
          iconGradient: appGradientFor(row.id),
          latestBuild: latestBuild
            ? {
                versionCode: latestBuild.versionCode,
                versionName: latestBuild.versionName,
                sizeBytes: latestBuild.sizeBytes,
              }
            : null,
          downloadPath,
        }}
      >
        {/* Sections « vivantes » : elles n'existent pas dans l'aperçu d'une
            fiche pas encore en ligne. */}
        {publicBuilds.length > 0 && (
          <ProductBuilds
            builds={publicBuilds}
            downloadPath={downloadPath}
            downloadUrl={`${siteUrl()}${downloadPath}`}
            downloadCount={row.downloadCount}
          />
        )}
        <RelatedProducts items={related} categoryId={row.category} />
        <ProductReviews
          id="reviews"
          productId={row.id}
          slug={row.slug}
          initial={reviewsData}
          signedIn={viewerId !== null}
          isMaker={isMaker}
          curated={row.curated}
        />
        <ProductComments
          productId={row.id}
          slug={row.slug}
          makerUsername={row.makerUsername}
          signedIn={viewerId !== null}
          viewerAvatarUrl={ownProfile?.avatarUrl ?? null}
          viewerDisplayName={ownProfile?.displayName ?? ""}
          initial={commentsData}
        />
      </ProductSheet>
    </>
  );
}
