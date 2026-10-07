-- 4B : recherche plein texte FR (tsvector) + fallback trigram (fautes de frappe).
-- Colonne GENERATED : zéro backfill, zéro trigger, toujours à jour.
-- `unaccent` volontairement exclu (non IMMUTABLE → interdit en GENERATED).
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('french', coalesce(name, '')), 'A')
    || setweight(to_tsvector('french', coalesce(tagline, '')), 'B')
    || setweight(to_tsvector('french', coalesce(description, '')), 'C')
  ) STORED;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS products_search_vector_idx ON products USING gin (search_vector);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS products_name_trgm_idx ON products USING gin (name gin_trgm_ops);
