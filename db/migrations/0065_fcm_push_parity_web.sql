-- 0065 — Parité FCM avec la squad mobile + durcissement `user_devices`
-- (ticket canal mobile « Intégration Push Notifications — FCM v1 », revue
-- web 05/11, arbitrage croisé acté des 12 points, retour mobile 05/11).
--
-- CONTEXTE. La squad mobile a posé en prod (migrations 20261030000001+,
-- chaîne Supabase CLI à eux) : la table `user_devices` (tokens FCM),
-- deux colonnes techniques sur `notifications` (`meta`,
-- `fcm_dispatched_at`) et le pipeline push (webhook dashboard
-- `send_push_on_notification` → Edge Function `send-push` → FCM HTTP v1).
-- Notre chaîne Drizzle ne connaissait RIEN de tout ça — le prochain
-- `drizzle-kit generate` aurait voulu détruire le schéma mobile (DROP
-- TABLE/COLUMN). Ce lot lie les deux vérités et applique les
-- durcissements arbitrés.
--
-- ÉTAT PROD VÉRIFIÉ PAR SONDE (05/11, lecture seule) :
-- - `user_devices` posée sous forme d'une itération ANTÉRIEURE de leur
--   migration : 8 colonnes (les `device_model` / `os_version` /
--   `app_version` déclarés dans leur 000001 n'ont jamais vu le jour —
--   CREATE TABLE IF NOT EXISTS no-op) ; 1 device enregistrée, possédée,
--   active (l'app n'envoie pas les métadonnées à l'INSERT) ;
-- - grants : anon = INSERT/UPDATE/DELETE/REFERENCES/TRIGGER/TRUNCATE
--   (SELECT déjà révoqué par eux, tokens jamais lisibles) ;
--   authenticated = tout ; le lot normalise : anon → INSERT, UPDATE ;
--   authenticated → SELECT, INSERT, UPDATE, DELETE (_exact_ leurs
--   GRANT de 000001) ;
-- - policy UPDATE en prod : `USING (true)` — la faille anti-DoS du
--   ticket (quiconque peut cibler la device d'autrui) ;
-- - index : `user_devices_fcm_token_key` (unique inline) + le
--   dupliqué `idx_user_devices_token` (tombé, arbitrage point 8) +
--   `idx_user_devices_lookup` (partiel) + `idx_user_devices_user_id`
--   (3e index mobile, NON ARBITRÉ — laissé intact, hors scope) ;
-- - triggers `notifications` : le Webhook natif
--   `send_push_on_notification` (définition standards Supabase, JWT
--   service_role embarqué par design) — LA voie de dispatch, INTACT ;
--   et le prototype pg_net `tr_notification_created_fcm` +
--   `handle_notification_created_fcm()` mort silencieusement (GUC
--   `app.settings.*` jamais posés en prod) → DROP ;
-- - crons : leurs 4 + `cleanup-stale-fcm-tokens` (dimanche 02:00,
--   chez eux) ; notre purge à 04:40 UTC sans collision.
--
-- ARBITRAGES ACTÉS (retour mobile 05/11, 12/12) :
-- 1. Dispatch = Database Webhook natif UNIQUEMENT (`send_push_on_notification`
--    intact) ; le prototype pg_net sortait silencieusement → DROP
--    (aucun changement de comportement ; l'Edge Function implémente
--    déjà les deux gardes : idempotence, anti-auto-notif D4 par
--    `record.actor_id` présent d'office dans le payload natif du
--    Webhook — correction EF de leur côté, hors DB).
-- 2. Policy UPDATE : fin du `USING (true)` — cibler SES lignes ou les
--    lignes anonymes uniquement ; le CHECK interdit possédé → NULL
--    (l'attaque meurt aux deux étages : la policy SELECT own-only rend
--    la row d'autrui invisible pour une UPDATE, et sur une row visible
--    c'est le CHECK qui refuse possédé → NULL).
-- 3. Hygiène des grants (tokens = secrets de transport ; RLS ne
--    protège pas TRUNCATE).
-- 4. Index dupliqué `idx_user_devices_token` : tombé.
-- 5. Purge des devices anonymes orphelins à 30 j (cron, tempo mobile
--    du point 11).
-- 6. Les 3 colonnes métadonnées de leur contrat déclaré rejoignent la
--    prod (ADD COLUMN IF NOT EXISTS, nullable, zéro risque) — les
--    arbres de migration des deux squads deviennent parfaitement iso.
--
-- IDEMPOTENT de bout en bout : re-jeu sans effet (CREATE TABLE/INDEX
-- IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, contraintes via DO block
-- guardées, policies DROP+CREATE ré-égalité, REVOKE/GRANT/DROP
-- idempotents, cron un-schedule + re-schedule). Rollback modèle :
--   CREATE UNIQUE INDEX idx_user_devices_token
--     ON public.user_devices(fcm_token);
--   ALTER TABLE public.user_devices DROP COLUMN device_model,
--     DROP COLUMN os_version, DROP COLUMN app_version;
--   CREATE TRIGGER tr_notification_created_fcm ... (fonction à
--     recréer depuis la chaîne mobile 20261030000003 si besoin) ;
--   GRANT DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.user_devices
--     TO anon; GRANT TRUNCATE, REFERENCES, TRIGGER ... TO authenticated;
--   PERFORM cron.unschedule('purge-anon-devices');
-- le Webhook et la policy UPDATE corrigée n'ont pas de retour arrière
-- utile (état buggy documenté).

-- 1. user_devices — vérité chaîne web (env fraîche : la table NAÎT ici
--    avec le contrat complet ; prod : no-op). Contrat mobile : FK users
--    cascade, token unique, platform CHECK android|ios, horodateurs.
CREATE TABLE IF NOT EXISTS public.user_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  fcm_token text NOT NULL,
  platform text NOT NULL,
  device_model text,
  os_version text,
  app_version text,
  is_active boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_devices_fcm_token_key UNIQUE (fcm_token),
  CONSTRAINT user_devices_platform_check CHECK (platform IN ('android', 'ios'))
);
--> statement-breakpoint

-- 1b. Miroir de production : les colonnes déclarées dans leur 000001
--     jamais posées en prod (iteration antérieure de leur CREATE
--     TABLE). Nullable, zéro risque — les arbres deviennent iso.
ALTER TABLE public.user_devices ADD COLUMN IF NOT EXISTS device_model text;
--> statement-breakpoint
ALTER TABLE public.user_devices ADD COLUMN IF NOT EXISTS os_version text;
--> statement-breakpoint
ALTER TABLE public.user_devices ADD COLUMN IF NOT EXISTS app_version text;
--> statement-breakpoint

-- 1c. Contraintes de contrat — guardées (prod : déjà là, no-env no-op).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_devices_fcm_token_key'
      AND conrelid = 'public.user_devices'::regclass
  ) THEN
    ALTER TABLE public.user_devices
      ADD CONSTRAINT user_devices_fcm_token_key UNIQUE (fcm_token);
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_devices_platform_check'
      AND conrelid = 'public.user_devices'::regclass
  ) THEN
    ALTER TABLE public.user_devices
      ADD CONSTRAINT user_devices_platform_check
      CHECK (platform IN ('android', 'ios'));
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_user_devices_lookup
  ON public.user_devices (user_id) WHERE is_active = true AND user_id IS NOT NULL;
