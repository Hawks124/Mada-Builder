-- Téléchargements APK : table d'événements (anonyme, comme
-- product_page_views / product_link_clicks : ni user_id, ni IP, ni
-- user-agent) + colonne dénormalisée sur products.
--
-- Pourquoi les DEUX : la table est la vérité (reconstruction possible par le
-- job, série quotidienne maker) ; la colonne est la lecture à O(1) que le
-- mobile fait sur `products` directement en base, sans passer par une API.
-- Un compteur par produit, pas par version : le chemin de téléchargement sert
-- toujours le dernier build approuvé — les versions d'un binaire sont la même
-- app.
--
-- RLS deny-all (comme ses sœurs) : écritures service seules, lectures Drizzle
-- serveur. Déclaré aussi dans db/setup.sql pour les bases neuves.
-- Idempotent : `IF NOT EXISTS` partout, le bloc peut être rejoué sur une base
-- déjà migrée sans effet.
CREATE TABLE IF NOT EXISTS "product_downloads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "product_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "product_downloads_product_id_products_id_fk"
    FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_downloads_product_created_idx"
  ON "product_downloads" USING btree ("product_id","created_at");
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "download_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "public"."product_downloads" ENABLE ROW LEVEL SECURITY;