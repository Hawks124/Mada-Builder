ALTER TYPE "public"."admin_action" ADD VALUE 'build_approved' BEFORE 'review_removed';--> statement-breakpoint
ALTER TYPE "public"."admin_action" ADD VALUE 'build_rejected' BEFORE 'review_removed';