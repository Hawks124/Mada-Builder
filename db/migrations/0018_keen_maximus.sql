CREATE TABLE "featured_products" (
	"id" uuid PRIMARY KEY NOT NULL,
	"product_id" uuid NOT NULL,
	"featured_on" date NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "featured_products_featured_on_unique" UNIQUE("featured_on")
);
--> statement-breakpoint
ALTER TABLE "featured_products" ADD CONSTRAINT "featured_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "featured_products_product_idx" ON "featured_products" USING btree ("product_id");--> statement-breakpoint
ALTER TABLE "featured_products" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- Go-live votes (Phase 3) : les compteurs seed factices retombent à zéro.
-- Données dev-only (slugs seed-*) : aucun effet en prod. Le recount les
-- maintiendra à la valeur réelle dès le premier vote.
UPDATE "products" SET "upvote_count" = 0, "score" = 0 WHERE "slug" LIKE 'seed-%';
