import { BRAND_CSS_BASE, BRAND_CSS_DARK, emailBrandHtml } from "@/lib/email-templates/brand";
import { emailModerationFooterHtml, emailModerationFooterText } from "@/lib/email-templates/footer";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function banNotifySubject(): string {
  return "Action requise : Votre compte est suspendu";
}

export function banNotifyText(input: {
  displayName: string;
  banReason: string;
  dashboardUrl: string;
  /** Origine absolue (footer juridique) — même pattern que dashboardUrl. */
  origin: string;
}): string {
  return [
    "BuilderPlatform",
    "---",
    `Bonjour ${input.displayName},`,
    "",
    "Votre compte est suspendu.",
    "",
    "MOTIF :",
    input.banReason,
    "",
    "Vous pouvez contester cette décision depuis votre tableau de bord (bouton 'Faire appel'), ou supprimer définitivement votre compte.",
    "",
    `Tableau de bord : ${input.dashboardUrl}`,
    "",
    "---",
    emailModerationFooterText(input.origin),
  ].join("\n");
}

export function banNotifyHtml(input: {
  displayName: string;
  banReason: string;
  /** URL absolue /dashboard (construite côté action via appOrigin). */
  dashboardUrl: string;
  /** Origine absolue (footer juridique). */
  origin: string;
}): string {
  const name = escapeHtml(input.displayName);
  const reason = escapeHtml(input.banReason);

  return `<!doctype html>
<html lang="fr" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Compte suspendu</title>
  <style type="text/css">
    :root { color-scheme: light dark; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; margin: 0; padding: 0; background-color: #ffffff; color: #09090b; }
    .container { max-width: 540px; margin: 0 auto; padding: 64px 24px; text-align: left; }
    .brand-area { margin-bottom: 64px; }
    .brand-text { font-size: 16px; font-weight: 700; letter-spacing: -0.02em; color: #09090b; }
    
    /* Couleur Sémantique : Rouge pour le ban */
    .hero { font-size: 36px; font-weight: 800; letter-spacing: -0.04em; margin: 0 0 48px 0; line-height: 1.1; color: #ef4444; }
    
    .greeting { font-size: 20px; font-weight: 600; letter-spacing: -0.02em; margin: 0 0 16px 0; color: #09090b; }
    .text { font-size: 16px; line-height: 1.7; color: #52525b; margin: 0 0 32px 0; }
    
    /* Motif en retrait */
    .label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; color: #71717a; margin: 0 0 8px 0; }
    .reason-block { border-left: 2px solid #ef4444; padding-left: 16px; margin: 0 0 40px 0; }
    .reason-text { font-size: 18px; font-weight: 600; color: #09090b; margin: 0; }
    
    .cta { display: inline-block; background-color: #09090b; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; padding: 18px 36px; border-radius: 999px; letter-spacing: -0.01em; }
    .divider { border: none; border-top: 2px solid #e4e4e7; width: 32px; margin: 64px 0 32px 0; margin-left: 0; }
    .footer { font-size: 13px; color: #a1a1aa; line-height: 1.5; }
    ${BRAND_CSS_BASE}
    
    @media (prefers-color-scheme: dark) {
      body { background-color: #000000 !important; color: #ffffff !important; }
      .brand-text, .greeting, .reason-text { color: #ffffff !important; }
      .text { color: #a1a1aa !important; }
      .divider { border-top-color: #27272a !important; }
      .cta { background-color: #ffffff !important; color: #000000 !important; }
      ${BRAND_CSS_DARK}
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="brand-area">
      ${emailBrandHtml()}
    </div>

    <h1 class="hero">Compte suspendu.</h1>
    <p class="greeting">Bonjour ${name},</p>
    
    <div class="reason-block">
      <p class="label">Motif de la décision</p>
      <p class="reason-text">${reason}</p>
    </div>

    <p class="text">
      Vous pouvez contester cette décision en vous rendant sur votre tableau de bord (via le bouton "Faire appel"), ou choisir de supprimer définitivement votre compte.
    </p>

    <div>
      <a href="${escapeHtml(input.dashboardUrl)}" class="cta">Faire appel</a>
    </div>

    <hr class="divider" />
    <div class="footer">
      Notification de modération &bull; BuilderPlatform &copy; ${new Date().getFullYear()}<br>
      ${emailModerationFooterHtml(input.origin)}
    </div>
  </div>
</body>
</html>`;
}
