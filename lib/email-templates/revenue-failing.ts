import { BRAND_CSS_BASE, emailBrandHtml } from "@/lib/email-templates/brand";
import { emailLegalHtml, emailLegalText } from "@/lib/email-templates/footer";
import { emailGreeting } from "@/lib/greeting";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const CSS = `
    body { font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; margin: 0; padding: 0; background-color: #ffffff; color: #09090b; }
    .container { max-width: 540px; margin: 0 auto; padding: 64px 24px; text-align: left; }
    .brand-area { margin-bottom: 64px; }
    .hero { font-size: 32px; font-weight: 800; letter-spacing: -0.04em; margin: 0 0 48px 0; line-height: 1.1; color: #dc2626; }
    .greeting { font-size: 20px; font-weight: 600; letter-spacing: -0.02em; margin: 0 0 16px 0; color: #09090b; }
    .text { font-size: 16px; line-height: 1.7; color: #52525b; margin: 0 0 24px 0; }
    .context-block { border-left: 2px solid #f59e0b; padding-left: 16px; margin: 0 0 40px 0; }
    .label { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; color: #a1a1aa; margin: 0 0 10px 0; }
    .context-name { font-size: 18px; font-weight: 700; color: #09090b; margin: 0; line-height: 1.4; }
    .cta { display: inline-block; background-color: #09090b; text-decoration: none; padding: 18px 36px; border-radius: 999px; }
    .cta span { font-size: 15px; font-weight: 600; color: #ffffff !important; }
    .divider { border: none; border-top: 2px solid #e4e4e7; width: 32px; margin: 64px 0 32px 0; margin-left: 0; }
    .footer { font-size: 13px; color: #a1a1aa; line-height: 1.5; }
    ${BRAND_CSS_BASE}
    @media (prefers-color-scheme: dark) {
      body { background-color: #000000 !important; color: #ffffff !important; }
      .greeting, .context-name { color: #ffffff !important; }
      .text { color: #a1a1aa !important; }
      .cta { background-color: #ffffff !important; }
      .cta span { color: #000000 !important; }
    }`;

/**
 * Sync revenus en échec (2 échecs consécutifs) : ton direct, motif exact,
 * marche à suivre (reconnecter). Best-effort : Resend test-mode oblige,
 * l'email peut ne pas partir — la notif in-app reste le canal fiable.
 */
export function revenueFailingSubject(productName: string): string {
  return `Sync revenus en échec — ${productName}`;
}

export function revenueFailingText(input: {
  displayName: string;
  productName: string;
  providerLabel: string;
  reason: string;
  dashboardUrl: string;
  origin: string;
  timeZone: string | null;
}): string {
  return [
    "Mada-Made",
    "---",
    `${emailGreeting(input.timeZone)} ${input.displayName},`,
    "",
    `La synchronisation des revenus de ${input.productName} (${input.providerLabel}) échoue depuis 2 passages. Le badge affiche vos derniers chiffres connus en attendant.`,
    "",
    "MOTIF :",
    input.reason,
    "",
    "Le plus souvent : clé expirée ou révoquée, permissions manquantes. Reconnectez une clé en lecture seule depuis votre tableau de bord et la sync reprend à l'heure suivante.",
    "",
    `Clés API : ${input.dashboardUrl}`,
    "",
    "---",
    emailLegalText(input.origin),
  ].join("\n");
}

export function revenueFailingHtml(input: {
  displayName: string;
  productName: string;
  providerLabel: string;
  reason: string;
  dashboardUrl: string;
  origin: string;
  timeZone: string | null;
}): string {
  const name = escapeHtml(input.displayName);
  const product = escapeHtml(input.productName);
  const provider = escapeHtml(input.providerLabel);
  const reason = escapeHtml(input.reason);
  const dashboard = escapeHtml(input.dashboardUrl);
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <title>Sync revenus en échec</title>
  <style type="text/css">${CSS}</style>
</head>
<body>
  <div class="container">
    <div class="brand-area">
      ${emailBrandHtml()}
    </div>
    <h1 class="hero">Sync en échec.</h1>
    <p class="greeting">${emailGreeting(input.timeZone)} ${name},</p>
    <p class="text">La synchronisation des revenus de <strong>${product}</strong> (${provider}) échoue depuis 2 passages. Le badge affiche vos derniers chiffres connus en attendant.</p>

    <div class="context-block">
      <p class="label">Motif constaté</p>
      <p class="context-name">${reason}</p>
    </div>

    <p class="text">Le plus souvent : clé expirée ou révoquée, permissions manquantes. Reconnectez une clé en lecture seule et la sync reprend à l&apos;heure suivante.</p>

    <div style="margin-bottom:40px;"><a href="${dashboard}" class="cta"><span>Reconnecter →</span></a></div>
    <hr class="divider" />
    <div class="footer">Notification produit &bull; Mada-Made &copy; ${new Date().getFullYear()}<br>${emailLegalHtml(input.origin)}</div>
  </div>
</body>
</html>`;
}
