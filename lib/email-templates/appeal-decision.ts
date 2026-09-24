import {
  BRAND_CSS_BASE,
  BRAND_CSS_DARK,
  emailBrandHtml,
} from "@/lib/email-templates/brand";
import { emailModerationFooterHtml, emailModerationFooterText } from "@/lib/email-templates/footer";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function appealDecisionSubject(overturned: boolean): string {
  return overturned ? "Mise à jour : Votre compte est rétabli" : "Mise à jour : on maintient la suspension";
}

export function appealDecisionText(input: {
  displayName: string;
  overturned: boolean;
  /** Origine absolue (footer juridique). */
  origin: string;
}): string {
  return [
    "BuilderPlatform",
    "---",
    `Bonjour ${input.displayName},`,
    "",
    input.overturned
      ? "Bonne nouvelle : Votre appel a été accepté. Votre compte est rétabli, avec toutes vos données intactes."
      : [
          "Nous avons relu votre appel avec attention, et pour l'instant nous maintenons la suspension.",
          "",
          "Ce n'est pas un point final : les appels sont illimités. Si des éléments nouveaux éclairent la situation, écrivez-nous à nouveau — un humain relira, promis.",
          "",
          "Et votre droit à l'oubli reste entier : vous pouvez supprimer vos données depuis votre tableau de bord, à tout moment.",
        ].join("\n"),
    "",
    "---",
    emailModerationFooterText(input.origin),
  ].join("\n");
}

export function appealDecisionHtml(input: {
  displayName: string;
  overturned: boolean;
  /** Origine absolue (footer juridique). */
  origin: string;
}): string {
  const name = escapeHtml(input.displayName);
  
  // Couleurs et Titres dynamiques selon la décision
  const heroColor = input.overturned ? "#10b981" : "#f59e0b"; // Émeraude (Succès) / Ambre (pause, pas sanction)
  const title = input.overturned ? "Compte rétabli." : "On maintient, pour l'instant.";
  
  const body = input.overturned
    ? "Après examen de votre appel, nous avons le plaisir de vous informer que votre compte a été rétabli. Vous retrouvez immédiatement l'accès à toutes vos données, vos produits et vos votes."
    : "Nous avons relu votre appel avec attention, et pour l'instant nous maintenons la suspension.<br><br>Ce n'est pas un point final : les appels sont illimités. Si des éléments nouveaux éclairent la situation, écrivez-nous à nouveau — un humain relira, promis.<br><br>Votre droit à l'oubli reste entier : vous pouvez supprimer vos données depuis votre tableau de bord, à tout moment.";

  return `<!doctype html>
<html lang="fr" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${title}</title>
  <style type="text/css">
    :root { color-scheme: light dark; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; margin: 0; padding: 0; background-color: #ffffff; color: #09090b; }
    .container { max-width: 540px; margin: 0 auto; padding: 64px 24px; text-align: left; }
    .brand-area { margin-bottom: 64px; }
    .brand-text { font-size: 16px; font-weight: 700; letter-spacing: -0.02em; color: #09090b; }
    
    .hero { font-size: 36px; font-weight: 800; letter-spacing: -0.04em; margin: 0 0 48px 0; line-height: 1.1; }
    .greeting { font-size: 20px; font-weight: 600; letter-spacing: -0.02em; margin: 0 0 16px 0; color: #09090b; }
    .text { font-size: 16px; line-height: 1.7; color: #52525b; margin: 0 0 32px 0; }
    
    .divider { border: none; border-top: 2px solid #e4e4e7; width: 32px; margin: 64px 0 32px 0; margin-left: 0; }
    .footer { font-size: 13px; color: #a1a1aa; line-height: 1.5; }
    ${BRAND_CSS_BASE}
    
    @media (prefers-color-scheme: dark) {
      body { background-color: #000000 !important; color: #ffffff !important; }
      .brand-text, .greeting { color: #ffffff !important; }
      .text { color: #a1a1aa !important; }
      .divider { border-top-color: #27272a !important; }
      ${BRAND_CSS_DARK}
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="brand-area">
      ${emailBrandHtml()}
    </div>

    <!-- La couleur du titre (Rouge ou Vert) est injectée dynamiquement via le paramètre heroColor -->
    <h1 class="hero" style="color: ${heroColor};">${title}</h1>
    
    <p class="greeting">Bonjour ${name},</p>
    <p class="text">${body}</p>

    <hr class="divider" />
    <div class="footer">
      Notification de modération &bull; BuilderPlatform &copy; ${new Date().getFullYear()}<br>
      ${emailModerationFooterHtml(input.origin)}
    </div>
  </div>
</body>
</html>`;
}