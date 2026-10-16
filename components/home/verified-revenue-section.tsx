import Link from "next/link";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";
import { VerifiedRevenueCard } from "./verified-revenue";
import { RevenueMethodology } from "./revenue-methodology";
import { getRevenueRankingGroups } from "@/services/revenue/views";
import type { RevenueView } from "@/components/revenue/revenue-types";

/**
 * Section « Revenus vérifiés » de la home (données réelles).
 *
 * Les cartes sont les 3 premiers du classement `/revenue` (devise
 * dominante) — une seule source de vérité : impossible que la home mette
 * en avant un produit absent du classement. Top vide = rien rendu (pas
 * de CTA fantôme vers un classement vide : `/revenue` porte déjà son
 * propre vide honnête).
 */
export async function VerifiedRevenueSection() {
  const groups = await getRevenueRankingGroups().catch(() => []);
  const top = (groups[0]?.items ?? []).slice(0, 3);
  if (top.length === 0) return null;

  return (
    <section className="container px-4 md:px-8 max-w-7xl mx-auto w-full pt-16 pb-24">
      {/* ── En-tête ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tighter text-foreground leading-none">
            Ils buildent. Ils prouvent.
          </h2>
          <p className="text-muted-foreground font-medium tracking-tight">
            Des makers malgaches qui génèrent de vrais revenus — lus directement chez leur
            prestataire, jamais déclarés à la main.
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
          const view: RevenueView = {
            provider: record.provider,
            displayMode: "full",
            mrrCents: record.mrrCents,
            arrCents: record.mrrCents * 12,
            activeSubscribers: record.subscriberCount,
            currency: groups[0].currency,
            lastSyncedAt: record.lastSyncedAt,
            lastSyncedLabel: record.lastSyncedLabel,
            history: record.history,
          };
          return (
            <VerifiedRevenueCard
              key={record.productId}
              productId={record.slug}
              productName={record.name}
              productTagline={record.tagline}
              initials={record.initials}
              iconGradient={record.iconGradient}
              makerName={record.makerDisplayName}
              makerAvatar={record.makerAvatarUrl ?? ""}
              revenue={view}
              lastSyncedLabel={view.lastSyncedLabel}
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
