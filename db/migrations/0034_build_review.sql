ALTER TYPE "public"."notification_kind" ADD VALUE 'build_approved' BEFORE 'review_received';--> statement-breakpoint
ALTER TYPE "public"."notification_kind" ADD VALUE 'build_rejected' BEFORE 'review_received';--> statement-breakpoint
ALTER TABLE "product_builds" ADD COLUMN "cert_subject_cn" text;--> statement-breakpoint
ALTER TABLE "product_builds" ADD COLUMN "cert_subject_o" text;--> statement-breakpoint
ALTER TABLE "product_builds" ADD COLUMN "cert_key_alg" text;--> statement-breakpoint
ALTER TABLE "product_builds" ADD COLUMN "cert_key_bits" integer;--> statement-breakpoint
ALTER TABLE "product_builds" ADD COLUMN "cert_sig_alg" text;--> statement-breakpoint
ALTER TABLE "product_builds" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "product_builds" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "product_builds" ADD COLUMN "reviewed_by" uuid;