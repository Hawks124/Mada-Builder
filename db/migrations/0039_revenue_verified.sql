CREATE TYPE "public"."revenue_display_mode" AS ENUM('full', 'badge_only');--> statement-breakpoint
CREATE TYPE "public"."revenue_provider" AS ENUM('stripe', 'revenuecat', 'paddle', 'polar', 'lemon_squeezy');--> statement-breakpoint
CREATE TYPE "public"."revenue_status" AS ENUM('active', 'failing', 'revoked');--> statement-breakpoint
CREATE TABLE "revenue_connections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"product_id" uuid NOT NULL,
	"provider" "revenue_provider" NOT NULL,
	"encrypted_key" text NOT NULL,
	"key_hint" text,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"display_mode" "revenue_display_mode" DEFAULT 'full' NOT NULL,
	"status" "revenue_status" DEFAULT 'active' NOT NULL,
	"last_error" text,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "revenue_connections_product_id_unique" UNIQUE("product_id")
);
--> statement-breakpoint
CREATE TABLE "revenue_snapshots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"product_id" uuid NOT NULL,
	"mrr_cents" integer NOT NULL,
	"currency" text NOT NULL,
	"subscriber_count" integer DEFAULT 0 NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"captured_hour" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "revenue_connections" ADD CONSTRAINT "revenue_connections_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revenue_snapshots" ADD CONSTRAINT "revenue_snapshots_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "revenue_connections_status_idx" ON "revenue_connections" USING btree ("status");--> statement-breakpoint
CREATE INDEX "revenue_snapshots_product_captured_idx" ON "revenue_snapshots" USING btree ("product_id","captured_at");--> statement-breakpoint
CREATE UNIQUE INDEX "revenue_snapshots_product_hour_uidx" ON "revenue_snapshots" USING btree ("product_id","captured_hour");
