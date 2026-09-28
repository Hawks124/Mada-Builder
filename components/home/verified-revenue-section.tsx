import Link from "next/link";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";
import { VerifiedRevenueCard } from "./verified-revenue";
import { RevenueMethodology } from "./revenue-methodology";
import { getRevenueRecords } from "@/services/revenue-mock.service";
import { formatSyncedLabel } from "@/components/revenue/revenue-derive";
import { getCatalog } from "@/services/catalog-mock.service";
import type { RevenueView } from "@/components/revenue/revenue-types";

/**
 * Section « Revenus vérifiés » de la home.
 *
 * Composant **serveur** : plus de jeu de données local. Les cartes sont les 3
 * premiers produits du catalogue qui ont un MRR vérifié — donc exactement les
 * mêmes que le classement `/revenue` et que le tri « Revenus MRR » de
 * `/discover`. Une seule source de vérité : impossible que la home mette en
 * avant un produit absent du classement.
 */
export function VerifiedRevenueSection() {
  const top = getRevenueRecords()
    .filter((r) => r.displayMode === "full")
    .sort((a, b) => b.mrrCents - a.mrrCents)
    .slice(0, 3);

  const products = new Map(getCatalog().map((p) => [p.id, p]));

  return (
    <section className="container px-4 md:px-8 max-w-7xl mx-auto w-full pt-16 pb-24">
      {/* ── En-tête ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tighter text-foreground leading-none">
            Ils buildent. Ils prouvent.
          </h2>
          <p className="text-muted-foreground font-medium tracking-tight">
            Des makers malgaches qui génèrent de vrais revenus — lus directement chez Stripe et
            RevenueCat, jamais déclarés à la main.
          </p>
        </div>

        <div className="flex items-center gap-5 shrink-0">
          <RevenueMethodology />
          <Link
            href="/revenue"
            className="group flex items-center gap-2 text-[13px] font-bold text-foreground hover:text-primary transition-colors"
          >
            Classement MRR
            <ArrowRightIcon
              weight="bold"
              className="w-4 h-4 group-hover:translate-x-1 transition-transform"
            />
          </Link>
        </div>
      </div>

      {/* ── Cartes ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {top.map((record) => {
          const product = products.get(record.productId);
          if (!product) return null;
          const view: RevenueView = {
            provider: record.provider,
            displayMode: record.displayMode,
            mrrCents: record.mrrCents,
            arrCents: record.arrCents,
            activeSubscribers: record.activeSubscribers,
            lastSyncedAt: record.lastSyncedAt,
            history: record.history,
          };
          return (
            <VerifiedRevenueCard
              key={record.productId}
              productId={product.id}
              productName={product.name}
              productTagline={product.tagline}
              initials={product.initials}
              iconGradient={product.iconGradient}
              makerName={product.maker}
              makerAvatar={product.makerAvatar}
              revenue={view}
              lastSyncedLabel={formatSyncedLabel(record.syncedMinutesAgo)}
            />
          );
        })}
      </div>

      {/* ── CTA éditorial ── */}
      <div className="flex items-center justify-center mt-10 gap-4">
        <div className="h-px flex-1 bg-border/40" />
        <Link
          href="/revenue"
          className="text-xs font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
        >
          Voir tous les <span className="text-foreground">produits vérifiés</span> →
        </Link>
        <div className="h-px flex-1 bg-border/40" />
      </div>
    </section>
  );
}
