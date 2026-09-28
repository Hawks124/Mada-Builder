import Link from "next/link";
import { cn, formatMoney } from "@/lib/utils";
import { AvatarImage } from "@/components/ui/avatar-image";
import { RevenueBadge } from "@/components/revenue/verified-revenue-badge";
import { RevenueSparkline } from "@/components/revenue/revenue-sparkline";
import type { RevenueView } from "@/components/revenue/revenue-types";

/**
 * Card « revenus vérifiés » de la home.
 *
 * C'est le SEUL endroit du site où un graphique est le contenu et non de la
 * décoration : le ranked `/revenue` et la fiche produit ont une ligne, la home
 * a besoin de l'wow. D'où la card conservée — mais alignée sur la grammaire du
 * reste (tokens typo du site, badge partagé, courbe partagée, pas de recharts,
 * pas de glow, pas d'ombre au survol).
 */
export function VerifiedRevenueCard({
  productId,
  productName,
  productTagline,
  initials,
  iconGradient,
  makerName,
  makerAvatar,
  revenue,
  lastSyncedLabel,
  className,
}: {
  productId: string;
  productName: string;
  productTagline: string;
  initials: string;
  iconGradient: string;
  makerName: string;
  makerAvatar: string;
  revenue: RevenueView;
  /** « Vérifié il y a 2 h » — calculé côté serveur. */
  lastSyncedLabel: string;
  className?: string;
}) {
  const hidden = revenue.displayMode === "badge_only";

  return (
    <div
      className={cn(
        "group relative flex flex-col rounded-[10px] border border-border/40 bg-muted/30 p-6 transition-colors hover:bg-muted/60",
        className,
      )}
    >
      {/* ── Icon + provider, rangé sur une seule ligne ── */}
      <div className="flex items-center justify-between gap-3">
        <span
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br text-[15px] font-black text-white",
            iconGradient,
          )}
        >
          {initials}
        </span>
        <RevenueBadge revenue={revenue} mode="texte" size="md" />
      </div>

      {/* ── Nom + tagline ── */}
      <div className="mt-4 flex flex-col gap-0.5">
        <h3 className="truncate text-[15px] font-extrabold tracking-tight text-foreground">
          {productName}
        </h3>
        <p className="truncate text-[12px] font-medium text-muted-foreground">{productTagline}</p>
      </div>

      {hidden ? (
        /* ── Montant masqué : pas de chiffre, pas de courbe ── */
        <div className="mt-5 flex flex-col gap-1">
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
            Revenu mensuel
          </span>
          <span className="text-xl font-black tracking-tighter text-foreground">
            Montant masqué
          </span>
          <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
            Le maker publie la vérification sans le chiffre.
          </p>
        </div>
      ) : (
        <>
          {/* ── MRR ── */}
          <div className="mt-5 flex items-end justify-between gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                Revenu mensuel
              </span>
              <span className="text-3xl font-black tabular-nums tracking-tighter text-emerald-600 dark:text-emerald-400 leading-none">
                {formatMoney(revenue.mrrCents, "USD", { maximumFractionDigits: 0 })}
              </span>
            </div>
            <span className="text-[11px] font-medium text-muted-foreground pb-1">
              {lastSyncedLabel}
            </span>
          </div>

          {/* ── Courbe 90 j ── */}
          <div className="mt-4">
            <RevenueSparkline points={revenue.history} height={56} />
          </div>

          {/* ── Sous-métriques ── */}
          <div className="mt-4 flex items-center gap-5 border-t border-border/20 pt-4">
            <SubMetric
              label="Run rate annuel"
              value={formatMoney(revenue.arrCents, "USD", { compact: true })}
            />
            <span className="h-7 w-px bg-border/50" />
            <SubMetric label="Abonnés" value={revenue.activeSubscribers.toLocaleString("fr-FR")} />
          </div>
        </>
      )}

      {/* ── Maker ── */}
      <div className="mt-5 flex items-center gap-2 border-t border-border/20 pt-4">
        <AvatarImage
          src={makerAvatar}
          name={makerName}
          size={22}
          className="grayscale group-hover:grayscale-0 transition-all"
        />
        <span className="truncate text-[12px] font-bold text-foreground">{makerName}</span>
        <Link
          href={`/products/${productId}`}
          className="ml-auto text-[11px] font-bold text-muted-foreground transition-colors hover:text-foreground"
        >
          Voir
        </Link>
      </div>
    </div>
  );
}

function SubMetric({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex flex-col">
      <span className="text-[13px] font-extrabold tabular-nums text-foreground">{value}</span>
      <span className="text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
    </span>
  );
}
