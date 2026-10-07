CREATE TYPE "public"."email_status" AS ENUM('sent', 'failed', 'delivered', 'bounced', 'complained');--> statement-breakpoint
CREATE TABLE "email_logs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"template" text NOT NULL,
	"user_id" uuid,
	"product_id" uuid,
	"recipient_hash" text NOT NULL,
	"resend_id" text,
	"status" "email_status" DEFAULT 'sent' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_logs_created_idx" ON "email_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "email_logs_template_created_idx" ON "email_logs" USING btree ("template","created_at");--> statement-breakpoint
CREATE INDEX "email_logs_resend_idx" ON "email_logs" USING btree ("resend_id");