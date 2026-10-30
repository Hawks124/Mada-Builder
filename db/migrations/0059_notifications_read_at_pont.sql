-- 0059 : pont PostgREST — marquage « lu » des notifications (read_at).
--
-- Demande (ticket squad mobile, suite du pont 0055) : le mobile marque
-- ses propres notifications comme lues DIRECTEMENT via PostgREST
-- (sub-5 ms), au lieu du PATCH /api/v1/me/notifications (API web =
-- round-trip + dépendance au serveur). Le code Dart est prêt
-- (NotificationService : update({'read_at'}) prioritaire, le PATCH ne
-- subsiste que comme fallback) — dès ce pont posé, le passage est
-- instantané côté mobile, aucune mise à jour applicative.
--
-- Surface demandée (ultra-restreinte, les mêmes verrous que 0055) :
--   1. RLS UPDATE own : USING/WITH CHECK user_id = auth.uid() ;
--   2. GRANT UPDATE (read_at) SEULE — destinataire, kind, texte, rang
--      (product_id/actor_id) et horodateurs intouchables côté client ;
--   3. INSERT / DELETE restent fermés à authenticated : les
--      notifications naissent des triggers du pont (0055) et du service
--      web uniquement — une tentative client tombe sur un 42501 clair ;
--   4. forteresse SELECT own (3d-quater) : elle ne vivait JUSQU'ICI que
--      dans setup.sql (reconstruction d'environnement neuf), pas dans
--      les migrations — une base n'ayant suivi QUE les migrations
--      restait sans RLS sur cette table, et le GRANT SELECT de 0055
--      rendait alors toutes les lignes lisibles par tout authenticated
--      (fuite réelle entre makers ; la politique est replombée ICI, le
--      pont s'applique de façon autoportante).
--
-- Idempotence : DROP IF EXISTS + CREATE + ALTER ENABLE (no-op) —
-- ré-appliquer est sans effet, et le reset REVOKE ALL + re-grants
-- (style 0055) reconstruit une surface DÉTERMINISTE plutôt que de
-- s'empiler sur des grants résiduels (défauts Supabase, historiques).
--
-- Le web ne change RIEN : les écritures continuent par le service
-- (Drizzle, rôle propriétaire — le RLS ne l'atteint pas), les lectures
-- dashboard aussi. Le mobile passe au direct quand il veut.

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON public.notifications FROM anon;
--> statement-breakpoint
REVOKE ALL ON public.notifications FROM authenticated;
--> statement-breakpoint
-- Select own-row : le Realtime ne délivre que SES lignes, le REST aussi.
-- (Le PATCH exige la lecture de user_id/id : grant table-level SELECT,
-- la policy arbitre QUOI est lisible — jamais le grant.)
GRANT SELECT ON public.notifications TO authenticated;
--> statement-breakpoint
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
--> statement-breakpoint
CREATE POLICY "notifications_select_own"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
--> statement-breakpoint
-- Update own-row : le maker marque SES notifications comme lues. La
-- policy ne change JAMAIS le destinataire (USING sur l'ancienne ligne,
-- WITH CHECK sur la nouvelle — un SET user_id ne pourrait s'appliquer
-- qu'à soi-même ; le grant de colonnes ferme le reste).
DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
--> statement-breakpoint
CREATE POLICY "notifications_update_own"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
--> statement-breakpoint
-- Colonne STRICTEMENT restreinte : read_at seule. Aucune autre colonne
-- (id, user_id, kind, product_id, actor_id, title, body, created_at)
-- n'est accordée en écriture — INSERT/DELETE restent absents du grant.
GRANT UPDATE (read_at) ON public.notifications TO authenticated;
--> statement-breakpoint
COMMENT ON TABLE public.notifications IS
  'Notifications in-app : select own (REST + Realtime) ; update RESTREINT à read_at (pont 0059, le mobile marque lu) ; insert/delete service + triggers seuls.';
