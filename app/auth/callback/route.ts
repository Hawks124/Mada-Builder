import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { addAuthProvider, syncAvatarIfMissing } from "@/services/users.service";
import { captureMessage } from "@/lib/monitoring";
import { withToast } from "@/lib/toast";

/**
 * GET /auth/callback — retour OAuth (Google/GitHub), lien OTP et
 * action_link du code custom. Échange le code, synchronise les providers
 * (multi strict), puis redirige vers ?next= validé same-origin.
 * Feedback via le canal toast partagé (?toast=, voir lib/toast.ts) ;
 * les échecs gardent ?error= (affiché inline sur /signin, contexte
 * présent — pas de toast pour une page qu'on ne quitte pas).
 *
 * ROBUSTESSE cookies (leçon apprise — voir docs/auth.md §9) : getAll
 * depuis les headers, setAll sur LA réponse retournée, jamais réassignée.
 * L'ancien code posait les cookies puis remplaçait la réponse par une
 * vierge : exchange réussi (lignes créées) mais session perdue → boucle
 * /signin. En route handler, pas de request.cookies (NextRequest only) —
 * d'où ce pattern explicite plutôt que celui du middleware.
 */
const TOAST_WELCOME = "Connexion réussie. Bienvenue !";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/dashboard";

  // Redirection sûre : chemin relatif interne uniquement.
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//")
      ? rawNext
      : "/dashboard";

  // Succès : ?next= + toast de bienvenue (canal partagé, consommé une
  // fois puis nettoyé de l'URL par le viewport).
  const successUrl = () =>
    new URL(withToast(`${origin}${next}`, "ok", TOAST_WELCOME), origin);
  const failUrl = (reason: string) => {
    const url = new URL("/signin", origin);
    url.searchParams.set("next", next);
    url.searchParams.set("error", reason);
    return url;
  };

  // Refus côté provider (ex. accès refusé Google) : code mapped, jamais
  // de reflet brut (anti open-redirect sémantique + anti-fuite).
  const providerError = searchParams.get("error");
  if (providerError) {
    captureMessage(`callback: provider error (${providerError})`, "warning");
    return NextResponse.redirect(failUrl("provider_denied"));
  }

  if (!code) {
    return NextResponse.redirect(failUrl("no_code"));
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return NextResponse.redirect(failUrl("not_configured"));
  }

  // Réponse porteuse des cookies de session — pattern explicite et
  // déterministe : getAll depuis les headers entrants, setAll UNIQUEMENT
  // sur LA réponse retournée (jamais réassignée après). Pas de cookies()
  // de next/headers ici (comportement d'attache implicite selon version).
  const response = NextResponse.redirect(successUrl());
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.headers
          .get("cookie")
          ?.split("; ")
          .map((c) => {
            const i = c.indexOf("=");
            return { name: c.slice(0, i), value: c.slice(i + 1) };
          }) ?? [];
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  let userId: string | null = null;
  const linkedProviders: ("github" | "google" | "email")[] = [];
  let metadataAvatar: string | null = null;
  try {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    if (!data.user) throw new Error("exchange sans user");
    userId = data.user.id;
    // TOUTES les identités — pas app_metadata.provider (qui reste le
    // provider d'origine après un link : le nouveau n'était jamais
    // miroiré, d'où providers[] désynchronisé de la réalité).
    const seen = new Set<string>();
    for (const identity of data.user.identities ?? []) {
      const p = identity.provider;
      if ((p === "github" || p === "google" || p === "email") && !seen.has(p)) {
        seen.add(p);
        linkedProviders.push(p);
      }
    }
    const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>;
    const rawAvatar =
      (meta.avatar_url as string | undefined) ??
      (meta.picture as string | undefined) ??
      null;
    metadataAvatar =
      typeof rawAvatar === "string" && rawAvatar !== "" ? rawAvatar : null;
  } catch (e) {
    // Nom/code d'erreur uniquement — jamais de PII, jamais le token (§16).
    const name = e instanceof Error ? e.name : "unknown";
    const message = e instanceof Error ? e.message : "";
    const short =
      message.length > 120 ? `${message.slice(0, 120)}…` : message;
    captureMessage(`callback: exchange failed (${name}): ${short}`, "error");
    return NextResponse.redirect(failUrl("exchange_failed"));
  }

  // Multi strict : le trigger a créé la ligne ; on synchronise CHAQUE
  // identité liée (addAuthProvider idempotent) et on remplit l'avatar
  // OAuth s'il manque (rattrapage pré-`picture`, §9).
  try {
    for (const p of linkedProviders) {
      await addAuthProvider(userId, p);
    }
    await syncAvatarIfMissing(userId, metadataAvatar);
  } catch {
    // Non bloquant : le provider se resynchronisera au prochain login.
    // Jamais de log PII ici (§16).
  }

  return response;
}
