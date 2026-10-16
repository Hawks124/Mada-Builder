import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { FeaturedOverrideForm } from "@/components/admin/featured-override-form";
import { FeaturedPicker, type PickerRow } from "@/components/admin/featured-picker";
import { FeaturedHistory } from "@/components/admin/featured-history";
import { FeaturedProduct } from "@/components/home/featured-product";
import { appGradientFor, appInitialsFor, fetchAdminProducts } from "@/services/products.service";
import {
  getFeatured,
  getFeaturedHistory,
  getFeaturedSlotByProductId,
  toFeaturedCard,
} from "@/services/ranking.service";

// noindex strict — jamais indexé, même au backend.
export const metadata: Metadata = {
  title: "Admin — Produit du jour",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Produit du jour (staff).
 *
 * Deux états, portés par l'URL : sans paramètre, on voit le produit du jour et
 * on choisit ; `?produit=<id>`, on regarde l'aperçu de ce produit avant de
 * confirmer. Un aperçu au survol au lieu de ça déclencherait une requête par
 * ligne, ne marcherait pas sans JavaScript, et ne serait pas partageable.
 *
 * La liste ne montre que des produits pinnables (publiés, hors veille) : filtrer
 * côté navigateur ferait disparaître des produits valides quand la page est
 * pleine de produits en veille.
 */
export default async function AdminFeaturedPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cursor?: string; produit?: string }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";

  let cursor: { createdAt: Date; id: string } | null = null;
  if (params.cursor) {
    try {
      const parsed: unknown = JSON.parse(Buffer.from(params.cursor, "base64url").toString("utf-8"));
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        typeof (parsed as { createdAt?: unknown }).createdAt === "string" &&
        typeof (parsed as { id?: unknown }).id === "string"
      ) {
        cursor = {
          createdAt: new Date((parsed as { createdAt: string }).createdAt),
          id: (parsed as { id: string }).id,
        };
      }
    } catch {
      cursor = null;
    }
  }

  const [current, history, list, slot] = await Promise.all([
    getFeatured().catch(() => null),
    getFeaturedHistory(30).catch(() => []),
    fetchAdminProducts({
      isStaff: true,
      status: "published",
      curated: false,
      q,
      cursor,
      limit: 20,
    }).catch(() => ({ items: [], nextCursor: null })),
    params.produit
      ? getFeaturedSlotByProductId(params.produit).catch(() => null)
      : Promise.resolve(null),
  ]);

  const rows: PickerRow[] = list.items.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    tagline: r.tagline,
    iconUrl: r.iconUrl ?? null,
    initials: appInitialsFor(r.name),
    gradient: appGradientFor(r.id),
  }));

  const selected = slot ? { id: slot.productId, slug: slot.slug, name: slot.name } : null;

  return (
    <div className="w-full px-6 lg:px-12 pt-10 lg:pt-14 pb-24 flex flex-col gap-12">
      <PageHeader
        title="Produit du jour"
        subtitle="Le spot de la home. Choisissez à la main, ou rendez la main au palier automatique."
      />

      <FeaturedOverrideForm
        current={
          current ? { slug: current.slug, name: current.name, pinned: current.pinned } : null
        }
        selected={selected}
      />

      {slot ? (
        <section className="flex flex-col gap-4 border-t border-border/40 pt-8">
          <h2 className="text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">
            Aperçu — exactement ce qu&apos;un visiteur verra
          </h2>
          <div className="rounded-2xl border border-border/40 p-6">
            <FeaturedProduct product={toFeaturedCard(slot)} preview />
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-4 border-t border-border/40 pt-8">
        <h2 className="text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">
          Choisir un produit
        </h2>
        <FeaturedPicker
          initial={rows}
          nextCursor={
            list.nextCursor
              ? Buffer.from(
                  JSON.stringify({
                    createdAt: list.nextCursor.createdAt.toISOString(),
                    id: list.nextCursor.id,
                  }),
                ).toString("base64url")
              : null
          }
          q={q}
          selectedId={selected?.id ?? null}
        />
      </section>

      <section className="flex flex-col gap-4 border-t border-border/40 pt-8">
        <h2 className="text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">
          Historique
        </h2>
        <FeaturedHistory rows={history} />
      </section>
    </div>
  );
}
