import type { Metadata } from "next";
import { GridBackground } from "@/components/ui/grid-background";
import { RevenueRanking } from "@/components/revenue/revenue-ranking";
import { RevenueMethod } from "@/components/revenue/revenue-method";

export const metadata: Metadata = {
  title: "Classement des revenus vérifiés | Mada-Made",
  description:
    "Les produits tech malgaches classés par revenu mensuel récurrent, lus directement chez Stripe et RevenueCat en accès lecture seule. Aucun chiffre saisi à la main, aucun revenu auto-déclaré.",
};

/**
 * `/revenue` — le classement par MRR vérifié.
 *
 * Cette route est liée depuis le navbar et la home depuis le début, mais
 * n'existait pas : c'était un 404 sur toutes les pages.
 *
 * Pas de bouton « Comment ça marche ? » ici : la méthode est écrite sous le
 * titre, en contenu indexable. Sur une page dont la seule raison d'être est la
 * crédibilité, l'argument de crédibilité ne peut pas être caché derrière un clic
 * (cf. `RevenueMethod`).
 */
export default function RevenuePage() {
  return (
    <div className="flex flex-col w-full min-h-[calc(100vh-72px)]">
      {/* ── En-tête ── */}
      <div className="relative w-full">
        <GridBackground variant="css" glowPlacement="centered" showBottomFade={false} />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-background via-background/70 to-transparent pointer-events-none" />

        <div className="relative container px-4 md:px-8 max-w-7xl mx-auto py-10">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2">
            Revenus vérifiés
          </p>
          <h1 className="text-3xl md:text-[2.5rem] font-extrabold tracking-tighter text-foreground leading-none">
            Le classement MRR
          </h1>
          <p className="text-muted-foreground font-medium md:text-lg tracking-tight mt-3 max-w-2xl leading-relaxed">
            Chaque montant est lu chez le prestataire de paiement, en accès lecture seule. Aucun
            maker ne déclare son revenu, et personne — pas même un administrateur — ne peut éditer
            le chiffre affiché.
          </p>
        </div>

        {/* ── La méthode, en clair et en indexable ── */}
        <div className="relative container px-4 md:px-8 max-w-7xl mx-auto pt-14 pb-16">
          <RevenueMethod />
        </div>
      </div>

      {/* ── Classement ── */}
      <section className="container px-4 md:px-8 max-w-7xl mx-auto w-full pb-24">
        <RevenueRanking />
      </section>
    </div>
  );
}