--> statement-breakpoint
DROP INDEX IF EXISTS public.idx_user_devices_token;
--> statement-breakpoint

-- 2. notifications — les deux colonnes techniques du contrat push
--    (prod : déjà posées par mobile, no-op ; env fraîche : créées ici).
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS meta jsonb NOT NULL DEFAULT '{}'::jsonb;
--> statement-breakpoint
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS fcm_dispatched_at timestamptz;
--> statement-breakpoint

-- 3. RLS user_devices — enable + policies d'égalité mobile corrigées
--    (les quatre portent leur nom d'origine : le miroir mobile reste
--    un DROP+CREATE nominal).
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "user_devices_select_policy" ON public.user_devices;
CREATE POLICY "user_devices_select_policy"
  ON public.user_devices FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
--> statement-breakpoint
DROP POLICY IF EXISTS "user_devices_insert_policy" ON public.user_devices;
CREATE POLICY "user_devices_insert_policy"
  ON public.user_devices FOR INSERT
  TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());
--> statement-breakpoint
DROP POLICY IF EXISTS "user_devices_update_policy" ON public.user_devices;
CREATE POLICY "user_devices_update_policy"
  ON public.user_devices FOR UPDATE
  TO anon, authenticated
  USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR (user_id IS NULL)
  )
  WITH CHECK (
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR (auth.uid() IS NULL AND user_id IS NULL)
  );
