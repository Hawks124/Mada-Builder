import { emailBrandHtml } from "@/lib/email-templates/brand";
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
 * Retrait admin d'un produit (non-conformité) — best-effort, jamais
 * bloquant (le retrait est déjà effectif quand cet email part).
 */
export function productRemovedSubject(productName: string): string {
  return `Mise à jour : ${productName} a été retiré`;
}

export function productRemovedText(input: {
  displayName: string;
  productName: string;
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
    `${input.productName} a été retiré de l'annuaire.`,
    "",
    "MOTIF :",
    input.reason,
    "",
    "Vous pouvez corriger puis soumettre à nouveau — aucune sanction sur votre compte.",
    "",
    `Tableau de bord : ${input.dashboardUrl}`,
    "",
    "---",
    emailLegalText(input.origin),
  ].join("\n");
}

export function productRemovedHtml(input: {
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

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <title>Produit retiré</title>
</head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Helvetica,Arial,sans-serif;margin:0;padding:0;background-color:#ffffff;color:#09090b;">
  <div style="max-width:540px;margin:0 auto;padding:64px 24px;">
    ${emailBrandHtml()}
    <p style="font-size:36px;font-weight:800;letter-spacing:-0.04em;margin:0 0 48px 0;line-height:1.1;">Retiré.</p>
    <p style="font-size:20px;font-weight:600;margin:0 0 16px 0;">${emailGreeting(input.timeZone)} ${name},</p>
    <p style="font-size:16px;line-height:1.7;color:#52525b;margin:0 0 24px 0;"><strong>${product}</strong> a été retiré de l'annuaire. Voici le motif :</p>
    <div style="border-left:2px solid #e4e4e7;padding-left:16px;margin:0 0 40px 0;">
      <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;color:#a1a1aa;margin:0 0 10px 0;">Motif du retrait</p>
      <p style="font-size:18px;font-weight:700;margin:0;">${reason}</p>
    </div>
    <p style="font-size:14px;font-style:italic;color:#a1a1aa;margin:0 0 40px 0;">Vous pouvez corriger puis soumettre à nouveau — aucune sanction sur votre compte.</p>
    <p style="font-size:16px;margin:0 0 24px 0;">Relisez la <a href="${rulesUrl}" style="color:#09090b;font-weight:600;">charte de la communauté</a> en cas de doute.</p>
    <div style="margin-bottom:40px;"><a href="${dashboard}" style="display:inline-block;background-color:#09090b;text-decoration:none;padding:18px 36px;border-radius:999px;"><span style="font-size:15px;font-weight:600;color:#ffffff;">Voir mon tableau de bord</span></a></div>
    <hr style="border:none;border-top:2px solid #e4e4e7;width:32px;margin:64px 0 32px 0;">
    <p style="font-size:13px;color:#a1a1aa;line-height:1.5;">Notification produit &bull; Mada-Made &copy; ${new Date().getFullYear()}<br>${emailLegalHtml(input.origin)}</p>
  </div>
</body>
</html>`;
}
