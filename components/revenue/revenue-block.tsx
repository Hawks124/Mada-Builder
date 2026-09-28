import Link from "next/link";
import { TrendUpIcon } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import { cn, formatMoney } from "@/lib/utils";
import { RevenueBadge } from "./verified-revenue-badge";
import { RevenueSparkline } from "./revenue-sparkline";
import type { RevenueView } from "./revenue-types";

/**
 * Bloc « Revenus vérifiés » de la fiche produit.
 *
 * Rendu dans la grammaire de `/categories` : micro-label + filet, puis les
 * chiffres. Le MRR est le SEUL gros chiffre du site — c'est la preuve, donc il
 * mérite l'échelle ; tout le reste est en `11px label → valeur` comme partout
 * ailleurs.
 *
 * `badge_only` : ni le montant ni la courbe. Une courbe à axe visible trahit
 * l'échelle, donc en garder une ne masquerait rien — le choix du maker doit être
 * respecté au sens propre, y compris sur sa propre fiche.
 */
export function RevenueBlock({
  revenue,
  lastSyncedLabel,
  className,
}: {
  revenue: RevenueView;
  /** « Vérifié il y a 2 h » — calculé côté serveur, jamais à l'intérieur. */
  lastSyncedLabel: string;
  className?: string;
}) {
  const hidden = revenue.displayMode === "badge_only";
  const first = revenue.history[0] ?? revenue.mrrCents;
  const last = revenue.history[revenue.history.length - 1] ?? revenue.mrrCents;
  const growthPct = first > 0 ? Math.round(((last - first) / first) * 100) : 0;

  return (
    <section className={cn("flex flex-col", className)} aria-labelledby="revenus-verifies">
      {/* ── Entête : micro-label + provider + fraîcheur, sur une seule ligne ── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pb-3 border-b border-border/40">
        <h2
          id="revenus-verifies"
          className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground"
        >
          Revenus vérifiés
        </h2>
        <RevenueBadge revenue={revenue} mode="sans-montant" size="md" />
        <span className="ml-auto text-[11px] font-medium text-muted-foreground">
          {lastSyncedLabel}
        </span>
      </div>

      {hidden ? (
        /* ── Montant masqué : ni chiffre ni courbe ── */
        <div className="flex flex-col gap-3 pt-6">
          <p className="text-[15px] font-bold text-foreground">
            Ce produit génère des revenus vérifiés, son montant n&apos;est pas publié.
          </p>
          <p className="text-[14px] text-muted-foreground max-w-xl">
            Le maker a choisi de publier la vérification sans le chiffre. Le lien reste en lecture
            seule, seul le MRR agrégé est lu — jamais de donnée client.
          </p>
          <Link
            href="/revenue"
            className="self-start text-[13px] font-bold text-foreground hover:text-primary transition-colors"
          >
            Voir les produits qui publient leur MRR
          </Link>
        </div>
      ) : (
        <>
          {/* ── MRR + courbe ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8 items-end pt-8">
            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                Revenu mensuel récurrent
              </span>
              <span className="text-5xl md:text-6xl font-black tracking-tighter tabular-nums text-emerald-600 dark:text-emerald-400 leading-none">
                {formatMoney(revenue.mrrCents, "USD", { maximumFractionDigits: 0 })}
              </span>
            </div>
            <RevenueSparkline points={revenue.history} height={88} />
          </div>

          {/* ── Sous-métriques ── */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-6 md:gap-x-12 pt-8 mt-8 border-t border-border/20">
            <Metric
              label="Run rate annuel"
              value={formatMoney(revenue.arrCents, "USD", { compact: true })}
            />
            <Metric
              label="Abonnés actifs"
              value={revenue.activeSubscribers.toLocaleString("fr-FR")}
            />
            <Metric
              label="Évolution 90 j"
              value={`${growthPct >= 0 ? "+" : ""}${growthPct} %`}
              tone={growthPct >= 0 ? "emerald" : "neutral"}
              icon={growthPct >= 0 ? <TrendUpIcon weight="bold" className="h-4 w-4" /> : undefined}
            />
          </div>
        </>
      )}
    </section>
  );
}

function Metric({
  label,
  value,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: string;
  tone?: "neutral" | "emerald";
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "text-xl font-black tracking-tighter tabular-nums inline-flex items-center gap-1.5",
          tone === "emerald" ? "text-emerald-600 dark:text-emerald-400" : "text-foreground",
        )}
      >
        {icon}
        {value}
      </span>
    </div>
  );
}
