import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utility function to merge Tailwind CSS classes, resolving conflicts.
 * Used extensively across UI components to allow passing custom classNames safely.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Slug de username maker — règle unique, backend-ready (users.username).
 * Minuscules, sans accents, tout séparateur → un tiret.
 */
export function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Monnaie — formateur unique du site (PRD §13 : `Intl.NumberFormat`, pas de
 * formatage manuel). Les montants circulent **en centimes** partout
 * (`products.mrr_cents`, `revenue_snapshots.mrr_cents`) : la conversion en
 * unité d'affichage est faite ici, une fois.
 *
 * `compact: true` abrège les grands montants ("4,2 k $US") pour les lignes de
 * liste ; par défaut on affiche le montant exact, seul cas où le chiffre doit
 * être opposable.
 */
export function formatMoney(
  cents: number,
  currency = "USD",
  options?: { compact?: boolean; maximumFractionDigits?: number },
): string {
  const compact = options?.compact ?? false;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    ...(compact ? { notation: "compact" as const, compactDisplay: "short" as const } : {}),
    maximumFractionDigits: options?.maximumFractionDigits ?? (compact ? 1 : 2),
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

/**
 * Attente file de revue (SLA 24 h) — même libellé file fiches et file
 * binaires (client-safe : importable côté client comme serveur).
 */
export function waitingFr(createdAt: Date | string, now: Date = new Date()): string {
  const days = Math.max(
    0,
    Math.floor((now.getTime() - new Date(createdAt).getTime()) / 86_400_000),
  );
  if (days <= 0) return "En attente depuis aujourd'hui";
  return `En attente depuis ${days} j`;
}

/**
 * Temps relatif court (« il y a 5 min », « hier ») — mentions « modifié »
 * des commentaires/avis (client-safe).
 */
export function timeAgoFr(iso: Date | string, now: Date = new Date()): string {
  const diff = Math.max(0, now.getTime() - new Date(iso).getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "hier";
  if (d < 7) return `il y a ${d} j`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}
