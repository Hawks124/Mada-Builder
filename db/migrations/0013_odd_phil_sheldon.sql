CREATE TYPE "public"."pricing_model" AS ENUM('free', 'freemium', 'paid', 'subscription', 'one_time_purchase', 'open_source_donationware');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('draft', 'pending', 'published', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."product_type" AS ENUM('app_mobile', 'app_web', 'app_desktop', 'cli', 'package', 'framework', 'api', 'extension', 'os', 'iot', 'bot', 'plugin', 'saas', 'game', 'other');--> statement-breakpoint
CREATE TABLE "product_page_views" (
	"id" uuid PRIMARY KEY NOT NULL,
	"product_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_screenshots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"product_id" uuid NOT NULL,
	"url" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"caption" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"maker_id" uuid NOT NULL,
	"name" text NOT NULL,
	"tagline" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"platforms" text[] DEFAULT '{}' NOT NULL,
	"links" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"product_type" "product_type" DEFAULT 'other' NOT NULL,
	"pricing_model" "pricing_model" DEFAULT 'free' NOT NULL,
	"lifecycle" text DEFAULT 'live' NOT NULL,
	"audience" text DEFAULT 'all' NOT NULL,
	"license" text,
	"has_ads" boolean DEFAULT false NOT NULL,
	"has_in_app_purchase" boolean DEFAULT false NOT NULL,
	"is_child_directed" boolean DEFAULT false NOT NULL,
	"install_command" text,
	"version" text,
	"requirements" text,
	"target_countries" text[] DEFAULT '{}' NOT NULL,
	"languages_supported" text[] DEFAULT '{}' NOT NULL,
	"icon_url" text,
	"status" "product_status" DEFAULT 'draft' NOT NULL,
	"rejection_reason" text,
	"upvote_count" integer DEFAULT 0 NOT NULL,
	"score" real DEFAULT 0 NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "products_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "votes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"weight" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_page_views" ADD CONSTRAINT "product_page_views_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_screenshots" ADD CONSTRAINT "product_screenshots_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_maker_id_users_id_fk" FOREIGN KEY ("maker_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "votes" ADD CONSTRAINT "votes_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_page_views_product_created_idx" ON "product_page_views" USING btree ("product_id","created_at");--> statement-breakpoint
CREATE INDEX "product_screenshots_product_idx" ON "product_screenshots" USING btree ("product_id","position");--> statement-breakpoint
CREATE INDEX "products_maker_idx" ON "products" USING btree ("maker_id");--> statement-breakpoint
CREATE INDEX "products_status_published_idx" ON "products" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("category");--> statement-breakpoint
CREATE INDEX "products_score_idx" ON "products" USING btree ("score");--> statement-breakpoint
CREATE UNIQUE INDEX "votes_user_product_uniq" ON "votes" USING btree ("user_id","product_id");--> statement-breakpoint
CREATE INDEX "votes_product_idx" ON "votes" USING btree ("product_id");