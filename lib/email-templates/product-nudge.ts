import { BRAND_CSS_BASE, BRAND_CSS_DARK, emailBrandHtml } from "@/lib/email-templates/brand";
import { emailLegalHtml, emailLegalText } from "@/lib/email-templates/footer";
import { emailGreeting } from "@/lib/greeting";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Rappel maker (rejetés) : même shell éditorial que product-review
 * (typographie pure, CTA pill unique). Ton bienveillant, jamais
 * culpabilisant : le rappel est un service, pas une pression — aucun
 * délai imposé, aucune menace de suppression.
 */
const SHARED_CSS = `
    :root { color-scheme: light dark; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; margin: 0; padding: 0; background-color: #ffffff; color: #09090b; }
    .container { max-width: 540px; margin: 0 auto; padding: 64px 24px; text-align: left; }
    .brand-area { margin-bottom: 64px; }
    .hero { font-size: 36px; font-weight: 800; letter-spacing: -0.04em; margin: 0 0 48px 0; line-height: 1.1; }
    .greeting { font-size: 20px; font-weight: 600; letter-spacing: -0.02em; margin: 0 0 16px 0; color: #09090b; }
    .text { font-size: 16px; line-height: 1.7; color: #52525b; margin: 0 0 24px 0; }
    .text-muted { font-size: 14px; line-height: 1.6; color: #a1a1aa; margin: 0 0 40px 0; font-style: italic; }
    .label { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; color: #a1a1aa; margin: 0 0 10px 0; }
    .context-block { border-left: 2px solid var(--accent-color, #e4e4e7); padding-left: 16px; margin: 0 0 40px 0; }
    .context-name { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; color: #09090b; margin: 0 0 8px 0; line-height: 1.2; }
    .cta { display: inline-block; background-color: #09090b; text-decoration: none; padding: 18px 36px; border-radius: 999px; letter-spacing: -0.01em; }
    .cta span { font-size: 15px; font-weight: 600; color: #ffffff !important; }
    .charte-link { color: #09090b; font-weight: 600; text-decoration: underline; }
    .divider { border: none; border-top: 2px solid #e4e4e7; width: 32px; margin: 64px 0 32px 0; margin-left: 0; }
    .footer { font-size: 13px; color: #a1a1aa; line-height: 1.5; }
    ${BRAND_CSS_BASE}

    @media (prefers-color-scheme: dark) {
      body { background-color: #000000 !important; color: #ffffff !important; }
      .greeting, .context-name { color: #ffffff !important; }
      .text { color: #a1a1aa !important; }
      .divider { border-top-color: #27272a !important; }
      .cta { background-color: #ffffff !important; }
      .cta span { color: #000000 !important; }
      .charte-link { color: #ffffff !important; }
      ${BRAND_CSS_DARK}
    }`;

function shell(
  title: string,
  heroColor: string,
  accentColor: string,
  hero: string,
  bodyHtml: string,
  footerHtml: string,
): string {
  return `<!doctype html>
<html lang="fr" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${title}</title>
  <style type="text/css">${SHARED_CSS}
    .hero { color: ${heroColor}; }
    .context-block { border-left-color: ${accentColor}; }
  </style>
</head>
<body>
  <div class="container">
    <div class="brand-area">
      ${emailBrandHtml()}
    </div>
    <h1 class="hero">${hero}</h1>
    ${bodyHtml}
    <hr class="divider" />
    <div class="footer">${footerHtml}</div>
  </div>
</body>
</html>`;
}

export function productNudgeSubject(productName: string): string {
  return `Petit rappel : ${productName} attend vos corrections`;
}

export function productNudgeText(input: {
  displayName: string;
  productName: string;
  reason: string;
  rejectedDays: number;
  dashboardUrl: string;
  origin: string;
  timeZone: string | null;
}): string {
  return [
    "BuilderPlatform",
    "---",
    `${emailGreeting(input.timeZone)} ${input.displayName},`,
    "",
    `Un petit rappel amical : ${input.productName} attend vos corrections depuis ${input.rejectedDays} jour${input.rejectedDays > 1 ? "s" : ""}.`,
    "",
    "MOTIF DU REFUS :",
    input.reason,
    "",
    "Aucun délai imposé, aucune pression — votre fiche reste en attente aussi longtemps qu'il faut. Quand c'est prêt, corrigez et resoumettez : un humain relit chaque soumission.",
    "",
    `Tableau de bord : ${input.dashboardUrl}`,
    "",
    "---",
    emailLegalText(input.origin),
  ].join("\n");
}

export function productNudgeHtml(input: {
  displayName: string;
  productName: string;
  reason: string;
  rejectedDays: number;
  dashboardUrl: string;
  origin: string;
  timeZone: string | null;
}): string {
  const name = escapeHtml(input.displayName);
  const product = escapeHtml(input.productName);
  const reason = escapeHtml(input.reason);
  const dashboard = escapeHtml(input.dashboardUrl);
  const days = `${input.rejectedDays} jour${input.rejectedDays > 1 ? "s" : ""}`;

  return shell(
    "Petit rappel",
    "#f59e0b",
    "#f59e0b",
    "On vous attend.",
    `<p class="greeting">${emailGreeting(input.timeZone)} ${name},</p>
    <p class="text">Un petit rappel amical : <strong>${product}</strong> attend vos corrections depuis ${days}.</p>

    <div class="context-block">
      <p class="label">Motif du refus</p>
      <p class="context-name" style="font-size:18px;">${reason}</p>
    </div>

    <p class="text-muted">Aucun délai imposé, aucune pression — votre fiche reste en attente aussi longtemps qu'il faut. Quand c'est prêt, corrigez et resoumettez : un humain relit chaque soumission.</p>

    <div style="margin-bottom:40px;"><a href="${dashboard}" class="cta"><span>Corriger ma fiche →</span></a></div>`,
    `Notification produit &bull; BuilderPlatform &copy; ${new Date().getFullYear()}<br>${emailLegalHtml(input.origin)}`,
  );
}
