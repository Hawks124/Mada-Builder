/**
 * Footer juridique partagé — Charte / Conditions / Confidentialité.
 * `origin` vient des actions (même pattern que `dashboardUrl`), jamais
 * d'env dans les templates. Chaque template garde sa phrase d'accroche
 * ("Notification de modération • …") et ajoute ce fragment.
 * appeal-notify (email interne staff) n'en a pas besoin — volontaire.
 */

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

export function emailLegalHtml(origin: string): string {
  const o = escapeAttr(origin);
  return `<a href="${o}/regles" style="color:#a1a1aa;text-decoration:underline;">Charte</a> &bull; <a href="${o}/conditions" style="color:#a1a1aa;text-decoration:underline;">Conditions</a> &bull; <a href="${o}/confidentialite" style="color:#a1a1aa;text-decoration:underline;">Confidentialité</a>`;
}

export function emailLegalText(origin: string): string {
  return [
    `Charte : ${origin}/regles`,
    `Conditions : ${origin}/conditions`,
    `Confidentialité : ${origin}/confidentialite`,
  ].join("\n");
}

/**
 * Footer des emails de modération (ban, déban, décision d'appel) : les
 * liens seuls sont muets — ici la Charte est décrite (4 règles) et
 * suivie d'un appel à la suivre. Formulation volontairement générique
 * pour convenir aux trois cas (avertissement, retour, maintien).
 * Copy proposée — ajustable sans toucher aux templates.
 */
export function emailModerationFooterHtml(origin: string): string {
  const o = escapeAttr(origin);
  return `La scène tient à 4 règles — produits réels, votes loyaux, respect mutuel. Les connaître, c'est y rester : <a href="${o}/regles" style="color:#a1a1aa;text-decoration:underline;">Charte</a> &bull; <a href="${o}/conditions" style="color:#a1a1aa;text-decoration:underline;">Conditions</a> &bull; <a href="${o}/confidentialite" style="color:#a1a1aa;text-decoration:underline;">Confidentialité</a>`;
}

export function emailModerationFooterText(origin: string): string {
  return [
    "La scène tient à 4 règles — produits réels, votes loyaux, respect mutuel. Les connaître, c'est y rester :",
    emailLegalText(origin),
  ].join("\n");
}
