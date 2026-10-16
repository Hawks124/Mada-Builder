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

export type LegalDoc = "confidentialite" | "conditions";

export const LEGAL_DOC_LABEL: Record<LegalDoc, string> = {
  confidentialite: "Politique de confidentialité",
  conditions: "Conditions d'utilisation",
};

const SHARED_CSS = `
    :root { color-scheme: light dark; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; margin: 0; padding: 0; background-color: #ffffff; color: #09090b; }
    .container { max-width: 540px; margin: 0 auto; padding: 64px 24px; text-align: left; }
    .brand-area { margin-bottom: 64px; }
    .hero { font-size: 36px; font-weight: 800; letter-spacing: -0.04em; margin: 0 0 48px 0; line-height: 1.1; }
    .greeting { font-size: 20px; font-weight: 600; letter-spacing: -0.02em; margin: 0 0 16px 0; color: #09090b; }
    .text { font-size: 16px; line-height: 1.7; color: #52525b; margin: 0 0 24px 0; }
    .divider { border: none; border-top: 2px solid #e4e4e7; width: 32px; margin: 64px 0 32px 0; margin-left: 0; }
    .footer { font-size: 13px; color: #a1a1aa; line-height: 1.5; }
    ${BRAND_CSS_BASE}

    @media (prefers-color-scheme: dark) {
      body { background-color: #000000 !important; color: #ffffff !important; }
      .greeting { color: #ffffff !important; }
      .divider { border-top-color: #27272a !important; }
      ${BRAND_CSS_DARK}
    }`;

export function legalNoticeSubject(doc: LegalDoc): string {
  return `Mise à jour : ${LEGAL_DOC_LABEL[doc]}`;
}

export type LegalNoticeInput = {
  displayName: string;
  doc: LegalDoc;
  /** Ce qui change, en une phrase (rédigé par l'opérateur au moment du préavis). */
  summary: string;
  docUrl: string;
  /** « entre en vigueur le … » — le préavis de 15 jours. */
  effectiveLabel: string;
  origin: string;
  timeZone: string | null;
};

export function legalNoticeText(input: LegalNoticeInput): string {
  return [
    "Mada-Made",
    "---",
    `${emailGreeting(input.timeZone)} ${input.displayName},`,
    "",
    `${LEGAL_DOC_LABEL[input.doc]} — mise à jour annoncée (${input.effectiveLabel}).`,
    "",
    input.summary,
    "",
    `Lire : ${input.docUrl}`,
    "",
    "Cet email est un préavis contractuel : il part même si vous avez coupé le récap hebdo. Votre compte reste supprimable à tout moment (profil → compte).",
    "",
    "---",
    emailLegalText(input.origin),
  ].join("\n");
}

export function legalNoticeHtml(input: LegalNoticeInput): string {
  const name = escapeHtml(input.displayName);
  const summary = escapeHtml(input.summary);
  const docUrl = escapeHtml(input.docUrl);
  const label = LEGAL_DOC_LABEL[input.doc];
  return `<!doctype html>
<html lang="fr" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${label} — mise à jour</title>
  <style type="text/css">${SHARED_CSS}
    .hero { color: #2563eb; }
  </style>
</head>
<body>
  <div class="container">
    <div class="brand-area">
      ${emailBrandHtml()}
    </div>
    <h1 class="hero">Ça change, on vous prévient.</h1>
    <p class="greeting">${emailGreeting(input.timeZone)} ${name},</p>
    <p class="text"><strong>${label}</strong> — mise à jour annoncée (${escapeHtml(input.effectiveLabel)}).</p>
    <p class="text">${summary}</p>
    <p class="text"><a href="${docUrl}">${docUrl}</a></p>
    <p class="text">Cet email est un préavis contractuel : il part même si vous avez coupé le récap hebdo. Votre compte reste supprimable à tout moment (profil → compte).</p>
    <hr class="divider" />
    <div class="footer">${emailLegalHtml(input.origin)}</div>
  </div>
</body>
</html>`;
}
