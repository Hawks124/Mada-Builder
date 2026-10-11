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

/**
 * Verdicts binaire (D2-UI) : même langue visuelle que `product-review.ts`
 * (Zero-UI éditorial — contexte via typographie, CTA pill unique).
 * Ton chaleureux et court ; le rejet explique + propose le re-upload.
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
    .context-meta { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 13px; color: #71717a; margin: 0; line-height: 1.6; }
    .cta { display: inline-block; background-color: #09090b; text-decoration: none; padding: 18px 36px; border-radius: 999px; letter-spacing: -0.01em; }
    .cta span { font-size: 15px; font-weight: 600; color: #ffffff !important; }
    .divider { border: none; border-top: 2px solid #e4e4e7; width: 32px; margin: 64px 0 32px 0; margin-left: 0; }
    .footer { font-size: 13px; color: #a1a1aa; line-height: 1.5; }
    ${BRAND_CSS_BASE}
`;

export function buildApprovedSubject(productName: string): string {
  return `Votre APK est en ligne — ${productName}`;
}

export function buildApprovedText(input: {
  displayName: string;
  productName: string;
  versionLabel: string;
  productUrl: string;
  origin: string;
  timeZone: string | null;
}): string {
  return [
    `${emailGreeting(input.timeZone)} ${input.displayName},`,
    "",
    `Bonne nouvelle : le binaire Android ${input.versionLabel} de ${input.productName} a été vérifié et approuvé. La communauté peut maintenant l'installer depuis la fiche.`,
    "",
    `Voir la fiche : ${input.productUrl}`,
    "",
    emailLegalText(input.origin),
  ].join("\n");
}

export function buildApprovedHtml(input: {
  displayName: string;
  productName: string;
  versionLabel: string;
  productUrl: string;
  origin: string;
  timeZone: string | null;
}): string {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(buildApprovedSubject(input.productName))}</title><style>${SHARED_CSS}</style></head><body><div class="container"><div class="brand-area">${emailBrandHtml()}</div><p class="hero">Votre APK est en ligne.</p><p class="greeting">${emailGreeting(input.timeZone)} ${escapeHtml(input.displayName)},</p><p class="text">Bonne nouvelle : le binaire Android <strong>${escapeHtml(input.versionLabel)}</strong> de <strong>${escapeHtml(input.productName)}</strong> a été vérifié et approuvé. La communauté peut maintenant l&apos;installer depuis la fiche.</p><div class="context-block"><p class="label">Build approuvé</p><p class="context-name">${escapeHtml(input.productName)}</p><p class="context-meta">${escapeHtml(input.versionLabel)}</p></div><a class="cta" href="${escapeHtml(input.productUrl)}"><span>Voir la fiche</span></a><hr class="divider"><p class="footer">${emailLegalHtml(input.origin)}</p></div></body></html>`;
}

export function buildRejectedSubject(productName: string): string {
  return `Votre APK demande une retouche — ${productName}`;
}

export function buildRejectedText(input: {
  displayName: string;
  productName: string;
  versionLabel: string;
  reason: string;
  dashboardUrl: string;
  origin: string;
  timeZone: string | null;
}): string {
  return [
    `${emailGreeting(input.timeZone)} ${input.displayName},`,
    "",
    `Le binaire Android ${input.versionLabel} de ${input.productName} n'a pas passé la vérification. La fiche reste en ligne — seul le binaire est concerné :`,
    "",
    `Motif : ${input.reason}`,
    "",
    "Renvoyez un APK corrigé depuis votre dashboard, il repassera en revue.",
    "",
    `Dashboard : ${input.dashboardUrl}`,
    "",
    emailLegalText(input.origin),
  ].join("\n");
}

export function buildRejectedHtml(input: {
  displayName: string;
  productName: string;
  versionLabel: string;
  reason: string;
  dashboardUrl: string;
  origin: string;
  timeZone: string | null;
}): string {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(buildRejectedSubject(input.productName))}</title><style>${SHARED_CSS}</style></head><body><div class="container"><div class="brand-area">${emailBrandHtml()}</div><p class="hero">Une retouche, et ça repart.</p><p class="greeting">${emailGreeting(input.timeZone)} ${escapeHtml(input.displayName)},</p><p class="text">Le binaire Android <strong>${escapeHtml(input.versionLabel)}</strong> de <strong>${escapeHtml(input.productName)}</strong> n&apos;a pas passé la vérification. La fiche reste en ligne — seul le binaire est concerné.</p><div class="context-block"><p class="label">Motif</p><p class="context-meta">${escapeHtml(input.reason)}</p></div><p class="text">Renvoyez un APK corrigé depuis votre dashboard, il repassera en revue.</p><a class="cta" href="${escapeHtml(input.dashboardUrl)}"><span>Ouvrir le dashboard</span></a><hr class="divider"><p class="footer">${emailLegalHtml(input.origin)}</p></div></body></html>`;
}
