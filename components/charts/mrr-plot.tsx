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
import { cn, formatMoney } from "@/lib/utils";
import {
  AXIS,
  CURSOR,
  PlotTooltip,
  activeDot,
  compact,
  makeDateTick,
  makeValueTick,
} from "./plot-kit";
import { tickBudget, tickIndices } from "./palette";

/**
 * Revenu vérifié maker — AreaChart émeraude (grammaire plot-kit : ligne +
 * dégradé + vide, tooltip nu, range 30/90). Le vert est réservé au statut
 * et à l'argent : ici c'est l'argent. Données réelles (série journalière
 * devise dominante) ou vide honnête avec marche à suivre.
 */
type Range = 30 | 90;

export function MrrPlot({
  days,
  currency,
  className,
}: {
  days: { label: string; value: number }[];
  currency: string;
  className?: string;
}) {
  const [range, setRange] = React.useState<Range>(30);
  const data = React.useMemo(
    () => (days.length > range ? days.slice(-range) : days),
    [days, range],
  );
  const [chartWidth, setChartWidth] = React.useState(0);
  const ticks = React.useMemo(
    () =>
      tickIndices(data.length, tickBudget(chartWidth))
        .map((i) => data[i]?.label)
        .filter((l): l is string => !!l),
    [data, chartWidth],
  );
  const tickRenderer = React.useMemo(() => makeDateTick(ticks), [ticks]);

  const last = data[data.length - 1];
  const first = data[0];
  const delta =
    first && first.value > 0 && last
      ? Math.round(((last.value - first.value) / first.value) * 100)
      : 0;

  if (data.length < 2) {
    return (
      <section className={cn("flex flex-col gap-5", className)}>
        <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-black leading-none tracking-tight tabular-nums text-foreground">
              {formatMoney(last?.value ?? 0, currency, { maximumFractionDigits: 0 })}
            </span>
            <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">
              MRR vérifié
            </span>
          </div>
        </header>
        <p className="max-w-[56ch] text-[14px] font-medium leading-relaxed text-muted-foreground">
          Pas encore d&apos;historique. Connectez une facturation depuis la fiche de votre produit :
          la courbe se remplit à chaque sync horaire.
        </p>
      </section>
    );
  }

  return (
    <section className={cn("flex flex-col gap-5", className)}>
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-black leading-none tracking-tight tabular-nums text-foreground">
            {formatMoney(last?.value ?? 0, currency, { maximumFractionDigits: 0 })}
          </span>
          <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-muted-foreground/70">
            MRR vérifié
          </span>
          <span
            className={cn(
              "text-[13px] font-bold tabular-nums",
              delta >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-500 dark:text-red-400",
            )}
          >
            {delta >= 0 ? "+" : ""}
            {delta} %
          </span>
        </div>
        <div className="flex items-center gap-1 rounded-full border border-border/40 p-1">
          {([30, 90] as const).map((r) => (
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

      <div style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%" onResize={(w) => setChartWidth(w)}>
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="mrr-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.22} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} />

            <XAxis dataKey="label" {...AXIS} height={26} ticks={ticks} tick={tickRenderer} />
            <YAxis
              {...AXIS}
              width={46}
              tickCount={4}
              tickFormatter={compact}
              tick={makeValueTick}
            />

            <Tooltip
              content={<PlotTooltip format={(n) => formatMoney(n, currency, { compact: true })} />}
              cursor={CURSOR}
              animationDuration={120}
            />

            <Area
              type="monotone"
              dataKey="value"
              name="MRR"
              stroke="#10b981"
              strokeWidth={2}
              fill="url(#mrr-fill)"
              dot={false}
              activeDot={activeDot}
              animationDuration={500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
