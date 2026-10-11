/**
 * Hosts d'images distantes autorisés — SOURCE UNIQUE partagée par
 * `next.config.ts` (remotePatterns) et `AvatarImage` (repli initiales).
 * Un seul endroit à maintenir quand un host s'ajoute (R2, OAuth…).
 *
 * Règles :
 * - `*.r2.dev` : buckets R2 en dev (hash variable par bucket, d'où le
 *   wildcard — jamais de hash en dur ici).
 * - Domaines customs prod : lus depuis `R2_PUBLIC_*_BASE` (mêmes vars,
 *   autres valeurs au deploy — zéro changement de code).
 * - `gitlab.com` : avatars uploadés GitLab (OAuth).
 * - Gravatar (`secure.gravatar.com`, avatar par défaut GitLab) EXCLU
 *   volontairement : pixel tiers (Automattic) — le repli initiales
 *   couvre, meilleure posture vie privée (doctrine : aucun pixel tiers).
 * - Placeholders démo conservés (pravatar, picsum — seeds/maquettes).
 */
type RemoteHost = { protocol: "https"; hostname: string };

const STATIC_HOSTS: RemoteHost[] = [
  { protocol: "https", hostname: "i.pravatar.cc" },
  { protocol: "https", hostname: "picsum.photos" },
  { protocol: "https", hostname: "*.supabase.co" },
  { protocol: "https", hostname: "lh3.googleusercontent.com" },
  { protocol: "https", hostname: "avatars.githubusercontent.com" },
  { protocol: "https", hostname: "gitlab.com" },
  { protocol: "https", hostname: "*.r2.dev" },
];

function hostOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Domaines customs R2 (prod) depuis l'env — ignorés si r2.dev/placeholder. */
export function customR2Hosts(): RemoteHost[] {
  const out: RemoteHost[] = [];
  for (const raw of [process.env.R2_PUBLIC_LOGOS_BASE, process.env.R2_PUBLIC_SHOTS_BASE]) {
    const h = hostOf(raw);
    if (h && h !== "" && !h.endsWith(".r2.dev") && !h.includes("example.com")) {
      out.push({ protocol: "https", hostname: h });
    }
  }
  return out;
}

/** remotePatterns effectifs pour next.config (statiques + customs dédupliqués). */
export function remoteImagePatterns(): RemoteHost[] {
  const seen = new Set<string>();
  return [...STATIC_HOSTS, ...customR2Hosts()].filter((h) => {
    if (seen.has(h.hostname)) return false;
    seen.add(h.hostname);
    return true;
  });
}

function matchHost(hostname: string, pattern: string): boolean {
  if (pattern.startsWith("*.")) {
    const base = pattern.slice(2);
    return hostname === base || hostname.endsWith(`.${base}`);
  }
  return hostname === pattern;
}

/**
 * Garde runtime (client-safe) : `true` si next/image peut servir cette
 * src sans jeter (host allowlisté). Chemins relatifs (`/logos/…`) et
 * data: toujours OK. Utilisé par AvatarImage AVANT next/image : un host
 * inattendu donne des initiales, jamais un crash de page.
 */
export function isRemoteImageAllowed(src: string | null): boolean {
  if (!src) return false;
  if (src.startsWith("/") || src.startsWith("data:")) return true;
  const host = hostOf(src);
  if (!host) return false;
  return STATIC_HOSTS.some((h) => matchHost(host, h.hostname));
}
