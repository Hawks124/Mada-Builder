/**
 * Limites des médias — module partagé client ET serveur.
 *
 * Why pas `lib/images.ts` : ce module importe `sharp` (incapable de
 * vivre dans un bundle client). Les seuils doivent être identiques des
 * deux côtés, sinon le formulaire accepte un fichier que le serveur
 * refuse (ou l'inverse).
 */

/** Seuil de résolution, en pixels. */
const MIN_PX = 400;

/**
 * Quel côté on regarde pour dire « l'image est trop petite ».
 *
 * - Images fixes : le côté **court**. Un slot portrait est plus étroit
 *   qu'un slot paysage (~250 px contre ~500 px) : c'est donc la
 *   dimension critique qu'il faut garnir.
 * - GIF : le côté **long**. Un GIF est un format lourd : les exporteurs
 *   le produisent naturellement petit (240×480, 320×568…). Juger sur
 *   le côté court punirait injustement le portrait (240 de large) alors
 *   que 480 de haut est une vraie définition. Le côté long rend la règle
 *   **indépendante de l'orientation** : un 240×480 portrait et un 480×240
 *   paysage sont la même classe de capture, acceptés ou refusés ensemble.
 *
 * L construed à 400 px dans les deux cas — seul le côté regardé change.
 * Le ratio reste par ailleurs borné (≤ 3:1) : une bande 400×100 est
 * refusée malgré un long side confortable.
 */
export type ShotSizeRule = { px: number; side: "short" | "long" };

/** Règle applicable au fichier uploadé. */
export function shotSizeRuleFor(fileType: string | undefined): ShotSizeRule {
  return fileType === "image/gif" ? { px: MIN_PX, side: "long" } : { px: MIN_PX, side: "short" };
}

/** L'image est-elle trop petite pour la galerie ? */
export function isShotTooSmall(
  width: number,
  height: number,
  fileType: string | undefined,
): boolean {
  const rule = shotSizeRuleFor(fileType);
  const side = rule.side === "long" ? Math.max(width, height) : Math.min(width, height);
  return side < rule.px;
}

/** Message d'erreur (annonce le côté mesuré). */
export function shotTooSmallMessage(fileType: string | undefined): string {
  const rule = shotSizeRuleFor(fileType);
  return rule.side === "long"
    ? `${rule.px} px minimum sur le côté long`
    : `${rule.px} px minimum sur le côté court`;
}

/** Côté court minimal d'un logo (le GIF n'y est pas autorisé). */
export const LOGO_MIN_PX = 256;
