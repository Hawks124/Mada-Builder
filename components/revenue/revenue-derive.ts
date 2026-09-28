import type { RevenueDisplayMode, RevenueProvider, RevenueView } from "./revenue-types";

/**
 * Dérivation des revenus vérifiés — module PUR, sans `Date`, sans catalogue,
 * donc importable depuis un composant client sans embarquer le jeu de données.
 *
 * Tout est déterministe et dérivé de l'id produit : c'est la condition pour que
 * le HTML rendu par le serveur et l'hydratation client produisent exactement la
 * même courbe. Un `Math.random()` ici se traduirait par un mismatch React à
 * chaque rendu.
 */

const HISTORY_DAYS = 90;

/** Hash 32 bits stable (FNV-1a) — même entrée, même sortie, à chaque rendu. */
function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** PRNG mulberry32, seedé par le hash — variations stables et reproductibles. */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Progression saturante : la croissance ralentit, elle ne s'arrête pas net. */
function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

/** Cloche centrée sur `c` — sert à poser un creux ou un rebond local. */
function bump(t: number, c: number, width: number): number {
  const d = (t - c) / width;
  return Math.exp(-d * d);
}

/**
 * Formes de courbe. Un vrai MRR n'est pas une rampe : un produit qui explose,
 * un produit qui a fini de connaître son plafond, un produit qui a perdu des
 * abonnés avant de repartir. Trois formes suffisent pour que deux
 * lignes voisines du classement ne racontent pas la même histoire — c'est
 * exactement ce qui trahissait un jeu de données généré.
 */
type Shape = "growth" | "plateau" | "waves";

const SHAPES: Shape[] = ["growth", "plateau", "waves"];

/**
 * 90 jours de MRR (centimes) aboutissant exactement sur `mrrCents`.
 *
 * Bruit ±8 % par point : un MRR d'abonnement bouge tous les jours (résiliations
 * en entrée, nouveaux abonnements en sortie), jamais une ligne droite. Le
 * dernier point est forcé sur la vérité affichée, sinon la courbe et le
 * chiffre se contrediraient sur la même ligne.
 */
export function buildRevenueHistory(mrrCents: number, productId: string): number[] {
  const seed = hash(productId);
  const rand = seeded(seed);
  const shape = SHAPES[seed % SHAPES.length];

  // Point de départ selon la forme : un plateau a déjà grandi, une croissance
  // part de loin.
  const startRatio =
    shape === "growth"
      ? 0.42 + rand() * 0.16
      : shape === "plateau"
        ? 0.74 + rand() * 0.1
        : 0.55 + rand() * 0.14;
  const start = mrrCents * startRatio;

  const out: number[] = [];
  for (let i = 0; i < HISTORY_DAYS; i++) {
    const t = i / (HISTORY_DAYS - 1);
    const ramp = start + (mrrCents - start) * easeOut(t);

    let level = ramp;
    if (shape === "plateau") {
      // Monte vite, se fige, puis s'affaisse très légèrement.
      const k = easeOut(Math.min(1, t / 0.45));
      const sag = 1 - 0.05 * (Math.max(0, t - 0.45) / 0.55);
      level = start + (mrrCents - start) * k * sag;
    } else if (shape === "waves") {
      // Deux rebonds de recrutement séparés par un creux de résiliations.
      level =
        ramp *
        (1 - 0.12 * bump(t, 0.52, 0.11)) *
        (1 + 0.06 * bump(t, 0.26, 0.06)) *
        (1 + 0.06 * bump(t, 0.78, 0.06));
    }

    out.push(Math.max(0, Math.round(level * (1 + (rand() - 0.5) * 0.16))));
  }

  out[HISTORY_DAYS - 1] = mrrCents;
  return out;
}

function pickProvider(seed: number): RevenueProvider {
  return seed % 3 === 0 ? "revenuecat" : "stripe";
}

/**
 * 3 produits sur 10 masquent leur montant. C'est le taux visé en production :
 * le mode `badge_only` est ce qui fait adopter la feature (PRD §6), autant que
 * le jeu de démo le reflète.
 */
function pickDisplayMode(seed: number): RevenueDisplayMode {
  return seed % 10 < 3 ? "badge_only" : "full";
}

/** Écart d'heures d'interrogation, déterministe — évite « vérifié à l'instant ». */
export function syncedMinutesAgo(productId: string): number {
  return 8 + (hash(productId) % 112);
}

/** Instantané vérifié complet pour un produit du catalogue. */
export function deriveRevenueView(productId: string, mrrCents: number): RevenueView {
  const seed = hash(productId);
  return {
    provider: pickProvider(seed),
    displayMode: pickDisplayMode(seed),
    mrrCents,
    arrCents: mrrCents * 12,
    activeSubscribers: Math.max(1, Math.round(mrrCents / 900)),
    // Jamais affiché tel quel : le libellé de fraîcheur se calcule à part.
    lastSyncedAt: "",
    history: buildRevenueHistory(mrrCents, productId),
  };
}

/**
 * « Vérifié il y a 2 h » — déterministe lui aussi (pas de `Date.now()`), donc
 * aucun décalage possible entre le HTML serveur et l'hydratation.
 */
export function formatSyncedLabel(minutesAgo: number): string {
  if (minutesAgo < 60) return `Vérifié il y a ${minutesAgo} min`;
  const hours = Math.round(minutesAgo / 60);
  return hours <= 24 ? `Vérifié il y a ${hours} h` : `Vérifié il y a ${Math.round(hours / 24)} j`;
}
