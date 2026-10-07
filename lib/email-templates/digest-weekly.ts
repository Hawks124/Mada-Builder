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

const SHARED_CSS = `
    :root { color-scheme: light dark; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; margin: 0; padding: 0; background-color: #ffffff; color: #09090b; }
    .container { max-width: 540px; margin: 0 auto; padding: 64px 24px; text-align: left; }
    .brand-area { margin-bottom: 64px; }
    .hero { font-size: 36px; font-weight: 800; letter-spacing: -0.04em; margin: 0 0 48px 0; line-height: 1.1; }
    .greeting { font-size: 20px; font-weight: 600; letter-spacing: -0.02em; margin: 0 0 16px 0; color: #09090b; }
    .text { font-size: 16px; line-height: 1.7; color: #52525b; margin: 0 0 24px 0; }
    .digest-list { margin: 0 0 40px 0; padding-left: 20px; }
    .digest-list li { font-size: 15px; line-height: 1.7; color: #09090b; margin-bottom: 8px; }
    .divider { border: none; border-top: 2px solid #e4e4e7; width: 32px; margin: 64px 0 32px 0; margin-left: 0; }
    .footer { font-size: 13px; color: #a1a1aa; line-height: 1.5; }
    ${BRAND_CSS_BASE}

    @media (prefers-color-scheme: dark) {
      body { background-color: #000000 !important; color: #ffffff !important; }
      .greeting { color: #ffffff !important; }
      .digest-list li { color: #ffffff !important; }
      .divider { border-top-color: #27272a !important; }
      ${BRAND_CSS_DARK}
    }`;

function shell(
  title: string,
  heroColor: string,
  hero: string,
  bodyHtml: string,
  origin: string,
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
    <div class="footer">${emailLegalHtml(origin)}</div>
  </div>
</body>
</html>`;
}

export function digestWeeklySubject(unread: number): string {
  return `Votre semaine : ${unread} notification${unread > 1 ? "s" : ""}`;
}

export function digestWeeklyText(input: {
  displayName: string;
  unread: number;
  lines: string[];
  dashboardUrl: string;
  origin: string;
  timeZone: string | null;
}): string {
  return [
    "BuilderPlatform",
    "---",
    `${emailGreeting(input.timeZone)} ${input.displayName},`,
    "",
    `Votre semaine sur l'annuaire : ${input.unread} notification${input.unread > 1 ? "s" : ""} non lue${input.unread > 1 ? "s" : ""}.`,
    "",
    ...input.lines.map((l) => `• ${l}`),
    "",
    `Dashboard : ${input.dashboardUrl}`,
    "",
    "Pour ne plus recevoir ce récap : réglages du profil → notifications.",
    "",
    "---",
    emailLegalText(input.origin),
  ].join("\n");
}

export function digestWeeklyHtml(input: {
  displayName: string;
  unread: number;
  lines: string[];
  dashboardUrl: string;
  origin: string;
  timeZone: string | null;
}): string {
  const name = escapeHtml(input.displayName);
  const items = input.lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("");
  return shell(
    "Récap hebdo",
    "#f59e0b",
    `${input.unread} non lue${input.unread > 1 ? "s" : ""}`,
    `<p class="greeting">${emailGreeting(input.timeZone)} ${name},</p>
    <p class="text">Votre semaine sur l'annuaire : <strong>${input.unread} notification${input.unread > 1 ? "s" : ""} non lue${input.unread > 1 ? "s" : ""}</strong>.</p>

    <ul class="digest-list">${items}</ul>

    <p class="text">Pour ne plus recevoir ce récap : réglages du profil → notifications.</p>

    <p class="text"><a href="${escapeHtml(input.dashboardUrl)}">${escapeHtml(input.dashboardUrl)}</a></p>`,
    input.origin,
  );
}
