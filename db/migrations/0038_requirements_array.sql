-- Config requise : texte brut → pastilles (text[], miroir tags).
-- Backfill honnête : chaque valeur existante est découpée sur les retours
-- ligne (trim, vides exclus) ; NULL → tableau vide. Aucune perte : les
-- valeurs mono-ligne deviennent un item unique, ré-éditable en chips.
-- Garde idempotente : le bloc ne tourne que si la colonne est encore `text`
-- (le USING avec sous-requête corrélée est refusé par Postgres — d'où le
-- swap en 2 temps).
DO $$ BEGIN
  IF (SELECT udt_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'requirements') = 'text' THEN
    ALTER TABLE "products" ADD COLUMN "requirements_new" text[] NOT NULL DEFAULT '{}';
    UPDATE "products" SET "requirements_new" = COALESCE((SELECT array_agg(x) FILTER (WHERE x <> '') FROM (SELECT trim(unnest(string_to_array("requirements", chr(10)))) AS x) s), '{}') WHERE "requirements" IS NOT NULL;
    ALTER TABLE "products" DROP COLUMN "requirements";
    ALTER TABLE "products" RENAME COLUMN "requirements_new" TO "requirements";
  END IF;
END $$;
