/**
 * Marque email partagée — UNE seule implémentation pour les templates
 * (plus jamais de "B" générique ni d'URL placeholder). Wordmark seul
 * (~140 px), sans tuile ni texte accolé : la marque reste lisible même
 * images coupées grâce à l'alt.
 * Technique dual-img : wordmark noir sur fond clair par défaut, swap vers
 * le blanc en dark-mode via media query (déjà supportée par les templates).
 * Outlook (ignore les media queries + `mso-hide:all`) voit le noir sur
 * fond clair : repli sûr, jamais invisible.
 */

/**
 * Convention `mm_logo_*` VÉRIFIÉE par échantillonnage pixels (2026-10-14) :
 * suffixe = thème cible (comme `mada-made-*`, PAS comme `mm-sharper-*`).
 * `mm_logo_light.png` = artwork NOIR (fond clair), `mm_logo_dark.png` =
 * artwork BLANC (dark-mode). Inverser = logo invisible (blanc sur blanc).
 */
export const LOGO_ON_LIGHT_URL =
  "https://bpeiahrycdzfiwllysfd.supabase.co/storage/v1/object/public/logos/mm_logo_light.png";
export const LOGO_ON_DARK_URL =
  "https://bpeiahrycdzfiwllysfd.supabase.co/storage/v1/object/public/logos/mm_logo_dark.png";

/** À injecter dans le CSS de base de chaque template. */
export const BRAND_CSS_BASE = `.logo-d{display:none !important;}`;

/** À injecter dans le bloc dark-mode (remplace l'ancien .logo-fallback). */
export const BRAND_CSS_DARK = `.logo-l{display:none !important;}
      .logo-d{display:block !important;}`;

export function emailBrandHtml(): string {
  return `<table border="0" cellspacing="0" cellpadding="0">
        <tr>
          <td><img src="${LOGO_ON_LIGHT_URL}" alt="Mada-Made" width="140" class="logo-l" style="display:block;height:auto;"></td>
          <td class="logo-d" style="display:none;mso-hide:all;"><img src="${LOGO_ON_DARK_URL}" alt="Mada-Made" width="140" style="display:block;height:auto;"></td>
        </tr>
      </table>`;
}