-- Note mécanique RLS : une UPDATE n'atteint que les rows
-- SELECT-visibles (policy SELECT own-only) — l'UPDATE anonyme directe
-- est muette (0 row) et la ré-association anonyme → compte passe par
-- l'Edge Function (service_role). C'est fait exprès : rendre les rows
-- anonymes visibles à un rôle client exposerait leurs TOKENS.
--> statement-breakpoint
DROP POLICY IF EXISTS "user_devices_delete_policy" ON public.user_devices;
CREATE POLICY "user_devices_delete_policy"
  ON public.user_devices FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
--> statement-breakpoint

-- 4. Hygiène puis normalisation des grants (l'EF mutante passe par le
--    rôle service, ces droits client ne servent à personne) :
--    - anon : renonce à SELECT (secrets de transport), DELETE,
--      TRUNCATE (échappe au RLS — le trou exact du ticket de revue),
--      REFERENCES, TRIGGER ;
--    - authenticated : SELECT/INSERT/UPDATE/DELETE conserved, le reste
--      (TRUNCATE/REFERENCES/TRIGGER) renonce ;
--    - GRANT explicites = les lignes de leur 000001 : l'état final ne
--      dépend plus des default privileges Supabase (déterministe sur
--      env fraîche ; prod : no-op).
REVOKE SELECT, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.user_devices FROM anon;
--> statement-breakpoint
REVOKE TRUNCATE, REFERENCES, TRIGGER
  ON public.user_devices FROM authenticated;
--> statement-breakpoint
GRANT INSERT, UPDATE ON public.user_devices TO anon;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_devices TO authenticated;
--> statement-breakpoint
-- 4b. SELECT scoped colonnes pour anon : les expressions de policy RLS
--     sont évaluées avec les privilèges de l'appelant (évaluations
--     USING/WITH CHECK referencant user_id) — sans ce grant minimal,
--     toute UPDATE anon meurt en « permission denied » même là où la
--     policy l'autorise (l'ancien USING(true) ne lisait aucune colonne,
--     d'où son fonctionnement historique sous le même masque de grants).
--     Le token reste inaccessible (jamais granté) : SELECT * / fcm_token
--     restent 42501, et sans policy SELECT pour anon, aucune row n'est
--     jamais lisible par anon.
GRANT SELECT (id, user_id) ON public.user_devices TO anon;
--> statement-breakpoint

-- 5. Trait d'horodatage (contrat mobile : updated_at + last_seen_at au
--    BEFORE UPDATE) — ré-égalité de leur 000001.
CREATE OR REPLACE FUNCTION public.handle_user_device_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
  BEGIN
    NEW.updated_at = now();
    NEW.last_seen_at = now();
    RETURN NEW;
  END;
  $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS tr_user_device_updated_at ON public.user_devices;
CREATE TRIGGER tr_user_device_updated_at
  BEFORE UPDATE ON public.user_devices
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_device_updated_at();
--> statement-breakpoint

-- 6. Prototype pg_net mort — arbitrage point 3 appliqué jusqu'au bout
--    (voir header) : le Webhook dashboard reste LA voie de dispatch.
DROP TRIGGER IF EXISTS tr_notification_created_fcm ON public.notifications;
--> statement-breakpoint
DROP FUNCTION IF EXISTS public.handle_notification_created_fcm();
--> statement-breakpoint

-- 7. Purge des devices anonymes (user_id NULL) — jamais dispatchées
--    (lookup = user_id NOT NULL), 30 j de silence (standard Firebase).
CREATE OR REPLACE FUNCTION public.purge_anon_devices()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
  BEGIN
    DELETE FROM public.user_devices
    WHERE user_id IS NULL
      AND updated_at < now() - INTERVAL '30 days';
  END;
  $$;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-anon-devices') THEN
      PERFORM cron.unschedule('purge-anon-devices');
    END IF;
    -- 04:40 UTC : hors des crons des lots précédents (scores */15,
    -- featured 00:05, downloads 03:20, drafts mensuel 03:30) et du
    -- cleanup-stale-fcm-tokens mobile (dimanche 02:00).
    PERFORM cron.schedule('purge-anon-devices', '40 4 * * *',
                          'SELECT public.purge_anon_devices()');
  ELSE
    RAISE NOTICE '0065: pg_cron absent — purge-anon-devices non posé.';
  END IF;
END $$;
