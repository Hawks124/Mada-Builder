/**
 * Notification de déban direct (hors appel) — compte rétabli.
 * Approche Zéro UI / Éditorial : signal couleur (Vert) sur le titre,
 * typographie soignée, pas de carte ni de fond.
 */

import { BRAND_CSS_BASE, BRAND_CSS_DARK, emailBrandHtml } from "@/lib/email-templates/brand";
import { emailModerationFooterHtml, emailModerationFooterText } from "@/lib/email-templates/footer";
import { emailGreeting } from "@/lib/greeting";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function unbanNotifySubject(): string {
  return "Mise à jour : Votre compte est rétabli";
}

export function unbanNotifyText(input: {
  displayName: string;
  /** Origine absolue (footer juridique). */
  origin: string;
  /** Fuseau IANA réel du destinataire (null = repli neutre). */
  timeZone: string | null;
}): string {
  return [
    "BuilderPlatform",
    "---",
    `${emailGreeting(input.timeZone)} ${input.displayName},`,
    "",
    "Bonne nouvelle : votre compte a été rétabli.",
    "Vous retrouvez immédiatement l'accès à toutes vos données, vos projets et vos fonctionnalités.",
    "",
    "Vous pouvez dès à présent vous reconnecter et reprendre là où vous vous étiez arrêté.",
    "",
    "---",
    emailModerationFooterText(input.origin),
  ].join("\n");
}

export function unbanNotifyHtml(input: {
  displayName: string;
  /** Origine absolue (footer juridique). */
  origin: string;
  /** Fuseau IANA réel du destinataire (null = repli neutre). */
  timeZone: string | null;
}): string {
  const name = escapeHtml(input.displayName);

  return `<!doctype html>
<html lang="fr" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Compte rétabli</title>
  <style type="text/css">
    :root { color-scheme: light dark; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; margin: 0; padding: 0; background-color: #ffffff; color: #09090b; }
    .container { max-width: 540px; margin: 0 auto; padding: 64px 24px; text-align: left; }
    .brand-area { margin-bottom: 64px; }
    .brand-text { font-size: 16px; font-weight: 700; letter-spacing: -0.02em; color: #09090b; }
    
    /* Couleur Sémantique : Vert Émeraude pour signifier la résolution/le succès */
    .hero { font-size: 36px; font-weight: 800; letter-spacing: -0.04em; margin: 0 0 48px 0; line-height: 1.1; color: #10b981; }
    
    .greeting { font-size: 20px; font-weight: 600; letter-spacing: -0.02em; margin: 0 0 16px 0; color: #09090b; }
    .text { font-size: 16px; line-height: 1.7; color: #52525b; margin: 0 0 24px 0; }
    
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

    <h1 class="hero">Compte rétabli.</h1>
    
    <p class="greeting">${emailGreeting(input.timeZone)} ${name},</p>
    
    <p class="text">
      Bonne nouvelle : votre compte a été rétabli. Vous retrouvez immédiatement l'accès à toutes vos données, vos projets et vos fonctionnalités.
    </p>
    
    <p class="text">
      Vous pouvez dès à présent vous reconnecter et reprendre là où vous vous étiez arrêté.
    </p>

    <hr class="divider" />
    <div class="footer">
      Notification système &bull; BuilderPlatform &copy; ${new Date().getFullYear()}<br>
      ${emailModerationFooterHtml(input.origin)}
    </div>
  </div>
</body>
</html>`;
}
