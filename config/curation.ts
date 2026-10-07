/**
 * Comptes de curation OSS (lot curation) : leurs soumissions sont
 * auto-marqué `curated` (veille internationale, pas de la scène locale).
 * Géré ici (code) plutôt qu'en DB : 1-2 comptes stables, changement =
 * déploiement relu. Toggle admin par produit pour les cas un par un.
 */
export const CURATION_USERNAMES: string[] = ["open-sources"];

export function isCurationAccount(username: string | null | undefined): boolean {
  if (!username) return false;
  return CURATION_USERNAMES.includes(username.toLowerCase());
}
