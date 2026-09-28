import { cn } from "@/lib/utils";
import { RevenueSparkline, trendScale } from "./revenue-sparkline";

/**
 * Courbe de MRR annotée — la version du classement.
 *
 * Une sparkline seule est de la décoration : sans échelle, on ne sait pas si le
 * produit a doublé ou perdu 3 %. Trois repères la rendent lisible d'un coup
 * d'œil, et **aucun n'ajoute de JavaScript** — tout est du HTML positionné en
 * pourcentage, donc le composant reste serveur :
 *
 * - la **ligne de référence** en pointillé au niveau du MRR d'il y a 90 jours :
 *   au-dessus, le produit a grandi depuis ; en dessous, il a rétréci ;
 * - le **point actuel** à droite : où il en est aujourd'hui ;
 * - le **marqueur de creux**, seulement s'il y a eu une vraie baisse (plus de
 *   5 % sous le point de départ) : une ligne qui descend puis remonte ne
 *   doit pas passer inaperçue.
 *
 * Les repères sont posés en HTML et non dans le SVG parce que
 * `preserveAspectRatio="none"` déforme les cercles en ellipses selon le
 * rapport largeur/hauteur de la ligne. La courbe, elle, reste dans le SVG.
 */
export function RevenueTrend({
  points,
  height = 40,
  className,
}: {
  /** MRR en centimes, du plus ancien au plus récent. */
  points: number[];
  height?: number;
  className?: string;
}) {
  if (points.length < 2) return null;

  const { top } = trendScale(points);
  const first = points[0]!;
  const last = points[points.length - 1]!;

  // Premier point nettement sous le départ : c'est le creux qu'on signale.
  let dip: { value: number; x: number } | null = null;
  for (let i = 1; i < points.length; i++) {
    if (points[i]! < first * 0.95) {
      dip = { value: points[i]!, x: (i / (points.length - 1)) * 100 };
      break;
    }
  }

  return (
    <div className={cn("relative w-full", className)} style={{ height }}>
      {/* Référence : où était le MRR il y a 90 jours */}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 border-t border-dashed border-border/70"
        style={{ top: `${top(first)}%` }}
      />

      <RevenueSparkline points={points} height={height} className="absolute inset-0" />

      {dip && (
        <span
          aria-hidden="true"
          title="Creux sur la période"
          className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/80"
          style={{ left: `${dip.x}%`, top: `${top(dip.value)}%` }}
        />
      )}

      {/* Valeur aujourd'hui */}
      <span
        aria-hidden="true"
        className="absolute right-0 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500 ring-2 ring-background"
        style={{ top: `${top(last)}%` }}
      />
    </div>
  );
}
