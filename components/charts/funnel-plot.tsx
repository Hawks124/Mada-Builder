"use client";

import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, XAxis, YAxis } from "recharts";
import type { YAxisTickContentProps } from "recharts";
import { cn } from "@/lib/utils";
import { compact } from "./plot-kit";

/**
 * Tunnel vues → clics → votes.
 *
 * **L'axe Y porte l'étape ET le taux de passage vers l'étape suivante.**
 * C'est ce qui distingue un tunnel d'un graphique en barres : le taux de
 * conversion est l'information, pas la longueur de la barre.
 *
 * Un taux inférieur à 5 % est signalé en ambre — c'est un diagnostic, pas une
 * décoration.
 */

const STAGES = [
  { key: "views", label: "Vues", hint: "Ouvertures de vos fiches publiées" },
  { key: "clicks", label: "Clics sortants", hint: "Vers vos liens : site, stores, dépôt" },
  { key: "votes", label: "Votes reçus", hint: "Ceux qui vous endossent" },
] as const;

const FILL = ["var(--foreground)", "var(--foreground)", "var(--foreground)"];
const OPACITY = [0.7, 0.42, 0.22];

export function FunnelPlot({
  totals,
  className,
}: {
  totals: readonly number[];
  className?: string;
}) {
  const data = STAGES.map((stage, i) => ({
    stage: stage.label,
    value: totals[i] ?? 0,
    fill: FILL[i]!,
    conversion: i === 0 ? null : percent(totals[i] ?? 0, totals[i - 1] ?? 0),
    hint: stage.hint,
    weak: i > 0 && (totals[i - 1] ?? 0) > 0 && (totals[i] ?? 0) < (totals[i - 1] ?? 0) * 0.05,
  }));

  const top = totals[0] ?? 0;
  if (top <= 0) {
    return (
      <p className={cn("text-[14px] font-medium text-muted-foreground", className)}>
        Aucune vue enregistrée sur vos fiches publiées.
      </p>
    );
  }

  // Le tick est construit ici : il ferme sur `data`. Un composant de tick
  // déclaré à l'extérieur ne reçoit pas les lignes, seulement x/y/payload.
  const stageTick = (props: YAxisTickContentProps) => {
    const { x = 0, y = 0, payload } = props;
    const row = data.find((r) => r.stage === String(payload?.value ?? ""));
    return (
      <g transform={`translate(${x}, ${y})`}>
        <text
          x={0}
          y={0}
          textAnchor="end"
          dominantBaseline="middle"
          className="fill-foreground text-[14px] font-bold"
        >
          {String(payload?.value ?? "")}
        </text>
        {row?.conversion ? (
          <text
            x={0}
            y={18}
            textAnchor="end"
            dominantBaseline="middle"
            className={cn(
              "text-[11px] font-bold tabular-nums",
              /* Sous 5 % : rouge, pas ambre. L'ambre disait « attention », le
                 rouge dit « cassé ». La flèche ↓ porte déjà l'information,
                 donc la couleur n'est jamais seule (WCAG 1.4.1). */
              row.weak ? "fill-red-600 dark:fill-red-400" : "fill-muted-foreground",
            )}
          >
            {row.weak ? "↓ " : "→ "}
            {row.conversion} de l&apos;étape précédente
          </text>
        ) : null}
      </g>
    );
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div style={{ height: 30 + data.length * 84 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 4, right: 72, bottom: 4, left: 0 }}
            barCategoryGap="30%"
          >
            {/* 1,25 de tête : à 100 % l'étiquette de valeur n'a plus de place
                à droite et se fait rogner. */}
            <XAxis type="number" hide domain={[0, top * 1.25]} />
            <YAxis
              type="category"
              dataKey="stage"
              width={172}
              axisLine={false}
              tickLine={false}
              interval={0}
              tick={stageTick}
            />
            {/* minPointSize : sans lui Recharts ne dessine pas une barre de largeur nulle
                et saute son étiquette — l'étape à zéro perdait son chiffre. Le
                liseré reste invisible (opacité 0), seul le nombre s'affiche. */}
            <Bar
              dataKey="value"
              radius={[999, 999, 999, 999]}
              minPointSize={2}
              isAnimationActive={false}
            >
              {data.map((row, i) => (
                <Cell
                  key={row.stage}
                  fillOpacity={row.value > 0 ? OPACITY[i] : 0}
                  fill={row.fill}
                />
              ))}
              <LabelList dataKey="value" position="right" offset={10} content={<ValueTag />} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <ul className="sr-only">
        {data.map((row) => (
          <li key={row.stage}>
            {row.stage} : {row.value}
            {row.conversion === null ? "" : `, ${row.conversion} de l'étape précédente`}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ValueTag(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  value?: number;
}) {
  const { x = 0, y = 0, width = 0, height = 0, value = 0 } = props;
  return (
    <text
      x={x + width + 10}
      y={y + height / 2}
      dominantBaseline="middle"
      className="fill-foreground text-[13px] font-black tabular-nums"
    >
      {compact(value)}
    </text>
  );
}

function percent(part: number, whole: number): string | null {
  if (whole <= 0) return null;
  return `${(Math.round((part / whole) * 1000) / 10).toString().replace(".", ",")} %`;
}
