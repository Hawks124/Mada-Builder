import type { Metadata } from "next";
import Link from "next/link";
import { GridBackground } from "@/components/ui/grid-background";
import { RevenueRanking } from "@/components/revenue/revenue-ranking";
import { RevenueMethod } from "@/components/revenue/revenue-method";
import { getRevenueRankingGroups } from "@/services/revenue/views";

export const metadata: Metadata = {
  title: "Classement des revenus vérifiés | Mada-Made",
  description:
    "Les produits tech malgaches classés par revenu mensuel récurrent, lus directement chez Stripe, RevenueCat, Paddle, Polar et Lemon Squeezy en accès lecture seule. Aucun chiffre saisi à la main, aucun revenu auto-déclaré.",
};

export const dynamic = "force-dynamic";

/**
 * `/revenue` — le classement par MRR vérifié (données réelles).
 *
 * Zéro conversion : un onglet par devise (paramètre `?currency=`), chacun
 * son rang et son cumul. En-tête + méthodologie indexables (la crédibilité
 * ne se cache pas derrière un clic).
 */
export default async function RevenuePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const raw = typeof sp.currency === "string" ? sp.currency.toUpperCase() : null;
  const groups = await getRevenueRankingGroups().catch(() => []);
  const currency =
    raw && groups.some((g) => g.currency === raw) ? raw : (groups[0]?.currency ?? "USD");

  return (
    <div className="flex flex-col w-full min-h-[calc(100vh-72px)]">
      {/* ── En-tête ── */}
      <div className="relative w-full">
        <GridBackground variant="css" glowPlacement="centered" showBottomFade={false} />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-background via-background/70 to-transparent pointer-events-none" />

        <div className="relative container px-4 md:px-8 max-w-7xl mx-auto py-10">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2">
            Revenus vérifiés · Bêta
          </p>
          <h1 className="text-3xl md:text-[2.5rem] font-extrabold tracking-tighter text-foreground leading-none">
            Le classement MRR
          </h1>
          <p className="text-muted-foreground font-medium md:text-lg tracking-tight mt-3 max-w-2xl leading-relaxed">
            Chaque montant est lu chez le prestataire de paiement, en accès lecture seule. Aucun
            maker ne déclare son revenu, et personne — pas même un administrateur — ne peut éditer
            le chiffre affiché.
          </p>
          <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[12px] font-bold text-amber-700 dark:text-amber-400">
            Fonctionnalité en bêta : la sync est réelle, vos retours la durcissent.{" "}
            <Link href="/guides/revenus-verifies" className="underline underline-offset-2">
              Mode d&apos;emploi
            </Link>
          </p>
        </div>

        {/* ── La méthode, en clair et en indexable ── */}
        <div className="relative container px-4 md:px-8 max-w-7xl mx-auto pt-14 pb-16">
          <RevenueMethod />
        </div>
      </div>

      {/* ── Classement ── */}
      <section className="container px-4 md:px-8 max-w-7xl mx-auto w-full pb-24">
        <RevenueRanking groups={groups} currency={currency} />
      </section>
    </div>
  );
}
