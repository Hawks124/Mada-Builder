import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";

/**
 * Client serveur (Server Components / Actions / Route Handlers).
 * Next 16 : cookies() async. Le refresh session passe par le middleware ;
 * le try/catch setAll est le pattern officiel (composants = lecture seule).
 */
export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error(
      "Supabase non configuré — voir docs/auth.md (checklist providers + env).",
    );
  }
  const cookieStore = await cookies();
  return createServerClient(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Component : écriture ignorée, le middleware rafraîchit.
        }
      },
    },
  });
}

/** Session ou null — jamais d'exception pour "non connecté". */
export async function getSessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export type ViewerResult =
  | { status: "authed"; user: NonNullable<Awaited<ReturnType<typeof getSessionUser>>> }
  | { status: "guest" }
  | { status: "error" };

/** Statuts HTTP = absence prouvée (le reste = incident, jamais un invité). */
const GUEST_STATUSES = new Set([400, 401, 403, 404]);

function isGuestError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    typeof (error as { status?: unknown }).status === "number" &&
    GUEST_STATUSES.has((error as { status: number }).status)
  );
}

function isOutageSimulated(): boolean {
  return process.env.SIMULATE_AUTH_OUTAGE === "1";
}

/**
 * Session distinguée : invité PROUVÉ vs incident — NE JAMAIS REDIRIGER
 * sur "error" (boucle /bienvenue ↔ /signin vue en QA : un hoquet réseau
 * devenait "pas connecté", puis "incomplet", en alternance).
 * Retry unique (300 ms) sur incident : tue 90 % des blips, happy path
 * inchangé (un seul appel quand tout va bien).
 * SIMULATE_AUTH_OUTAGE=1 (dev uniquement) : force le chemin incident
 * pour VOIR les fallbacks au lieu de les croire.
 * Mémoïsé par requête (React cache) : gate + layouts + pages partagent
 * UN seul appel — jamais de double vérification par rendu.
 */
export const getViewer = cache(getViewerUncached);

async function getViewerUncached(): Promise<ViewerResult> {
  if (isOutageSimulated()) return { status: "error" };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (error) {
        if (isGuestError(error)) return { status: "guest" };
        throw error;
      }
      if (!user) return { status: "guest" };
      return { status: "authed", user };
    } catch (e) {
      if (isGuestError(e)) return { status: "guest" };
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        continue;
      }
      return { status: "error" };
    }
  }
  return { status: "error" };
}
