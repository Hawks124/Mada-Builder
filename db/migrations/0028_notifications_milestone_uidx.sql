-- Idempotence milestones : un seuil franchi = une notif, jamais deux
-- (conflit → onConflictDoNothing silencieux). Décisions (revue, modération)
-- EXCLUES : multi-événements légitimes.
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS notifications_milestone_uidx
  ON notifications (user_id, product_id, title)
  WHERE kind IN ('vote_milestone', 'view_milestone');
