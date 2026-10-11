ALTER TABLE "comments" ADD COLUMN "updated_at" timestamp with time zone;--> statement-breakpoint
UPDATE "comments" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;--> statement-breakpoint
ALTER TABLE "comments" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "comments" ALTER COLUMN "updated_at" SET DEFAULT now();