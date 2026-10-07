import { createClient } from "@supabase/supabase-js";

/**
 * Client Supabase anon STATELESS (routes API mobiles) : pas de cookies,
 * pas de persistance — on échange et on RENVOIE la session en JSON
 * (le client natif la stocke via `setSession`). Jamais service_role.
 */
export function createStatelessClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error("Supabase non configuré — voir docs/auth.md (checklist providers + env).");
  }
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
