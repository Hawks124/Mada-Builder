-- Appel nºX figé au dépôt. En 3 temps (lignes existantes) : ajout
-- nullable → backfill (rang chronologique par user) → NOT NULL + unicité.
ALTER TABLE "appeals" ADD COLUMN "seq" integer;--> statement-breakpoint
UPDATE "appeals" AS a SET "seq" = sub.rn FROM (
  SELECT "id", row_number() OVER (PARTITION BY "user_id" ORDER BY "created_at" ASC) AS rn
  FROM "appeals"
) AS sub WHERE a."id" = sub."id";--> statement-breakpoint
ALTER TABLE "appeals" ALTER COLUMN "seq" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "appeals_user_seq_uniq" ON "appeals" USING btree ("user_id","seq");
