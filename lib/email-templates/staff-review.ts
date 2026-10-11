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
 * Notifications staff — file de revue (D6) : fiche qui ENTRE en pending,
 * build enregistré. Même moule que `appeal-notify.ts` (sec, triable :
 * qui, quoi, où cliquer). Best-effort, silencieux si ADMIN_EMAILS vide.
 * Jamais sur les brouillons ni les edits sans re-revue (pas de spam).
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
    .cta { display: inline-block; background-color: #09090b; text-decoration: none; padding: 18px 36px; border-radius: 999px; letter-spacing: -0.01em; }
    .cta span { font-size: 15px; font-weight: 600; color: #ffffff !important; }
    .divider { border: none; border-top: 2px solid #e4e4e7; width: 32px; margin: 64px 0 32px 0; margin-left: 0; }
    .footer { font-size: 13px; color: #a1a1aa; line-height: 1.5; }
    ${BRAND_CSS_BASE}
`;

export type StaffFicheInfo = {
  productName: string;
  makerDisplayName: string;
  reviewUrl: string;
  origin: string;
  /** Ligne d'état binaire (D6) : builds en revue / en ligne / rien. */
  buildNote: string | null;
};

export function staffFicheSubmittedSubject(productName: string): string {
  return `File revue : ${productName} — fiche à relire`;
}

export function staffFicheSubmittedText(input: StaffFicheInfo): string {
  return [
    "BuilderPlatform - Modération",
    "---",
    `Nouvelle fiche en revue : ${input.productName} (par ${input.makerDisplayName}).`,
    ...(input.buildNote ? [input.buildNote] : []),
    "",
    `Vérifier : ${input.reviewUrl}`,
    "",
    emailLegalText(input.origin),
  ].join("\n");
}

export function staffFicheSubmittedHtml(input: StaffFicheInfo): string {
  const buildLine = input.buildNote ? `<p class="text">${escapeHtml(input.buildNote)}</p>` : "";
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(staffFicheSubmittedSubject(input.productName))}</title><style>${SHARED_CSS}</style></head><body><div class="container"><div class="brand-area">${emailBrandHtml()}</div><p class="hero">Fiche à relire.</p><div class="context-block"><p class="label">En revue</p><p class="context-name">${escapeHtml(input.productName)}</p><p class="context-meta">par ${escapeHtml(input.makerDisplayName)}</p></div>${buildLine}<a class="cta" href="${escapeHtml(input.reviewUrl)}"><span>Vérifier →</span></a><hr class="divider"><p class="footer">${emailLegalHtml(input.origin)}</p></div></body></html>`;
}

export type StaffBuildInfo = {
  productName: string;
  makerDisplayName: string;
  versionLabel: string;
  package: string | null;
  reviewUrl: string;
  origin: string;
  /** Ligne d'état fiche (D6) : en revue elle aussi / déjà en ligne / rejetée. */
  ficheNote: string | null;
};

export function staffBuildSubmittedSubject(productName: string): string {
  return `File revue : ${productName} — binaire à tester`;
}

export function staffBuildSubmittedText(input: StaffBuildInfo): string {
  return [
    "BuilderPlatform - Modération",
    "---",
    `Nouveau binaire en revue : ${input.productName} ${input.versionLabel} (par ${input.makerDisplayName}).`,
    ...(input.package ? [`Package : ${input.package}`] : []),
    ...(input.ficheNote ? [input.ficheNote] : []),
    "",
    `Vérifier (installer + tester) : ${input.reviewUrl}`,
    "",
    emailLegalText(input.origin),
  ].join("\n");
}

export function staffBuildSubmittedHtml(input: StaffBuildInfo): string {
  const ficheLine = input.ficheNote ? `<p class="text">${escapeHtml(input.ficheNote)}</p>` : "";
  const packageLine = input.package
    ? `<p class="context-meta">${escapeHtml(input.package)}</p>`
    : "";
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(staffBuildSubmittedSubject(input.productName))}</title><style>${SHARED_CSS}</style></head><body><div class="container"><div class="brand-area">${emailBrandHtml()}</div><p class="hero">Binaire à tester.</p><div class="context-block"><p class="label">En revue</p><p class="context-name">${escapeHtml(input.productName)}</p><p class="context-meta">${escapeHtml(input.versionLabel)} · par ${escapeHtml(input.makerDisplayName)}</p>${packageLine}</div>${ficheLine}<a class="cta" href="${escapeHtml(input.reviewUrl)}"><span>Vérifier →</span></a><hr class="divider"><p class="footer">${emailLegalHtml(input.origin)}</p></div></body></html>`;
}
