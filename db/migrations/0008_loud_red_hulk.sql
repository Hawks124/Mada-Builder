ALTER TABLE "users" ADD COLUMN "onboarding_completed" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
-- Backfill : lignes saines existantes (vrai email + nom ≥ 2) = déjà embarquées.
UPDATE "users" SET "onboarding_completed" = true WHERE "email" NOT LIKE '%@placeholder.local' AND length(trim("display_name")) >= 2;