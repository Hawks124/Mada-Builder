"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import type { ChartDay } from "@/services/dashboard.service";
import { BetaPill } from "@/components/ui/beta-pill";
import { AXIS, CURSOR, PlotTooltip, activeDot, makeDateTick, makeValueTick } from "./plot-kit";
import { tickBudget, tickIndices } from "./palette";

/**
 * Votes reçus, **en cumul**.
 *
 * Même outillage que `ActivityPlot` — une série, aire en dégradé, infobulle
 * personnalisée. Isolé parce que l'unité change : un vote n'est pas une vue, et
 * mélanger les deux sur une même aire ne veut rien dire.
 *
 * Une seule série : aucune teinte. Il n'y a rien à distinguer d'un autre tracé,
 * donc la couleur n'aurait rien à dire.
 *
 * **Bêta** : la série de votes dans le temps n'est pas encore éprouvée côté
 * requête — d'où la pastille, honnête plutôt que discrète.
 */

type Range = 30 | 90;

export function VotesPlot({
  points,
  height = 200,
  className,
}: {
  points: ChartDay[];
  height?: number;
  className?: string;
}) {
  const [range, setRange] = React.useState<Range>(30);

  // **Cumulatif, pas quotidien.** Un ou deux votes par jour ne donnent qu'une
  // ligne plate à 0–2 : du bruit. Le maker veut savoir combien il en a amassed.
  // Forme pure — un accumulateur réassigné après le rendu est refusé par le
  // compilateur React, et à 90 points la somme directe ne coûte rien.
  const cumulative = React.useMemo(
    () =>
      points.map((p, i) => ({
        ...p,
        cumulative: points.slice(0, i + 1).reduce((s, q) => s + q.votes, 0),
      })),
    [points],
  );

  const data = React.useMemo(
    () => (cumulative.length > range ? cumulative.slice(-range) : cumulative),
    [cumulative, range],
  );

  const gained = data.reduce((s, p) => s + p.votes, 0);
  const last = data[data.length - 1]?.cumulative ?? 0;

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

  return (
    <section className={cn("flex flex-col gap-5", className)}>
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-black leading-none tracking-tight tabular-nums text-foreground">
            {last}
          </span>
          <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">
            votes cumulés
          </span>
          <BetaPill />
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
              {r} j
            </button>
          ))}
        </div>
      </header>

      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%" onResize={(w) => setChartWidth(w)}>
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="votes-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--foreground)" stopOpacity={0.2} />
                <stop offset="100%" stopColor="var(--foreground)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
            <XAxis dataKey="label" {...AXIS} height={26} ticks={ticks} tick={tickRenderer} />
            <YAxis {...AXIS} width={40} tickCount={4} tick={makeValueTick} />
            <Tooltip content={<PlotTooltip />} cursor={CURSOR} animationDuration={120} />
            <Area
              type="monotone"
              dataKey="cumulative"
              name="cumul"
              stroke="var(--foreground)"
              strokeWidth={2}
              fill="url(#votes-fill)"
              dot={false}
              activeDot={activeDot}
              animationDuration={500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <footer className="text-[12px] font-medium text-muted-foreground">
        +{gained} sur les {range} derniers jours. Le total ci-dessus court depuis la mise en ligne.
      </footer>
    </section>
  );
}
