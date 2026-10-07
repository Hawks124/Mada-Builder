ALTER TYPE "public"."admin_action" ADD VALUE 'product_published';--> statement-breakpoint
ALTER TYPE "public"."admin_action" ADD VALUE 'product_rejected';--> statement-breakpoint
ALTER TYPE "public"."admin_action" ADD VALUE 'product_removed';--> statement-breakpoint
ALTER TABLE "admin_actions" DROP CONSTRAINT "admin_actions_target_id_users_id_fk";
