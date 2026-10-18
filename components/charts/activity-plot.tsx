"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import type { ChartDay } from "@/services/dashboard.service";
import {
  AXIS,
  CURSOR,
  PlotTooltip,
  activeDot,
  compact,
  makeDateTick,
  makeValueTick,
} from "./plot-kit";
import { SERIES, tickBudget, tickIndices } from "./palette";

/**
 * Activité dans le temps — vues et clics.
 *
 * **Vues en gris, clics en bleu.** Le gris garde le rôle de série de
 * référence : il est présent partout, donc il ne porte pas d'identité à
 * retenir. Le bleu ne sert qu'ici — le vert est réservé au statut, sinon le
 * même mot graphique désignerait deux choses selon le panneau.
 *
 * Le pointillé du bleu est conservé : la couleur n'est jamais le seul signal
 * qui sépare les deux séries (WCAG 1.4.1).
 *
 * La légende est un en-tête composé à la main : le `<Legend>` de Recharts
 * positionne sa boîte et impose son rendu, donc elle n'est pas utilisée.
 */

type Range = 30 | 90;

export function ActivityPlot({
  points,
  height = 260,
  className,
}: {
  points: ChartDay[];
  height?: number;
  className?: string;
}) {
  const [range, setRange] = React.useState<Range>(30);
  const data = React.useMemo(
    () => (points.length > range ? points.slice(-range) : points),
    [points, range],
  );

  // Le nombre de dates suit la largeur mesurée, pas une constante : six
  // libellés ne tiennent pas au téléphone (voir `tickBudget`).
  const [chartWidth, setChartWidth] = React.useState(0);
  const ticks = React.useMemo(
    () =>
      tickIndices(data.length, tickBudget(chartWidth))
        .map((i) => data[i]?.label)
        .filter((l): l is string => !!l),
    [data, chartWidth],
  );

  // Mémoïsé : Recharts prend `tick` comme type de composant, une nouvelle
  // fonction à chaque rendu ferait remonter tous les ticks.
  const tickRenderer = React.useMemo(() => makeDateTick(ticks), [ticks]);

  const last = data[data.length - 1];
  const peak = data.reduce((best, p, i) => (p.views > data[best]!.views ? i : best), 0);
  const launch = data[peak]!;

  // Le libellé annonce « sur N jours » : c'est le cumul de la fenêtre. Lire le
  // dernier point affichait la journée en cours sous un titre de total.
  const sum = (key: "views" | "clicks" | "downloads") => data.reduce((s, p) => s + p[key], 0);

  return (
    <section className={cn("flex flex-col gap-5", className)}>
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="flex items-baseline gap-6">
          <Readout value={compact(sum("views"))} label="vues" range={range} />
          <Readout
            value={compact(sum("clicks"))}
            label="clics"
            range={range}
            color={SERIES.clicks}
          />
          <Readout
            value={compact(sum("downloads"))}
            label="téléchargements"
            range={range}
            color={SERIES.downloads}
          />
        </div>
        <div className="flex items-center gap-1 self-start rounded-full border border-border/50 p-1">
          {([30, 90] as Range[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              aria-pressed={range === r}
              className={cn(
                "cursor-pointer rounded-full px-3 py-1 text-[12px] font-bold transition-colors",
                range === r
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {r} jours
            </button>
          ))}
        </div>
      </header>

      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%" onResize={(w) => setChartWidth(w)}>
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="views-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--foreground)" stopOpacity={0.14} />
                <stop offset="100%" stopColor="var(--foreground)" stopOpacity={0} />
              </linearGradient>
            </defs>

            {/* Aucune grille : une seule ligne de base, portée par l'axe X. */}
            <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} />

            <XAxis dataKey="label" {...AXIS} height={26} ticks={ticks} tick={tickRenderer} />
            <YAxis
              {...AXIS}
              width={46}
              tickCount={4}
              tickFormatter={compact}
              tick={makeValueTick}
            />

            <Tooltip content={<PlotTooltip />} cursor={CURSOR} animationDuration={120} />

            <Area
              type="monotone"
              dataKey="views"
              name="vues"
              stroke="var(--foreground)"
              strokeWidth={2}
              fill="url(#views-fill)"
              dot={false}
              activeDot={activeDot}
              animationDuration={500}
            />
            <Line
              type="monotone"
              dataKey="clicks"
              name="clics"
              stroke={SERIES.clicks}
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={false}
              activeDot={activeDot}
              animationDuration={500}
            />
            <Line
              type="monotone"
              dataKey="downloads"
              name="téléchargements"
              stroke={SERIES.downloads}
              strokeWidth={2}
              dot={false}
              activeDot={activeDot}
              animationDuration={500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <footer className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <p className="text-[12px] font-medium text-muted-foreground/70">
          {data[0]?.label} → {last?.label}
        </p>
        <p className="text-[12px] font-medium text-muted-foreground">
          Pic le {launch.label} :{" "}
          <span className="font-black text-foreground">{compact(launch.views)}</span> vues
        </p>
      </footer>
    </section>
  );
}

function Readout({
  value,
  label,
  range,
  color,
}: {
  value: string;
  label: string;
  range: Range;
  color?: string;
}) {
  return (
    <span className="flex flex-col">
      {/* La couleur du chiffre reprend celle de sa courbe : l'en-tête tient lieu
          de légende, autant qu'il parle la même langue que le graphique. */}
      <span
        className="text-3xl font-black leading-none tracking-tight tabular-nums"
        style={color ? { color } : undefined}
      >
        {value}
      </span>
      <span className="mt-1 text-[12px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">
        {label} sur {range} jours
      </span>
    </span>
  );
}
