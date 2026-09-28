import { cn } from "@/lib/utils";

const VIEW_W = 100;

/** Marge intérieure de la courbe, en fraction de hauteur : le trait ne touche jamais le bord. */
const PAD = 0.06;

export type TrendScale = {
  min: number;
  max: number;
  span: number;
  /** Position verticale en **% depuis le haut du cadre**. */
  top: (v: number) => number;
};

/**
 * Échelle unique d'une courbe de MRR.
 *
 * Exportée parce que deux objets se superposent sur le graphique : la courbe
 * (dans le SVG, qui s'étire) et les marqueurs (en HTML positionné). S'ils
 * n'utilisaient pas la même fonction, le point « aujourd'hui » serait décalé
 * de 1 à 2px par rapport à la courbe — assez pour se voir.
 */
export function trendScale(points: number[]): TrendScale {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  return {
    min,
    max,
    span,
    top: (v: number) => (PAD + (1 - (v - min) / span) * (1 - 2 * PAD)) * 100,
  };
}

/**
 * Sparkline MRR — la SEULE courbe de la feature.
 *
 * SVG inline plutôt que recharts : la lib n'était importée que par la card
 * home (~100 ko) pour dessiner une courbe sans axes ni tooltip, sur un site
 * où le PRD §16 demande <200 ms sur les pages cachées. Un `viewBox` fixe en
 * `preserveAspectRatio="none"` étire la courbe à la largeur du conteneur, et
 * `vector-effect="non-scaling-stroke"` empêche l'étirement de déformer le
 * trait.
 *
 * `preserveAspectRatio="none"` étire aussi les cercles en ellipses : c'est
 * pourquoi les points de repère de `RevenueTrend` sont posés en HTML
 * pourcentage autour du SVG, et non dessinés dedans.
 */
export function RevenueSparkline({
  points,
  height = 28,
  className,
}: {
  /** MRR en centimes, du plus ancien au plus récent. */
  points: number[];
  height?: number;
  className?: string;
}) {
  if (points.length < 2) return null;

  const { top } = trendScale(points);
  const step = VIEW_W / (points.length - 1);
  const y = (v: number) => (top(v) / 100) * height;

  const line = points
    .map((v, i) => `${i === 0 ? "M" : "L"} ${(i * step).toFixed(2)} ${y(v).toFixed(2)}`)
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${height}`}
      preserveAspectRatio="none"
      height={height}
      aria-hidden="true"
      focusable="false"
      className={cn("w-full text-emerald-600 dark:text-emerald-400", className)}
    >
      <path
        d={`${line} L ${VIEW_W} ${height} L 0 ${height} Z`}
        className="fill-current opacity-[0.12]"
      />
      <path
        d={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
