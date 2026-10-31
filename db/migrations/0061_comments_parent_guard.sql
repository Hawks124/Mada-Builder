-- 0061 — Commentaires : le parent inexistant est rejeté (CodeRabbit).
--
-- Pourquoi : le contrat (docs/data/comments.md) promet `parent_not_found`
-- dès que le parent manque, mais la garde 0055 ne vérifiait que des
-- états NÉGATIFS du parent (supprimé, autre produit) : deux IF EXISTS
-- à faux quand le parent n'existe pas du tout → la réponse orpheline
-- passait. Il n'y a pas de FK sur comments.parent_id (connection directe
-- PostgREST, codes 23514 délibérément évoqués par la garde, pas par le
-- moteur).
--
-- Le bloc parent est réécrit en positif : le parent DOIT exister, vivre
-- sur le même produit et être visible, sinon `parent_not_found` ; la
-- règle « un seul niveau » est conservée à l'identique
-- (`reply_too_deep`). Aucun code change pour les clients existants :
-- mêmes DETAIL, même message — la seule nouvelle issue est celle que la
-- doc promettait déjà.
--
-- Données : sonde du jour = 0 orpheline, 0 réponse imbriquée, 0
-- cross-produit, 0 réponse à un parent supprimé — le resserrement ne
-- rejette aucune ligne vivante (aucune migration de données requise).

CREATE OR REPLACE FUNCTION public.bridge_writer_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_banned timestamptz;
  v_deleted timestamptz;
  v_created timestamptz;
  v_flood int;
BEGIN
  -- Gare de rôle : sessions service (auth.uid() NULL) passent. Le web
  -- possède déjà ses propres gardes TS (badge, âge, statut) ; une garde
  -- SQL sur la base n'est ni nécessaire ni utile.
  IF auth.uid() IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT u.banned_at, u.deleted_at, u.created_at
    INTO v_banned, v_deleted, v_created
  FROM public.users u
  WHERE u.id = COALESCE(NEW.user_id, OLD.user_id);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Compte introuvable.'
      USING DETAIL = 'reason=account_not_found';
  END IF;
  IF v_deleted IS NOT NULL THEN
    RAISE EXCEPTION 'Compte supprimé.'
      USING DETAIL = 'reason=account_deleted';
  END IF;
  IF v_banned IS NOT NULL THEN
    RAISE EXCEPTION 'Compte suspendu.'
      USING DETAIL = 'reason=account_banned';
  END IF;
  IF now() - v_created < interval '1 hour' THEN
    RAISE EXCEPTION 'Compte trop récent (réessayez dans une heure).'
      USING DETAIL = 'reason=account_too_young';
  END IF;

  -- Flood 20/60 s (miroir approximatif d'Upstash `feedback:*`) : filet
  -- global côté base, toutes écritures de la table confondues — la
  -- fenêtre contractuelle PAR OP reste côté web (Upstash). Ici on arrête
  -- seulement le déluge direct (hors API).
  EXECUTE format(
    'SELECT count(*) FROM %I.%I WHERE user_id = $1 AND created_at > now() - interval ''60 seconds''',
    TG_TABLE_SCHEMA, TG_TABLE_NAME)
  INTO v_flood USING COALESCE(NEW.user_id, OLD.user_id);
  IF v_flood >= 20 THEN
    RAISE EXCEPTION 'Trop de requêtes (réessayez dans une minute).'
      USING DETAIL = 'reason=flood';
  END IF;

  -- Avis : produit publié, non curaté (commentaires autorisés, eux).
  IF TG_TABLE_NAME = 'reviews' AND TG_OP = 'INSERT' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = NEW.product_id
        AND p.status = 'published'
        AND p.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Produit introuvable ou non publié.'
        USING DETAIL = 'reason=product_not_published';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = NEW.product_id AND p.curated = true
    ) THEN
      RAISE EXCEPTION 'Produit en veille : avis désactivés.'
        USING DETAIL = 'reason=curated';
    END IF;
  END IF;

  -- Commentaires : fiche publiée + règles de parent (un seul niveau).
  IF TG_TABLE_NAME = 'comments' AND TG_OP = 'INSERT' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = NEW.product_id
        AND p.status = 'published'
        AND p.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Produit introuvable ou non publié.'
        USING DETAIL = 'reason=product_not_published';
    END IF;
    IF NEW.parent_id IS NOT NULL THEN
      -- Positif : le parent DOIT exister (CodeRabbit) — inexistant,
      -- supprimé ou d'un autre produit, c'est le même refus
      -- `parent_not_found` que le contrat promet.
      IF NOT EXISTS (
        SELECT 1 FROM public.comments c
        WHERE c.id = NEW.parent_id
          AND c.product_id = NEW.product_id
          AND c.deleted_at IS NULL
      ) THEN
        RAISE EXCEPTION 'Commentaire parent introuvable (même produit, non supprimé).'
          USING DETAIL = 'reason=parent_not_found';
      END IF;
      IF EXISTS (
        SELECT 1 FROM public.comments c
        WHERE c.id = NEW.parent_id AND c.parent_id IS NOT NULL
      ) THEN
        RAISE EXCEPTION 'Un seul niveau de réponse.'
          USING DETAIL = 'reason=reply_too_deep';
      END IF;
    END IF;
  END IF;

  -- Votes commentaire : le commentaire cible est visible (non supprimé)
  -- et sa fiche est publiée — sémantique exacte de toggleCommentVote.
  IF TG_TABLE_NAME = 'comment_votes' AND TG_OP = 'INSERT' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.comments c
      JOIN public.products p ON p.id = c.product_id
      WHERE c.id = NEW.comment_id
        AND c.deleted_at IS NULL
        AND p.status = 'published'
        AND p.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Commentaire introuvable ou fiche non publiée.'
        USING DETAIL = 'reason=parent_not_found';
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;
--> statement-breakpoint
COMMENT ON FUNCTION public.bridge_writer_guard() IS
  'Garde 0055 : identité (JWT seulement), ban/suppression, âge 1 h, flood 20/60 s, avis/commentaires hors règles. 0061 : parent de réponse EXIGÉ (parent_not_found inclut « inexistant »).';
