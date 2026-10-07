/**
 * URL canonique du site (sitemap, robots, canoniques). `NEXT_PUBLIC_SITE_URL`
 * requise en prod — fallback localhost uniquement pour le dev local.
 * Jamais de domaine inventé : un sitemap faux est pire que rien.
 */
export function siteUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL ?? "").trim().replace(/\/+$/, "");
  if (raw !== "") return raw;
  return "http://localhost:3000";
}
