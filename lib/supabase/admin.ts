import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Client ADMIN Supabase (service_role) — SERVEUR UNIQUEMENT.
 * GOD MODE : bypass RLS, jamais importé côté client (ni dans un Server
 * Component rendu côté client). Usage : generateLink OTP, resyncs admin.
 * Rotation immédiate si la clé est exposée.
 */
let cached: SupabaseClient | null = null;

export function createAdminClient(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    throw new Error(
      "Supabase admin non configuré — SUPABASE_SERVICE_ROLE_KEY manquante (voir .env.example).",
    );
  }
  cached = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}
