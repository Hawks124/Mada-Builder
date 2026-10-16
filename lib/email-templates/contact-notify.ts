import { BRAND_CSS_BASE, emailBrandHtml } from "@/lib/email-templates/brand";
import { emailLegalHtml, emailLegalText } from "@/lib/email-templates/footer";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Notification staff — nouveau message `/contact`. Même moule que
 * `staff-review.ts` (sec, triable : qui, quoi, où cliquer). Le message
 * est repris tel quel (échappé) pour juger sans ouvrir l'inbox.
 * Best-effort, silencieux si ADMIN_EMAILS vide.
 */
const SHARED_CSS = `
    :root { color-scheme: light dark; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; margin: 0; padding: 0; background-color: #ffffff; color: #09090b; }
    .container { max-width: 540px; margin: 0 auto; padding: 64px 24px; text-align: left; }
    .brand-area { margin-bottom: 64px; }
    .hero { font-size: 32px; font-weight: 800; letter-spacing: -0.04em; margin: 0 0 24px 0; line-height: 1.1; }
    .text { font-size: 16px; line-height: 1.7; color: #52525b; margin: 0 0 24px 0; }
    .label { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; color: #a1a1aa; margin: 0 0 10px 0; }
    .context-block { border-left: 2px solid var(--accent-color, #e4e4e7); padding-left: 16px; margin: 0 0 40px 0; }
    .context-name { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; color: #09090b; margin: 0 0 8px 0; line-height: 1.2; }
    .context-meta { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 13px; color: #71717a; margin: 0; line-height: 1.6; }
    .quote { font-size: 15px; line-height: 1.7; color: #09090b; background: #f4f4f5; border-radius: 12px; padding: 16px 18px; margin: 0 0 40px 0; white-space: pre-wrap; }
    .cta { display: inline-block; background-color: #09090b; text-decoration: none; padding: 18px 36px; border-radius: 999px; letter-spacing: -0.01em; }
    .cta span { font-size: 15px; font-weight: 600; color: #ffffff !important; }
    .divider { border: none; border-top: 2px solid #e4e4e7; width: 32px; margin: 64px 0 32px 0; margin-left: 0; }
    .footer { font-size: 13px; color: #a1a1aa; line-height: 1.5; }
    ${BRAND_CSS_BASE}
`;

export type ContactNotifyInfo = {
  name: string;
  email: string;
  subjectLabel: string;
  message: string;
  productUrl: string | null;
  inboxUrl: string;
  origin: string;
};

export function contactNotifySubject(subjectLabel: string, name: string): string {
  return `Contact ${subjectLabel} — ${name}`;
}

export function contactNotifyText(input: ContactNotifyInfo): string {
  return [
    "Mada-Made",
    "---",
    `Nouveau message (${input.subjectLabel}) de ${input.name} <${input.email}>.`,
    ...(input.productUrl ? [`Lien fourni : ${input.productUrl}`] : []),
    "",
    input.message,
    "",
    `Traiter : ${input.inboxUrl}`,
    "",
    emailLegalText(input.origin),
  ].join("\n");
}

export function contactNotifyHtml(input: ContactNotifyInfo): string {
  const productLine = input.productUrl
    ? `<p class="context-meta">Lien fourni : ${escapeHtml(input.productUrl)}</p>`
    : "";
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(contactNotifySubject(input.subjectLabel, input.name))}</title><style>${SHARED_CSS}</style></head><body><div class="container"><div class="brand-area">${emailBrandHtml()}</div><p class="hero">Message à traiter.</p><div class="context-block"><p class="label">${escapeHtml(input.subjectLabel)}</p><p class="context-name">${escapeHtml(input.name)}</p><p class="context-meta">${escapeHtml(input.email)}</p>${productLine}</div><p class="quote">${escapeHtml(input.message)}</p><a class="cta" href="${escapeHtml(input.inboxUrl)}"><span>Ouvrir l'inbox →</span></a><hr class="divider"><p class="footer">${emailLegalHtml(input.origin)}</p></div></body></html>`;
}
