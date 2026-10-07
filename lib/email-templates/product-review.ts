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
 * CSS partagé entre les deux templates de revue produit.
 *
 * Design : Zero-UI éditorial — contexte via typographie pure.
 * Aucun container ni card sauf le CTA pill.
 * Seule exception structurelle : le `.context-block` (bordure gauche fine),
 * identique au `reason-block` de ban-notify.ts.
 */
const SHARED_CSS = `
    :root { color-scheme: light dark; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; margin: 0; padding: 0; background-color: #ffffff; color: #09090b; }
    .container { max-width: 540px; margin: 0 auto; padding: 64px 24px; text-align: left; }
    .brand-area { margin-bottom: 64px; }
    .brand-text { font-size: 16px; font-weight: 700; letter-spacing: -0.02em; color: #09090b; }

    /* Typographie éditionale */
    .hero { font-size: 36px; font-weight: 800; letter-spacing: -0.04em; margin: 0 0 48px 0; line-height: 1.1; }
    .greeting { font-size: 20px; font-weight: 600; letter-spacing: -0.02em; margin: 0 0 16px 0; color: #09090b; }
    .text { font-size: 16px; line-height: 1.7; color: #52525b; margin: 0 0 24px 0; }
    .text-muted { font-size: 14px; line-height: 1.6; color: #a1a1aa; margin: 0 0 40px 0; font-style: italic; }

    /* Label taxonomique (uppercase mono) */
    .label { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; color: #a1a1aa; margin: 0 0 10px 0; }

    /* Context block : la seule structure, une bordure gauche, rien de plus */
    .context-block { border-left: 2px solid var(--accent-color, #e4e4e7); padding-left: 16px; margin: 0 0 40px 0; }
    .context-name { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; color: #09090b; margin: 0 0 8px 0; line-height: 1.2; }
    .context-meta { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 13px; color: #71717a; margin: 0; line-height: 1.6; }

    /* CTA pill — seul élément en container */
    .cta { display: inline-block; background-color: #09090b; text-decoration: none; padding: 18px 36px; border-radius: 999px; letter-spacing: -0.01em; }
    .cta span { font-size: 15px; font-weight: 600; color: #ffffff !important; }
    .charte-link { color: #09090b; font-weight: 600; text-decoration: underline; }

    .divider { border: none; border-top: 2px solid #e4e4e7; width: 32px; margin: 64px 0 32px 0; margin-left: 0; }
    .footer { font-size: 13px; color: #a1a1aa; line-height: 1.5; }
    ${BRAND_CSS_BASE}

    @media (prefers-color-scheme: dark) {
      body { background-color: #000000 !important; color: #ffffff !important; }
      .brand-text, .greeting, .context-name { color: #ffffff !important; }
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

// ─── Approbation ──────────────────────────────────────────────────────────

export function productApprovedSubject(productName: string): string {
  return `Mise à jour : ${productName} est publié`;
}

export function productApprovedText(input: {
  displayName: string;
  productName: string;
  productUrl: string;
  origin: string;
  timeZone: string | null;
}): string {
  return [
    "BuilderPlatform",
    "---",
    `${emailGreeting(input.timeZone)} ${input.displayName},`,
    "",
    `Bonne nouvelle : ${input.productName} est publié sur l'annuaire.`,
    "",
    `Fiche : ${input.productUrl}`,
    "",
    "Partagez votre fiche pour collecter des votes — chaque vote compte pour le leaderboard du jour.",
    "",
    "Conseil : connectez vos revenus Stripe ou RevenueCat depuis votre dashboard pour afficher le badge vérifié sur votre fiche.",
    "",
    "---",
    emailLegalText(input.origin),
  ].join("\n");
}

export function productApprovedHtml(input: {
  displayName: string;
  productName: string;
  productUrl: string;
  origin: string;
  timeZone: string | null;
}): string {
  const name = escapeHtml(input.displayName);
  const product = escapeHtml(input.productName);
  const url = escapeHtml(input.productUrl);

  return shell(
    "Produit publié",
    "#10b981",
    "#10b981",
    "Publié.",
    `<p class="greeting">${emailGreeting(input.timeZone)} ${name},</p>
    <p class="text">Votre produit est en ligne sur l'annuaire et entre dans le classement du jour dès maintenant.</p>

    <div class="context-block">
      <p class="label">Produit publié</p>
      <p class="context-name">${product}</p>
      <p class="context-meta">${url}</p>
    </div>

    <p class="text">Partagez ce lien pour collecter des votes — chaque vote remonte votre position dans le leaderboard du jour. Plus vous partagez tôt, plus l'impact est fort.</p>
    <p class="text-muted">Astuce : connectez vos revenus Stripe ou RevenueCat depuis votre dashboard. Le badge <strong>Revenus vérifiés</strong> renforce la crédibilité de votre fiche et améliore son référencement dans notre classement dédié.</p>

    <div style="margin-bottom:40px;"><a href="${url}" class="cta"><span>Voir ma fiche →</span></a></div>`,
    `Notification produit &bull; BuilderPlatform &copy; ${new Date().getFullYear()}<br>${emailLegalHtml(input.origin)}`,
  );
}

// ─── Rejet ────────────────────────────────────────────────────────────────

export function productRejectedSubject(productName: string): string {
  return `Mise à jour : ${productName} — modifications requises`;
}

export function productRejectedText(input: {
  displayName: string;
  productName: string;
  reason: string;
  dashboardUrl: string;
  origin: string;
  timeZone: string | null;
}): string {
  return [
    "BuilderPlatform",
    "---",
    `${emailGreeting(input.timeZone)} ${input.displayName},`,
    "",
    `${input.productName} n'est pas publié en l'état.`,
    "",
    "MOTIF :",
    input.reason,
    "",
    "Corrigez les points soulevés et resoumettez quand c'est prêt — aucun délai imposé.",
    "",
    `Consultez la charte de la communauté pour revoir les critères : ${input.origin}/regles`,
    "",
    `Tableau de bord : ${input.dashboardUrl}`,
    "",
    "---",
    emailLegalText(input.origin),
  ].join("\n");
}

export function productRejectedHtml(input: {
  displayName: string;
  productName: string;
  reason: string;
  dashboardUrl: string;
  origin: string;
  timeZone: string | null;
}): string {
  const name = escapeHtml(input.displayName);
  const product = escapeHtml(input.productName);
  const reason = escapeHtml(input.reason);
  const dashboard = escapeHtml(input.dashboardUrl);
  const rulesUrl = escapeHtml(`${input.origin}/regles`);

  return shell(
    "Modifications requises",
    "#f59e0b",
    "#f59e0b",
    "Pas encore.",
    `<p class="greeting">${emailGreeting(input.timeZone)} ${name},</p>
    <p class="text"><strong>${product}</strong> n'est pas publié en l'état. Voici le point à corriger :</p>

    <div class="context-block">
      <p class="label">Motif du refus</p>
      <p class="context-name" style="font-size:18px;">${reason}</p>
    </div>

    <p class="text-muted">Aucun délai imposé, aucun compteur. Corrigez à votre rythme et resoumettez quand c'est prêt — un humain relit chaque soumission.</p>
    <p class="text">Relisez la <a href="${rulesUrl}" class="charte-link">charte de la communauté</a> si vous avez un doute sur un critère.</p>

    <div style="margin-bottom:40px;"><a href="${dashboard}" class="cta"><span>Modifier ma fiche →</span></a></div>`,
    `Notification produit &bull; BuilderPlatform &copy; ${new Date().getFullYear()}<br>${emailLegalHtml(input.origin)}`,
  );
}
