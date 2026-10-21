import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSessionUser } from "@/lib/supabase/server";
import { fetchProductForPreview } from "@/services/products.service";
import { getUserVotedIds } from "@/services/votes.service";
import { appGradientFor, appInitialsFor } from "@/services/products.service";
import { ProductSheet } from "@/components/product/product-sheet";

// Jamais mis en cache : contenu réservé au propriétaire / au staff.
export const dynamic = "force-dynamic";

// noindex strict : une fiche non publiée ne doit jamais être indexée, ni
// suivie (ni partagée par un tiers : la route refuse les inconnus).
export const metadata: Metadata = {
  title: "Aperçu de la fiche",
  robots: { index: false, follow: false, nocache: true },
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Brouillon — pas encore soumise",
  pending: "En revue — en attente de validation",
  rejected: "Rejetée — à corriger puis resoumettre",
  published: "Publiée — voici la fiche telle qu'elle est en ligne",
};

/**
 * APERÇU de la fiche — la même vue que la page publique (cf.
 * `ProductSheet`), alimentée par les données RÉELLES de la fiche, même si
 * elle n'est pas encore publiée.
 *
 * SÉCURITÉ (le point critique) :
 * - session obligatoire ;
 * - propriétaire de la fiche OU staff (rôle lu en BASE, jamais le miroir
 *   JWT) — sinon **404**, pas 403 : on ne confirme pas l'existence d'une
 *   fiche non publiée ;
 * - la garde est aussi dans le service (`fetchProductForPreview`) : un
 *   tiers ne voit pas la ligne, même en cas d'appel direct ;
 * - `noindex` + `X-Robots-Tag` + cache privé (jamais de CDN) ;
 * - pas de vote, pas de tracking des clics sortants, pas de comptage de
 *   vue : l'aperçu ne doit rien polluer des statistiques réelles.
 */
export default async function ProductPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/signin");

  // Rôle staff : la VRAIE source est la table `users.role` (le layout
  // admin fait pareil — un JWT périmé ne donne aucun droit).
  const [roleRow] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, sessionUser.id))
    .limit(1);
  const isStaff = roleRow?.role === "admin" || roleRow?.role === "moderateur";

  const found = await fetchProductForPreview(sessionUser.id, id, { isStaff });
  if (!found) notFound();
  const { product, shots } = found;
  // Etat reel du vote : l'aperçu montre la fiche telle qu'elle sera, y
  // compris le bouton de vote (force a "pas vote" avant).
  const previewVoted = (
    await getUserVotedIds(sessionUser.id, [product.id]).catch(() => new Set<string>())
  ).has(product.id);

  const socialLinks: Record<string, string> = {};
  const rawSocial = product.makerSocialLinks as unknown;
  if (rawSocial && typeof rawSocial === "object") {
    for (const [k, v] of Object.entries(rawSocial as Record<string, unknown>)) {
      if (typeof v === "string" && v !== "") socialLinks[k] = v;
    }
  }

  return (
    <>
      {/* Bandeau d'aperçu : la fiche n'est pas (encore) en ligne. */}
      <div className="container px-4 md:px-8 max-w-7xl mx-auto w-full pt-6 md:pt-10">
        <div className="flex flex-col gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/5 px-5 py-4 mb-8">
          <p className="text-[13px] font-black uppercase tracking-[0.14em] text-amber-600 dark:text-amber-400">
            Aperçu — ceci n&apos;est pas encore la page publique
          </p>
          <p className="text-[14px] font-medium text-foreground">
            {STATUS_LABEL[product.status] ?? product.status}
          </p>
          {product.rejectionReason && (
            <p className="text-[13px] text-muted-foreground">
              Motif du rejet : {product.rejectionReason}
            </p>
          )}
          <p className="text-[13px] text-muted-foreground">
            Voici exactement la fiche telle qu’un visiteur la verra une fois publiée. Les votes, les
            avis et les commentaires n’apparaissent pas encore.
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {/* Pas de « Modifier la fiche » ici : l'édition est réservée au
                propriétaire (le staff qui ouvre l'aperçu d'une fiche qu'il
                n'a pas créée tomberait sur « introuvable »). Le maker
                édite depuis son dashboard. */}
            {product.status === "published" && (
              <Link
                href={`/products/${product.slug}`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border/50 text-[13px] font-bold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
              >
                Voir la page publique
              </Link>
            )}
          </div>
        </div>
      </div>

      <ProductSheet
        preview
        header={{
          id: product.id,
          name: product.name,
          tagline: product.tagline,
          categoryId: product.category,
          makerUsername: product.makerUsername,
          makerDisplayName: product.makerDisplayName,
          makerAvatarUrl: product.makerAvatarUrl,
          votes: product.upvoteCount,
          initialVoted: previewVoted,
          iconUrl: product.iconUrl,
          initials: appInitialsFor(product.name),
          iconGradient: appGradientFor(product.id),
          curated: product.curated,
          commentsCount: product.commentsCount,
          apk: null,
        }}
        shots={shots.map((s, i) => ({
          src: s.url,
          alt: s.caption || `Capture ${i + 1} de ${product.name}`,
          orientation: (s.orientation === "portrait" ? "portrait" : "landscape") as
            "portrait" | "landscape",
          width: s.width,
          height: s.height,
        }))}
        galleryOrientation={product.galleryOrientation === "portrait" ? "portrait" : "landscape"}
        description={product.description}
        productName={product.name}
        productId={product.id}
        videoUrl={product.links.video ?? null}
        sidebar={{
          productId: product.id,
          slug: product.slug,
          productName: product.name,
          tagline: product.tagline,
          productType: product.productType,
          links: product.links,
          installCommand: product.installCommand,
          unverifiedCount: 0,
          makerUsername: product.makerUsername,
          makerDisplayName: product.makerDisplayName,
          makerAvatarUrl: product.makerAvatarUrl,
          makerWebsiteUrl: product.makerWebsiteUrl,
          makerSocialLinks: socialLinks,
          categoryId: product.category,
          lifecycle: (["dev", "beta", "live"] as const).includes(
            product.lifecycle as "dev" | "beta" | "live",
          )
            ? (product.lifecycle as "dev" | "beta" | "live")
            : "live",
          tags: product.tags,
          pricingId: product.pricingModel,
          platforms: product.platforms,
          publishedAt: (product.publishedAt ?? product.createdAt).toISOString(),
          version: product.version,
          changelogUrl: product.links.changelog,
          license: product.license,
          requirements: product.requirements,
          audienceId: product.audience,
          hasAds: product.hasAds,
          hasInAppPurchase: product.hasInAppPurchase,
          sharesData: product.sharesData,
          targetCountries: product.targetCountries,
          languagesSupported: product.languagesSupported,
          votes: product.upvoteCount,
          initialVoted: previewVoted,
          iconUrl: product.iconUrl,
          initials: appInitialsFor(product.name),
          iconGradient: appGradientFor(product.id),
          latestBuild: null,
          downloadPath: null,
        }}
      />
    </>
  );
}
