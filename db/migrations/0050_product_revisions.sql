-- 0050 : la révision en attente sort de `products`.
--
-- POURQUOI : la révision (le contenu sensible modifié d'une fiche
-- PUBLIÉE) vivait dans les colonnes `products.pending_payload` /
-- `pending_media`. Or le rôle `anon` a un GRANT de niveau TABLE sur
-- `products` (SELECT + INSERT + UPDATE + DELETE) et la policy RLS ne
-- filtre que les LIGNES (`status = 'published'`) → la clé anonyme
-- publique (livrée dans le bundle navigateur et dans l'app mobile)
-- pouvait lire le contenu NON VALIDÉ, et les URLs R2 des médias non
-- validés. Le web ne l'affichait pas, mais « masqué par l'UI » n'est
-- pas « protégé ».
--
-- La révision part donc dans SA PROPRE table, en deny-all : le service
-- (server-side, service_role) la lit et l'écrit, personne d'autre. Le
-- mobile qui lit `products` en direct continue de fonctionner : les
-- colonnes `pending_*` disparaissent de `products` (rien d'y manquait).
--
-- Migration des données : les révisions en cours (pendant_at non nul)
-- sont reprises telles quelles avant de retirer les colonnes.
CREATE TABLE IF NOT EXISTS public.product_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- UNE revision en cours par produit (la nouvelle remplace l'ancienne :
  -- comme les colonnes `pending_*` avant, pas d'historique des refus).
  product_id uuid NOT NULL UNIQUE REFERENCES public.products (id) ON DELETE CASCADE,
  maker_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  -- Champs sensibles modifiés (valeurs nouvelles) : nom, tagline,
  -- description, liens, tags, requirements, commande d'installation.
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Médias proposales (logo + captures) : deja uploades dans R2, pas
  -- encore attaches a la fiche.
  media jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.users (id) ON DELETE SET NULL,
  -- Refus : le motif (ecrit par l'admin).
  rejection_reason text
);

CREATE INDEX IF NOT EXISTS product_revisions_product_idx
  ON public.product_revisions (product_id);
CREATE INDEX IF NOT EXISTS product_revisions_pending_idx
  ON public.product_revisions (created_at DESC)
  WHERE reviewed_at IS NULL;

COMMENT ON TABLE public.product_revisions IS
  'Revision en attente d une fiche publiee (contenu sensible + medias). Deny-all : acces service uniquement.';

-- Reprise des revisions en cours (avant de retirer les colonnes).
INSERT INTO public.product_revisions (product_id, maker_id, payload, media, created_at)
SELECT p.id,
       p.maker_id,
       COALESCE(p.pending_payload, '{}'::jsonb),
       p.pending_media,
       COALESCE(p.pending_at, now())
  FROM public.products p
 WHERE p.pending_at IS NOT NULL;

-- RLS deny-all : seule l'application (service_role) lit cette table.
ALTER TABLE public.product_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.product_revisions FROM anon, authenticated;

-- Retrait des colonnes devenues inutiles (le contenu est desormais dans
-- `product_revisions`).
ALTER TABLE public.products DROP COLUMN IF EXISTS pending_payload;
ALTER TABLE public.products DROP COLUMN IF EXISTS pending_media;
ALTER TABLE public.products DROP COLUMN IF EXISTS pending_at;
ALTER TABLE public.products DROP COLUMN IF EXISTS pending_by;
