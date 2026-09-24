/**
 * Marque email partagée — UNE seule implémentation pour les 5 templates
 * user-facing (plus jamais de "B" générique ni d'URL placeholder).
 * Technique dual-img : logo dark sur fond clair par défaut, swap vers
 * light en dark-mode via media query (déjà supportée par les templates).
 * Outlook (ignore les media queries + `mso-hide:all`) voit le dark
 * sur fond clair : repli sûr, jamais invisible. Alt + nom en texte :
 * même sans image, la marque reste lisible.
 */

export const LOGO_DARK_URL =
  "https://bpeiahrycdzfiwllysfd.supabase.co/storage/v1/object/public/logos/mada-made-dark.png";
export const LOGO_LIGHT_URL =
  "https://bpeiahrycdzfiwllysfd.supabase.co/storage/v1/object/public/logos/mada-made-light.png";

/** À injecter dans le CSS de base de chaque template. */
export const BRAND_CSS_BASE = `.logo-d{display:none !important;}`;

/** À injecter dans le bloc dark-mode (remplace l'ancien .logo-fallback). */
export const BRAND_CSS_DARK = `.logo-l{display:none !important;}
      .logo-d{display:block !important;}`;

export function emailBrandHtml(): string {
  return `<table border="0" cellspacing="0" cellpadding="0">
        <tr>
          <td><img src="${LOGO_DARK_URL}" alt="BuilderPlatform" width="32" height="32" class="logo-l" style="border-radius:8px;display:block;"></td>
          <td class="logo-d" style="display:none;mso-hide:all;"><img src="${LOGO_LIGHT_URL}" alt="" width="32" height="32" style="border-radius:8px;display:block;"></td>
          <td style="padding-left:12px;" class="brand-text">BuilderPlatform</td>
        </tr>
      </table>`;
}
