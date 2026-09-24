import {
  BRAND_CSS_BASE,
  BRAND_CSS_DARK,
  emailBrandHtml,
} from "@/lib/email-templates/brand";
import { emailLegalHtml, emailLegalText } from "@/lib/email-templates/footer";

export function otpEmailSubject(): string {
  return "Connexion — BuilderPlatform";
}

export function otpEmailText(input: {
  code: string;
  validityMinutes: number;
  /** Absent pour un email inconnu (création paresseuse : pas de compte). */
  actionLink: string | null;
  /** Origine absolue (footer juridique). */
  origin: string;
}): string {
  const lines = [
    "BuilderPlatform",
    "---",
    "Connexion.",
    "",
    "Votre code à usage unique :",
    input.code,
    "",
    `Valable ${input.validityMinutes} minutes.`,
  ];
  if (input.actionLink) {
    lines.push("", "Lien de connexion rapide :", input.actionLink);
  }
  lines.push("", "---", emailLegalText(input.origin));
  return lines.join("\n");
}

export function otpEmailHtml(input: {
  code: string;
  validityMinutes: number;
  /** Absent pour un email inconnu (création paresseuse : pas de compte). */
  actionLink: string | null;
  /** Origine absolue (footer juridique). */
  origin: string;
}): string {
  return `<!doctype html>
<html lang="fr" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>Connexion</title>
  <style type="text/css">
    :root { color-scheme: light dark; }
    
    body { 
      font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif; 
      -webkit-font-smoothing: antialiased; 
      -moz-osx-font-smoothing: grayscale;
      margin: 0; padding: 0; 
      background-color: #ffffff; color: #09090b; 
    }
    
    .container { max-width: 540px; margin: 0 auto; padding: 64px 24px; text-align: left; }
    
    /* Branding Header */
    .brand-area { margin-bottom: 64px; }
    .brand-text { font-size: 16px; font-weight: 700; letter-spacing: -0.02em; color: #09090b; }
    
    /* Typographie */
    .hero { font-size: 40px; font-weight: 800; letter-spacing: -0.04em; margin: 0 0 56px 0; line-height: 1.1; }
    .label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; color: #71717a; margin: 0 0 16px 0; }
    .code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 48px; font-weight: 800; letter-spacing: 0.2em; margin: 0 0 56px 0; color: #09090b; display: block; }
    .text { font-size: 16px; line-height: 1.6; color: #52525b; margin: 0 0 40px 0; font-weight: 400; }
    
    .cta { display: inline-block; background-color: #09090b; color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; padding: 18px 36px; border-radius: 999px; letter-spacing: -0.01em; }
    
    .footer { margin-top: 96px; font-size: 13px; color: #a1a1aa; line-height: 1.5; }
    ${BRAND_CSS_BASE}
    
    @media (prefers-color-scheme: dark) {
      body { background-color: #000000 !important; color: #ffffff !important; }
      .brand-text, .code { color: #ffffff !important; }
      .text { color: #a1a1aa !important; }
      .label { color: #71717a !important; }
      .cta { background-color: #ffffff !important; color: #000000 !important; }
      ${BRAND_CSS_DARK}
    }
  </style>
</head>
<body>
  <div class="container">
    
    <!-- BRANDING -->
    <div class="brand-area">
      ${emailBrandHtml()}
    </div>

    <h1 class="hero">Connexion.</h1>
    
    <p class="label">Votre code d'accès</p>
    <span class="code">${input.code}</span>
    
    <p class="text">Ce code est valable ${input.validityMinutes} minutes. Si vous n'êtes pas à l'origine de cette demande, vous pouvez l'ignorer en toute sécurité.</p>
    ${input.actionLink ? `<div>
      <a href="${input.actionLink}" class="cta">Se connecter rapidement</a>
    </div>` : ""}
    
    <div class="footer">
      BuilderPlatform &copy; ${new Date().getFullYear()}<br>
      ${emailLegalHtml(input.origin)}
    </div>
  </div>
</body>
</html>`;
}