/**
 * Données fictives des graphiques du tableau de bord.
 *
 * **Fichier jetable.** Quand les vraies requêtes existeront, ce module disparaît
 * et les composants lisent directement `services/…` — aucune forme n'est
 * partagée avec le reste du tableau de bord, donc rien d'autre ne bouge.
 *
 * Le volume est plausible et non démonstratif : semaine 160-195 vues, week-end
 * 35-101 (le creux **retire** 48 %), un pic de lancement à 195 qui retombe
 * ensuite. Un graphique qui ne fait que monter ne apprend rien au maker.
 */

export type ChartPoint = {
  /** Jour ISO. Le formatage reste au rendu. */
  day: string;
  label: string;
  views: number;
  clicks: number;
  votes: number;
};

export type ChartProduct = {
  name: string;
  views: number;
  clicks: number;
  votes: number;
  /** Mêmes noms de champs que `DashboardApp` — le branchement réel n'adapte rien. */
  initials: string;
  gradient: string;
  iconUrl?: string | null;
};

export type ChartsMock = {
  points: ChartPoint[];
  products: ChartProduct[];
  /** MRR en centimes, 90 points. */
  mrrCents: number[];
  /** Facturation connectée : le panneau MRR reste visible et explique sinon. */
  revenueConnected: boolean;
  counts: { live: number; pending: number; rejected: number };
};

function isoDay(offset: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - offset);
  return d.toISOString().slice(0, 10);
}

function day(offset: number): ChartPoint {
  const weekend = new Date(isoDay(offset)).getDay();
  const isWeekend = weekend === 0 || weekend === 6;
  const t = 89 - offset;
  const growth = 28 + t * 0.55;
  const launch = t > 58 && t < 66 ? 2.6 : 1;
  const views = Math.max(
    4,
    Math.round(
      growth *
        (isWeekend ? 0.52 : 1) *
        (1 + Math.sin(t / 3.1) * 0.12 + Math.sin(t / 8.3) * 0.07) *
        launch,
    ),
  );
  return {
    day: isoDay(offset),
    label: new Date(isoDay(offset)).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
    }),
    views,
    clicks: Math.round(views * (0.105 + Math.sin(t / 5) * 0.012)),
    votes: Math.round(views * (0.013 + Math.cos(t / 6) * 0.003)),
  };
}

const NAMES: Array<{ name: string; initials: string; gradient: string }> = [
  { name: "TapCash", initials: "TC", gradient: "from-emerald-500 to-teal-700" },
  { name: "OpenGym", initials: "OG", gradient: "from-sky-500 to-indigo-700" },
  { name: "Fanaro", initials: "FN", gradient: "from-amber-500 to-orange-700" },
  { name: "AntsRoad", initials: "AR", gradient: "from-rose-500 to-red-800" },
  { name: "Baobab Notes", initials: "BN", gradient: "from-lime-600 to-green-800" },
  { name: "Zaza Score", initials: "ZS", gradient: "from-violet-500 to-purple-800" },
];

export function getChartsMock(): ChartsMock {
  const points: ChartPoint[] = [];
  for (let offset = 89; offset >= 0; offset--) points.push(day(offset));

  const products: ChartProduct[] = NAMES.map((entry, i) => {
    const scale = 1 - i * 0.16 + Math.sin(i * 2.1) * 0.09;
    const views = Math.round(1180 * scale);
    return {
      ...entry,
      views,
      clicks: Math.round(views * (0.09 + i * 0.008)),
      votes: Math.round(views * (0.012 + i * 0.002)),
    };
  });

  return {
    points,
    products,
    ...mockMrr(),
    revenueConnected: true,
    counts: { live: 4, pending: 1, rejected: 1 },
  };
}

/** MRR : croissance avec deux paliers et un creux, jamais une montée linéaire. */
function mockMrr(): { mrrCents: number[] } {
  const out: number[] = [];
  let base = 14_000;
  for (let i = 0; i < 90; i++) {
    if (i === 21) base = 26_000;
    if (i === 58) base = 21_000;
    const wobble = Math.sin(i / 5.5) * 900;
    out.push(Math.max(0, Math.round(base + wobble + i * 120)));
  }
  return { mrrCents: out };
}

/** Agrégats du tunnel, dérivés de la même série que la courbe. */
export function funnelTotals(points: ChartPoint[]): [number, number, number] {
  const window = points.slice(-30);
  const sum = (k: "views" | "clicks" | "votes") => window.reduce((s, p) => s + p[k], 0);
  return [sum("views"), sum("clicks"), sum("votes")];
}
