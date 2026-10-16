"use client";

import { cn } from "@/lib/utils";
import type { XAxisTickContentProps, YAxisTickContentProps } from "recharts";

/** Personnalisation des graphiques — une seule fois, réutilisée partout.
 *  Recharts impose barres d'axe, grille, infobulle carrée et légende : ici un
 *  graphique est une ligne, un dégradé et du vide. */

/** 1 234 → « 1,2 k ». Les axes restent lisibles sans empiler les zéros. */
export function compact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(".", ",")} M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1).replace(".", ",")} k`;
  return String(Math.round(n * 100) / 100);
}

/** Aucune barre, aucune ligne : l'axe est un texte, pas un trait. */
export const AXIS = {
  axisLine: false,
  tickLine: false,
} as const;

export const AXIS_TEXT = "text-[11px] font-bold tabular-nums text-muted-foreground/70";
export const GRID_STROKE = "var(--border)";

/** Rendu commun : Recharts type le tick X et le tick Y séparément. */
function axisLabel(x: number, y: number, value: string, anchor: "start" | "middle" | "end") {
  return (
    <text
      x={x}
      y={y}
      className={AXIS_TEXT}
      textAnchor={anchor}
      dominantBaseline="hanging"
      dy={10}
      fill="currentColor"
    >
      {value}
    </text>
  );
}

/** Étiquette d'axe X calée sur les bords : une graduation centrée sur la
 *  première ou la dernière position déborde et touche l'axe des valeurs.
 *  Extrémités reconnues par leur valeur, pas par `index` (non garanti). */
export function makeDateTick(ticks: readonly string[]) {
  const first = ticks[0];
  const last = ticks[ticks.length - 1];
  return (props: XAxisTickContentProps) => {
    const value = String(props.payload?.value ?? "");
    const anchor = value === first ? "start" : value === last ? "end" : "middle";
    return axisLabel(Number(props.x ?? 0), Number(props.y ?? 0), value, anchor);
  };
}

export function makeValueTick(props: YAxisTickContentProps) {
  return axisLabel(
    Number(props.x ?? 0),
    Number(props.y ?? 0),
    String(props.payload?.value ?? ""),
    "end",
  );
}

/** Infobulle sans habillage Recharts : le chiffre domine, l'étiquette passe
 *  au-dessus. */
export function PlotTooltip({
  active,
  label,
  payload,
  format = compact,
}: {
  active?: boolean;
  label?: string | number;
  payload?: Array<{ name?: string; value?: number; color?: string; dataKey?: string }>;
  format?: (n: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="pointer-events-none flex flex-col gap-1.5 rounded-xl border border-border/70 bg-background/95 px-3 py-2 shadow-lg backdrop-blur-sm">
      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">
        {label}
      </span>
      {payload.map((entry) => (
        <span key={entry.dataKey ?? entry.name} className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: entry.color ?? "var(--foreground)" }}
          />
          <span className="text-[13px] font-black tabular-nums text-foreground">
            {format(entry.value ?? 0)}
          </span>
          <span className="text-[12px] font-medium text-muted-foreground">{entry.name}</span>
        </span>
      ))}
    </div>
  );
}

/** Point actif : un anneau plutôt que le disque plein. Il marque la position
 *  survolée, pas la série — d'où le premier plan. */
export function activeDot({ cx, cy }: { cx?: number; cy?: number }) {
  if (cx === undefined || cy === undefined) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={6} fill="var(--background)" />
      <circle cx={cx} cy={cy} r={4} fill="var(--foreground)" />
    </g>
  );
}

/** Curseur d'infobulle, commun aux deux séries. */
export const CURSOR = {
  stroke: "var(--foreground)",
  strokeOpacity: 0.25,
  strokeWidth: 1,
} as const;

/** Séparateur de section : un filet, jamais une carte. */
export function SectionRule({ className }: { className?: string }) {
  return <hr className={cn("border-t border-border/40", className)} />;
}
