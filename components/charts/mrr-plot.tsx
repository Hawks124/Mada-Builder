import { RevenueTrend } from "@/components/revenue/revenue-trend";
import { BetaPill } from "@/components/ui/beta-pill";
import { cn } from "@/lib/utils";

/**
 * MRR vérifié sur 90 jours.
 *
 * **Réutilise `RevenueTrend` tel quel** — cette courbe existe déjà en
 * production sur `/revenue` et sur les fiches produit, avec ses trois repères
 * (référence à 90 jours, point actuel, creux). La réécrire produirait un
 * deuxième graphique différent pour la même donnée.
 *
 * **Bêta** : dépend d'une facturation connectée, absente de la plupart des
 * comptes. Le panneau reste visible et explique pourquoi il est vide.
 */

export function MrrPlot({
  pointsCents,
  connected,
  className,
}: {
  /** MRR en centimes, du plus ancien au plus récent. */
  pointsCents: number[];
  connected: boolean;
  className?: string;
}) {
  const last = pointsCents[pointsCents.length - 1] ?? 0;
  const currency = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  return (
    <section className={cn("flex flex-col gap-5", className)}>
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-black leading-none tracking-tight tabular-nums text-foreground">
            {connected ? currency.format(last / 100) : "—"}
          </span>
          <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">
            MRR vérifié
          </span>
          <BetaPill />
        </div>
      </header>

      {connected && pointsCents.length > 1 ? (
        <RevenueTrend points={pointsCents} height={64} />
      ) : (
        <p className="max-w-[56ch] text-[14px] font-medium leading-relaxed text-muted-foreground">
          {connected
            ? "Pas encore d’historique : la courbe se remplira après quelques "
            : "Reliez une facturation Stripe ou RevenueCat en lecture seule, et le chiffre lu chez votre prestataire s’affichera ici — déclaré par vous, jamais."}
          synchronisations.
        </p>
      )}
    </section>
  );
}
