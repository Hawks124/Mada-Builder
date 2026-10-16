-- Verrou colonnes sensibles (signalement équipe mobile, oct. 2026) :
-- la policy `users_update_own` filtre la LIGNE mais aucune COLONNE —
-- tout client authentifié pouvait `SET role = 'admin'` (escalade vers
-- le panel complet, la vérité DB elle-même étant modifiable).
-- Trigger BEFORE UPDATE : les identités de service (Drizzle/postgres,
-- service_role, supabase_admin — promotions admin, onboarding, sync)
-- passent ; tout autre appelant qui touche role, banned_at, email,
-- username ou providers est rejeté. Les champs profil (bio,
-- display_name, avatar…) restent modifiables : non-breaking.
CREATE OR REPLACE FUNCTION public.lock_users_sensitive_columns()
RETURNS trigger
LANGUAGE plpgsql
-- INVOKER (défaut) : current_user = l'appelant réel, pas le owner.
-- Avec DEFINER, le test current_user verrait toujours postgres et le
-- verrou ne fermerait rien.
AS $$
BEGIN
  IF current_user IN ('postgres', 'service_role', 'supabase_admin') THEN
    RETURN NEW;
  END IF;
  IF coalesce(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.banned_at IS DISTINCT FROM OLD.banned_at
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.username IS DISTINCT FROM OLD.username
     OR NEW.providers IS DISTINCT FROM OLD.providers THEN
    RAISE EXCEPTION 'colonnes protégées : role, banned_at, email, username, providers (service_role seul)';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS users_lock_sensitive ON public.users;
--> statement-breakpoint
CREATE TRIGGER users_lock_sensitive
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.lock_users_sensitive_columns();
