import type { ReactNode } from "react";
import { ProductHeader, type ProductHeaderData } from "@/components/product/product-header";
import { ProductGallery, type GalleryShot } from "@/components/product/product-gallery";
import { ProductAbout } from "@/components/product/product-about";
import { ProductVideoBanner } from "@/components/product/product-links";
import { ProductVerifiedRevenue } from "@/components/product/product-verified-revenue";
import { ProductSidebar, type ProductSidebarData } from "@/components/product/product-sidebar";
import type { GalleryOrientation } from "@/config/product-types";

/**
 * La FICHE, en un seul endroit.
 *
 * Pourquoi extraire : l'aperçu d'un produit en revue (ce que le maker veut
 * voir avant publication, comme le store preview de Google Play Console)
 * doit être **la même vue** que la fiche publique — sinon l'aperçu
 * dérive de la reality et le maker se fait avoir. Une vue, deux portes :
 * la page publique et la page d'aperçu.
 *
 * `children` = les sections « vivantes » (builds, produits similaires,
 * avis, commentaires) : elles n'existent que sur la fiche publiée, pas
 * dans l'aperçu d'une fiche qui n'est pas encore en ligne.
 *
 * `preview` neutralise ce qui n'a pas de sens hors ligne : le vote (une
 * fiche en revue n'est pas votable) et le tracking des clics sortants (le
 * maker ne doit pas gonfler ses propres statistiques en testant sa fiche).
 */
export function ProductSheet({
  header,
  shots,
  galleryOrientation,
  description,
  productName,
  productId,
  videoUrl,
  sidebar,
  breadcrumb,
  children,
  preview = false,
}: {
  header: ProductHeaderData;
  shots: GalleryShot[];
  galleryOrientation: GalleryOrientation;
  /** Description (markdown) — rendue par `ProductAbout`. */
  description: string;
  /** Nom du produit (alt de la description, libellé de la vidéo). */
  productName: string;
  productId: string;
  /** Vidéo de présentation (facultatif). */
  videoUrl?: string | null;
  /** Sidebar : liens, plateformes, pricing, maker… */
  sidebar: ProductSidebarData;
  /** Fil d'Ariane (au-dessus de la grille, même conteneur). */
  breadcrumb?: ReactNode;
  /** Sections « vivantes » (publiques seulement). */
  children?: ReactNode;
  /** Mode aperçu : pas de vote, pas de tracking sortant. */
  preview?: boolean;
}) {
  return (
    <div className="container px-4 md:px-8 max-w-7xl mx-auto w-full pt-6 md:pt-10 pb-24 relative z-10">
      {breadcrumb}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 md:gap-16 items-start">
        {/* Main Content (~65%) */}
        <div className="lg:col-span-8 flex flex-col gap-10 md:gap-12">
          <ProductHeader product={header} preview={preview} />
          <ProductGallery shots={shots} galleryOrientation={galleryOrientation} />
          {videoUrl ? (
            <section className="flex flex-col gap-4" aria-label="Démo vidéo">
              <h2 className="text-2xl font-extrabold tracking-tight text-foreground">Démo vidéo</h2>
              <ProductVideoBanner
                videoUrl={videoUrl}
                productId={productId}
                trackOutbound={!preview}
              />
            </section>
          ) : null}
          <ProductAbout name={productName} markdown={description} />
          <ProductVerifiedRevenue productId={productId} />
          {children}
        </div>

        {/* Sticky Sidebar (~35%) */}
        <div className="lg:col-span-4 lg:sticky lg:top-6">
          <ProductSidebar product={sidebar} preview={preview} />
        </div>
      </div>
    </div>
  );
}
