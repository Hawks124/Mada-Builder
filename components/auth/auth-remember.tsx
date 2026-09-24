"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";

export type RememberedProvider = "google" | "github" | "email";

const STORAGE_KEY = "builder-auth-last-provider";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function isProvider(value: unknown): value is RememberedProvider {
  return value === "google" || value === "github" || value === "email";
}

function clear() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode — rien à purger */
  }
}

export function writeRememberedProvider(provider: RememberedProvider): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ provider, at: Date.now() }),
    );
  } catch {
    /* private mode — pas d'historique */
  }
}

/** Lecture avec expiry 30 j. Ancien format string brut → purgé (âge inconnu). */
export function readRememberedProvider(): RememberedProvider | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      isProvider((parsed as { provider?: unknown }).provider) &&
      typeof (parsed as { at?: unknown }).at === "number" &&
      Date.now() - ((parsed as { at: number }).at as number) < MAX_AGE_MS
    ) {
      return (parsed as { provider: RememberedProvider }).provider;
    }
  } catch {
    /* JSON invalide → purge ci-dessous */
  }
  clear();
  return null;
}

/**
 * Monté dans le root layout : après une auth OAuth complétée (retour
 * callback), dérive le provider gagnant de max(identities[].last_sign_in_at)
 * et l'enregistre. Ne s'exécute en réseau QUE si aucun badge valide n'existe.
 * Un abandon OAuth n'écrit jamais rien — fini les badges fantômes.
 */
export function AuthRemember() {
  React.useEffect(() => {
    if (readRememberedProvider() !== null) return;
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session || cancelled) return;
        const { data } = await supabase.auth.getUser();
        let best: { provider: string; at: number } | null = null;
        for (const identity of data.user?.identities ?? []) {
          const at = identity.last_sign_in_at
            ? Date.parse(identity.last_sign_in_at)
            : 0;
          if (identity.provider && at > (best?.at ?? -1)) {
            best = { provider: identity.provider, at };
          }
        }
        if (best && isProvider(best.provider) && !cancelled) {
          writeRememberedProvider(best.provider);
        }
      } catch {
        /* silencieux — jamais bloquant */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
