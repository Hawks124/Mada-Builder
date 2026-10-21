-- 0048 : révision en attente sur les fiches publiées.
--
-- Pourquoi : la règle « nom ou liens modifiés sur une fiche publiée →
-- re-revue » faisait DISPARAÎTRE la fiche du site public (statut
-- `pending`) jusqu'à l'approbation. C'est la règle des stores : la
-- fiche reste en ligne avec son contenu APPROUVÉ, et la modification
-- attend sagement d'un regard humain.
--
-- Le mécanisme : les champs sensibles (contenu libre : nom, tagline,
-- description, liens, tags, requirements, installCommand) et les MÉDIAS
-- (logo, captures) ne sont plus appliqués immédiatement. Ils sont
-- rangés dans ces colonnes, et l'admin les voit dans sa file avec un
-- diff. À l'approbation : application + purge des anciens médias. Au
-- refus : la modification est jetée, la fiche garde son contenu validé.
--
-- Tant qu'une révision est en attente, le contenu PUBLIC reste celui
-- qui a été validé : les changements ne filent pas.
--
-- `pending_payload` : jsonb des champs sensibles modifiés (texte).
-- `pending_media`   : jsonb des nouveaux médias (logo + captures),
--                     stockés dans R2 mais pas encore attachés à la fiche.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS pending_payload jsonb,
  ADD COLUMN IF NOT EXISTS pending_media jsonb,
  ADD COLUMN IF NOT EXISTS pending_at timestamptz,
  ADD COLUMN IF NOT EXISTS pending_by uuid REFERENCES public.users (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.products.pending_payload IS
  'Révision en attente : champs sensibles modifiés (non appliqués).';
COMMENT ON COLUMN public.products.pending_media IS
  'Révision en attente : nouveaux médias (logo/captures) uploadés R2, non attachés.';
COMMENT ON COLUMN public.products.pending_at IS
  'Date de la révision en attente (NULL = aucune).';

-- Index de la file admin : les révisions en attente, les plus
-- anciennes d'abord (SLA).
CREATE INDEX IF NOT EXISTS products_pending_at_idx
  ON public.products (pending_at)
  WHERE pending_at IS NOT NULL;
