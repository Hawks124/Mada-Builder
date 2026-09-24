ALTER TABLE "page_views" DROP CONSTRAINT "page_views_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "page_views" DROP COLUMN "user_id";