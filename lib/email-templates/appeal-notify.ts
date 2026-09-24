function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function appealNotifySubject(username: string): string {
  return `Appel de @${username} — décision requise`;
}

export function appealNotifyText(input: {
  username: string;
  displayName: string;
  banReason: string;
  explanation: string;
  evidenceLinks: string[];
}): string {
  return [
    "BuilderPlatform — Modération",
    "---",
    `Nouvel appel de ${input.displayName} (@${input.username}) :`,
    "",
    `Motif du ban : ${input.banReason}`,
    "",
    "EXPLICATION :",
    input.explanation,
    "",
    input.evidenceLinks.length > 0
      ? `PIÈCES (liens 72 h) :\n${input.evidenceLinks.join("\n")}`
      : "Aucune pièce jointe.",
    "",
    "Trancher dans /admin/users (filtre Appels).",
  ].join("\n");
}

export function appealNotifyHtml(input: {
  username: string;
  displayName: string;
  banReason: string;
  explanation: string;
  evidenceLinks: string[];
}): string {
  const pieces = input.evidenceLinks.length > 0
    ? `<ul style="padding-left:20px;margin:0 0 40px 0;">${input.evidenceLinks.map((l) => `<li style="margin-bottom:8px;"><a href="${escapeHtml(l)}" style="color:#2563eb;font-weight:600;text-decoration:none;">Pièce jointe (${escapeHtml(l.split("/").pop() ?? "Fichier")})</a></li>`).join("")}</ul>`
    : `<p class="text" style="font-style:italic;">Aucune pièce jointe.</p>`;

  return `<!doctype html>
<html lang="fr" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Appel de @${escapeHtml(input.username)}</title>
  <style type="text/css">
    :root { color-scheme: light dark; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; margin: 0; padding: 0; background-color: #ffffff; color: #09090b; }
    .container { max-width: 540px; margin: 0 auto; padding: 64px 24px; text-align: left; }
    
    .hero { font-size: 36px; font-weight: 800; letter-spacing: -0.04em; margin: 0 0 16px 0; line-height: 1.1; color: #2563eb; }
    .subtitle { font-size: 18px; font-weight: 600; color: #09090b; margin: 0 0 48px 0; }
    
    .label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; color: #71717a; margin: 0 0 8px 0; }
    .data-text { font-size: 16px; color: #09090b; font-weight: 600; margin: 0 0 32px 0; }
    .text { font-size: 15px; line-height: 1.6; color: #52525b; margin: 0 0 32px 0; }
    
    .divider { border: none; border-top: 2px solid #e4e4e7; width: 32px; margin: 64px 0 32px 0; margin-left: 0; }
    .footer { font-size: 13px; color: #a1a1aa; line-height: 1.5; }
    
    @media (prefers-color-scheme: dark) {
      body { background-color: #000000 !important; color: #ffffff !important; }
      .subtitle, .data-text { color: #ffffff !important; }
      .text { color: #a1a1aa !important; }
      .hero { color: #3b82f6 !important; }
      .divider { border-top-color: #27272a !important; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1 class="hero">Nouvel appel.</h1>
    <p class="subtitle">${escapeHtml(input.displayName)} (@${escapeHtml(input.username)}) conteste sa suspension.</p>
    
    <p class="label">Motif initial</p>
    <p class="data-text">${escapeHtml(input.banReason)}</p>

    <p class="label">Explication fournie</p>
    <p class="text">${escapeHtml(input.explanation)}</p>

    <p class="label">Preuves / Pièces</p>
    ${pieces}

    <hr class="divider" />
    <div class="footer">
      Décision requise dans <strong>/admin/users</strong> (filtre Appels).<br>
      BuilderPlatform
    </div>
  </div>
</body>
</html>`;
}