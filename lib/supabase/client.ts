import { createBrowserClient } from "@supabase/ssr";

/** Client navigateur — clé anon (JWT legacy), jamais service_role. */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error(
      "Supabase non configuré — voir docs/auth.md (checklist providers + env).",
    );
  }
  return createBrowserClient(url, anon);
}
