-- 0063 : premier vote / avis / commentaire IMMÉDIAT — la garde d'âge
-- « compte < 1 h » est levée. Le shadow-weighting 24 h reste le bouclier.
--
-- Pourquoi : le refus < 1 h (0055) voulait fermer « l'anneau de vote
-- instantané » — créer un compte, voter, passer. Mais le bouclier réel
-- du classement est ailleurs et déjà actif : un vote posé par un compte
-- de moins de 24 h naît à weight = 0 (shadow-weighting, posé à
-- l'écriture — checkVoter côté web, INSERT direct côté pont) et n'est
-- promu 0 → 1 que par le sweep des scores
-- (recompute_product_scores, cron 15 min) quand le compte a franchi
-- 24 h. Un anneau de comptes à la chaîne n'achète donc RIEN pendant
-- ses 24 premières heures : les voix s'affichent, ne pèsent pas. La
-- barre < 1 h, elle, punissait surtout le nouveau venu légitime —
-- inscrit depuis trois minutes, il cliquait « voter » et se faisait
-- refuser : exact le contraire de la boucle communautaire qu'on veut.
-- Redondante et coûteuse : levée.
--
-- Ce qui change EXACTEMENT : le bloc de la garde
-- `now() - created_at < interval '1 hour'` disparaît. La raison
-- machine `account_too_young` n'est plus produite — ni par la base
-- (pont 0055/0061 : avis, commentaires, votes de commentaires) ni par
-- le service web (checkVoter). Le contrat mobile (dialogue anti-triche,
-- docs/mobile-contrats.md §9) perd cette raison au même titre ; les
-- mappers natifs s'épurent au thread squad (rev.3, séquençage : web
-- d'abord, application de la présente, puis mobile).
--
-- Ce qui NE change RIEN : compte banni/supprimé refusé (mêmes
-- messages, mêmes DETAIL), flood 20/60 s (filet global toutes
-- écritures de la table confondues), avis sur produit non publié /
-- curaté refusés, parent de réponse exigé (même produit, non
-- supprimé, un seul niveau — 0061 à l'identique), votes de
-- commentaires sur commentaire visible de fiche publiée. La
-- pondération conforme à 24 h reste LA mesure d'âge vitale ; elle est
-- documentée (conditions, /regles, dialogue natif) comme
-- transparente, affichée et provisoire.
--
-- Idempotent : CREATE OR REPLACE FUNCTION sans changement de
-- signature ; les triggers du pont (0055) sont reconduits tels quels.

CREATE OR REPLACE FUNCTION public.bridge_writer_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_banned timestamptz;
  v_deleted timestamptz;
  v_flood int;
BEGIN
  -- Gare de rôle : sessions service (auth.uid() NULL) passent. Le web
  -- possède déjà ses propres gardes TS (badge, statut) ; une garde
  -- SQL sur la base n'est ni nécessaire ni utile.
  IF auth.uid() IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT u.banned_at, u.deleted_at
    INTO v_banned, v_deleted
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
  'Garde 0055 : identité (JWT seulement), ban/suppression, flood 20/60 s, avis/commentaires hors règles. 0061 : parent de réponse EXIGÉ (parent_not_found inclut « inexistant »). 0063 : âge < 1 h LEVÉ — premier vote/avis/commentaire immédiat, le shadow-weighting 24 h reste le bouclier du classement.';
