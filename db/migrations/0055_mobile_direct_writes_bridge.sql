-- 0055 : pont d'écriture directe — avis, commentaires, votes commentaires.
--
-- Ce que ça change (en trois mots) : la base DEVIENT le point d'application
-- des règles. L'équipe mobile écrit via PostgREST avec sa clé utilisateur
-- (JWT) au lieu de transiter par l'API v1 pour avis et commentaires ; le
-- web continue par le service TS. QUEL que soit l'écrivain, les effets de
-- bord sont désormais posés PAR LA BASE (triggers SECURITY DEFINER) — le
-- service TS n'écrit plus jamais les compteurs ni les notifications
-- (double-compte éliminé par design).
--
--   1. CONTRAINTES : les bornes Zod deviennent des CHECK — note 1–5,
--      corps d'avis 10–2000 (trim), corps de commentaire 1–1000 (trim).
--      La contrainte est arbitre final : impossible définitivement de
--      faire passer un corps de 5000.
--
--   2. POLICIES + GRANTS : identities-only au niveau RLS
--      (user_id = auth.uid()), business au niveau des triggers (messages
--      et motifs lisibles). Les GRANTS sont à colonne explicite : le
--      mobile ne peut ni toucher created_at/maker_response, ni écrire
--      notifications (jamais), ni DELETE une fiche (édit = soft delete
--      via deleted_at, comme le web). La lecture publique (anon) reste
--      inchangée sur avis/commentaires — fiches consultées déconnectées.
--
--   3. TRIGGERS (SECURITY DEFINER, search_path='', EXECUTE revoké à
--      PUBLIC — appelables par triggers seuls) :
--      - compteurs : ratings_sum/ratings_count (deltas, GREATEST au
--        décompte — sémantique exacte de l'ancien TS), comments_count
--        (GREATEST), score des commentaires par RECOMPTE sum(up/down)
--        (sémantique exacte du TS).
--      - notifications : review_received à la CRÉATION seule (jamais à
--        l'édition), comment_received au maker + comment_replied à
--        l'auteur du parent (jamais soi-même, jamais le maker en double),
--        titres pré-rendus FR = chaîne du web (jamais re-déduits : COPIÉS).
--      - garde écrivain (sessions JWT uniquement — auth.uid() présent) :
--        compte existant/banni/supprimé, âge < 1 h refusé, flood 20/60 s
--        (filet global, toutes ops de la table confondues ; le
--        per-op contractuel reste côté web/Upstash) ; produit publié ;
--        avis sur produit curaté refusé ; parent même produit + non
--        supprimé + un seul niveau de réponse.
--        Le chemin service (auth.uid() NULL) ne passe PAS par la garde :
--        ses propres gardes TS existent déjà et les rôles privilégiés
--        (postgres/service_role) restent libres d'agir.

-- ============================================================
-- 1. UUIDv7 côté base (le curseur (created_at, id) des notifications
--    exige l'ordre temporel ; gen_random_uuid() — v4 — serait aléatoire
--    et casserait la pagination ; la table n'a pas de défaut : id
--    fourni client-side, côté web comme côté mobile).
-- ============================================================
CREATE OR REPLACE FUNCTION public.bridge_uuidv7() RETURNS uuid
LANGUAGE plpgsql VOLATILE
SET search_path = ''
AS $$
DECLARE
  ms bigint;
  -- uuid_send : uuid → bytea (le cast direct uuid::bytea n'existe pas).
  rnd bytea := uuid_send(gen_random_uuid());
  b7 int; b9 int;
  v_hex text;
BEGIN
  ms := (extract(epoch FROM clock_timestamp()) * 1000)::bigint;
  b7 := (7 << 4) | (get_byte(rnd, 8) & 15);          -- version 7 + 4 bits aléatoires
  b9 := (get_byte(rnd, 10) & 63) | 128;              -- variant 10xxxxxx
  v_hex :=
    substring(lpad(to_hex(ms), 16, '0'), 5, 12)       -- 6 octets de temps (48 bits)
    || lpad(to_hex(b7), 2, '0')
    || lpad(to_hex(get_byte(rnd, 9)), 2, '0')        -- 12 bits rand haut
    || lpad(to_hex(b9), 2, '0')                      -- variant + bits rand
    || lpad(to_hex(get_byte(rnd, 11)), 2, '0')       -- 7 octets restants : rnd(12..15) + rnd(1..2)
    || lpad(to_hex(get_byte(rnd, 12)), 2, '0')
    || lpad(to_hex(get_byte(rnd, 13)), 2, '0')
    || lpad(to_hex(get_byte(rnd, 14)), 2, '0')
    || lpad(to_hex(get_byte(rnd, 15)), 2, '0')
    || lpad(to_hex(get_byte(rnd, 1)), 2, '0')
    || lpad(to_hex(get_byte(rnd, 2)), 2, '0');
  RETURN substring(v_hex, 1, 8) || '-'                  -- texte canonique 8-4-4-4-12
       || substring(v_hex, 9, 4) || '-'
       || substring(v_hex, 13, 4) || '-'
       || substring(v_hex, 17, 4) || '-'
       || substring(v_hex, 21, 12);
END;
$$;
--> statement-breakpoint
COMMENT ON FUNCTION public.bridge_uuidv7() IS
  'UUIDv7 (48 bits de temps, triable) pour les écritures posées par les triggers du pont 0055.';
--> statement-breakpoint

-- ============================================================
-- 2. Contraintes (arbitre final — les bornes Zod deviennent CHECK)
-- ============================================================
ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_rating_range_check;
--> statement-breakpoint
ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_rating_range_check CHECK (rating >= 1 AND rating <= 5);
--> statement-breakpoint
ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_body_len_check;
--> statement-breakpoint
ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_body_len_check
  CHECK (char_length(btrim(body)) BETWEEN 10 AND 2000);
--> statement-breakpoint
ALTER TABLE public.comments DROP CONSTRAINT IF EXISTS comments_body_len_check;
--> statement-breakpoint
ALTER TABLE public.comments
  ADD CONSTRAINT comments_body_len_check
  CHECK (char_length(btrim(body)) BETWEEN 1 AND 1000);
--> statement-breakpoint

-- ============================================================
-- 3. Policies (identités only ; le business est trigger-side)
-- ============================================================
DROP POLICY IF EXISTS "reviews_insert_own" ON public.reviews;
--> statement-breakpoint
CREATE POLICY "reviews_insert_own"
  ON public.reviews FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());
--> statement-breakpoint
DROP POLICY IF EXISTS "reviews_update_own" ON public.reviews;
--> statement-breakpoint
CREATE POLICY "reviews_update_own"
  ON public.reviews FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
--> statement-breakpoint
DROP POLICY IF EXISTS "comments_insert_own" ON public.comments;
--> statement-breakpoint
CREATE POLICY "comments_insert_own"
  ON public.comments FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());
--> statement-breakpoint
DROP POLICY IF EXISTS "comments_update_own" ON public.comments;
--> statement-breakpoint
CREATE POLICY "comments_update_own"
  ON public.comments FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
--> statement-breakpoint
DROP POLICY IF EXISTS "comment_votes_insert_own" ON public.comment_votes;
--> statement-breakpoint
CREATE POLICY "comment_votes_insert_own"
  ON public.comment_votes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());
--> statement-breakpoint
DROP POLICY IF EXISTS "comment_votes_update_own" ON public.comment_votes;
--> statement-breakpoint
CREATE POLICY "comment_votes_update_own"
  ON public.comment_votes FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
--> statement-breakpoint
DROP POLICY IF EXISTS "comment_votes_delete_own" ON public.comment_votes;
--> statement-breakpoint
CREATE POLICY "comment_votes_delete_own"
  ON public.comment_votes FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
--> statement-breakpoint

-- SELECT own-row (l'auteur voit ses propres lignes, même soft-supprimées,
-- même sur une fiche qui n'est plus publiée). REQUIS pour la reprise et
-- pour que le soft-delete passe : PostgreSQL applique AUSSI les policies
-- SELECT comme WITH CHECK sur la NOUVELLE ligne d'un UPDATE — la seule
-- policy SELECT publique (deleted_at IS NULL + fiche publiée) rendrait
-- donc tout UPDATE touchant deleted_at impossible pour l'auteur (la
-- nouvelle ligne deviendrait invisible-publique → refus 42501). Avec la
-- policy own-row, la nouvelle ligne reste visible à son auteur.
DROP POLICY IF EXISTS "reviews_select_own" ON public.reviews;
--> statement-breakpoint
CREATE POLICY "reviews_select_own"
  ON public.reviews FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
--> statement-breakpoint
DROP POLICY IF EXISTS "comments_select_own" ON public.comments;
--> statement-breakpoint
CREATE POLICY "comments_select_own"
  ON public.comments FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
--> statement-breakpoint

-- ============================================================
-- 4. Grants par colonne (la surface exacte du contrat mobile)
-- ============================================================
REVOKE ALL ON public.reviews FROM anon;
--> statement-breakpoint
REVOKE ALL ON public.reviews FROM authenticated;
--> statement-breakpoint
-- Lecture publique INCHANGÉE (fiches mobile déconnectées incl.) : la
-- policy SELECT couvre déjà le filtre published ; le grant suit.
GRANT SELECT ON public.reviews TO anon, authenticated;
--> statement-breakpoint
GRANT INSERT (id, user_id, product_id, rating, body) ON public.reviews TO authenticated;
--> statement-breakpoint
GRANT UPDATE (rating, body, deleted_at, updated_at) ON public.reviews TO authenticated;
--> statement-breakpoint
REVOKE ALL ON public.comments FROM anon;
--> statement-breakpoint
REVOKE ALL ON public.comments FROM authenticated;
--> statement-breakpoint
-- Lecture publique inchangée (voir reviews).
GRANT SELECT ON public.comments TO anon, authenticated;
--> statement-breakpoint
GRANT INSERT (id, user_id, product_id, parent_id, body) ON public.comments TO authenticated;
--> statement-breakpoint
GRANT UPDATE (body, deleted_at, updated_at) ON public.comments TO authenticated;
--> statement-breakpoint
REVOKE ALL ON public.comment_votes FROM anon;
--> statement-breakpoint
REVOKE ALL ON public.comment_votes FROM authenticated;
--> statement-breakpoint
GRANT SELECT ON public.comment_votes TO authenticated;
--> statement-breakpoint
GRANT INSERT (id, user_id, comment_id, value) ON public.comment_votes TO authenticated;
--> statement-breakpoint
GRANT UPDATE (value) ON public.comment_votes TO authenticated;
--> statement-breakpoint
GRANT DELETE ON public.comment_votes TO authenticated;
--> statement-breakpoint
REVOKE ALL ON public.notifications FROM anon;
--> statement-breakpoint
REVOKE ALL ON public.notifications FROM authenticated;
--> statement-breakpoint
GRANT SELECT ON public.notifications TO authenticated;
--> statement-breakpoint

-- Produits : JAMAIS dans la surface mobile du pont (écritures par le
-- service web seulement). Les grants par défaut Supabase (ALL) laissaient
-- INSERT/UPDATE/DELETE/TRUNCATE accordés à anon/authenticated — contenus
-- par le RLS mais silencieux (UPDATE → 0 ligne, sans erreur). Fermeture
-- nette : lecture publique inchangée, écriture refusée à l'API.
REVOKE ALL ON public.products FROM anon;
--> statement-breakpoint
REVOKE ALL ON public.products FROM authenticated;
--> statement-breakpoint
GRANT SELECT ON public.products TO anon, authenticated;
--> statement-breakpoint

-- ============================================================
-- 5. Fonctions + triggers du pont
-- ============================================================

-- 5a. Garde écrivain (sessions JWT — sessions service sautent la garde).
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
      IF EXISTS (
        SELECT 1 FROM public.comments c
        WHERE c.id = NEW.parent_id
          AND (c.deleted_at IS NOT NULL OR c.product_id <> NEW.product_id)
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
  'Garde 0055 : identité (JWT seulement), ban/suppression, âge 1 h, flood 20/60 s, avis/commentaires hors règles.';

DROP TRIGGER IF EXISTS bridge_reviews_guard ON public.reviews;
--> statement-breakpoint
CREATE TRIGGER bridge_reviews_guard
  BEFORE INSERT OR UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.bridge_writer_guard();
--> statement-breakpoint
DROP TRIGGER IF EXISTS bridge_comments_guard ON public.comments;
--> statement-breakpoint
CREATE TRIGGER bridge_comments_guard
  BEFORE INSERT OR UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.bridge_writer_guard();
--> statement-breakpoint
DROP TRIGGER IF EXISTS bridge_comment_votes_guard ON public.comment_votes;
--> statement-breakpoint
CREATE TRIGGER bridge_comment_votes_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.comment_votes
  FOR EACH ROW EXECUTE FUNCTION public.bridge_writer_guard();
--> statement-breakpoint

-- 5b. Compteurs avis (deltas exacts, GREATEST au décompte = TS d'avant).
CREATE OR REPLACE FUNCTION public.bridge_reviews_write() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_old_sum int := 0;
  v_old_count int := 0;
  v_new_sum int := 0;
  v_new_count int := 0;
  v_product uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_new_sum   := CASE WHEN NEW.deleted_at IS NULL THEN NEW.rating ELSE 0 END;
    v_new_count := CASE WHEN NEW.deleted_at IS NULL THEN 1 ELSE 0 END;
    v_product   := NEW.product_id;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old_sum   := CASE WHEN OLD.deleted_at IS NULL THEN OLD.rating ELSE 0 END;
    v_old_count := CASE WHEN OLD.deleted_at IS NULL THEN 1 ELSE 0 END;
    v_new_sum   := CASE WHEN NEW.deleted_at IS NULL THEN NEW.rating ELSE 0 END;
    v_new_count := CASE WHEN NEW.deleted_at IS NULL THEN 1 ELSE 0 END;
    v_product   := NEW.product_id;
  ELSE
    v_old_sum   := CASE WHEN OLD.deleted_at IS NULL THEN OLD.rating ELSE 0 END;
    v_old_count := CASE WHEN OLD.deleted_at IS NULL THEN 1 ELSE 0 END;
    v_product   := OLD.product_id;
  END IF;

  IF (TG_OP = 'DELETE') OR (v_new_sum <> v_old_sum) OR (v_new_count <> v_old_count) THEN
    UPDATE public.products
    SET ratings_sum   = ratings_sum + (v_new_sum - v_old_sum),
        ratings_count = GREATEST(ratings_count + (v_new_count - v_old_count), 0)
    WHERE id = v_product;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;
--> statement-breakpoint
COMMENT ON FUNCTION public.bridge_reviews_write() IS
  'Avis 0055 : ratings_sum/ratings_count par delta (INSERT/UPDATE/DELETE), jamais de recalcul depuis zéro.';
--> statement-breakpoint
DROP TRIGGER IF EXISTS bridge_reviews_write ON public.reviews;
--> statement-breakpoint
CREATE TRIGGER bridge_reviews_write
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.bridge_reviews_write();
--> statement-breakpoint

-- 5c. Notifs avis (review_received à la CRÉATION seule)
CREATE OR REPLACE FUNCTION public.bridge_reviews_notify() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_active boolean;
  v_maker uuid;
  v_name text;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW; -- suppression soft : rien
  END IF;

  SELECT (p.deleted_at IS NULL AND p.status = 'published'), p.maker_id, p.name
    INTO v_active, v_maker, v_name
  FROM public.products p
  WHERE p.id = NEW.product_id;
  IF v_active IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  IF v_maker IS NOT NULL AND v_maker <> NEW.user_id THEN
    INSERT INTO public.notifications (id, user_id, kind, product_id, actor_id, title)
    VALUES (
      public.bridge_uuidv7(),
      v_maker,
      'review_received',
      NEW.product_id,
      NEW.user_id,
      'Nouvel avis sur ' || v_name || ' (' || NEW.rating || '/5)'
    );
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
COMMENT ON FUNCTION public.bridge_reviews_notify() IS
  'Avis 0055 : notification maker à la création (jamais l''édition, jamais soi-même).';
--> statement-breakpoint
DROP TRIGGER IF EXISTS bridge_reviews_notify ON public.reviews;
--> statement-breakpoint
CREATE TRIGGER bridge_reviews_notify
  AFTER INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.bridge_reviews_notify();
--> statement-breakpoint

-- 5d. Compteurs commentaires
CREATE OR REPLACE FUNCTION public.bridge_comments_write() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_product uuid;
  v_delta int := 0;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_product := NEW.product_id;
    v_delta   := CASE WHEN NEW.deleted_at IS NULL THEN 1 ELSE 0 END;
  ELSIF TG_OP = 'UPDATE' THEN
    v_product := NEW.product_id;
    v_delta   := (CASE WHEN NEW.deleted_at IS NULL THEN 1 ELSE 0 END)
             - (CASE WHEN OLD.deleted_at IS NULL THEN 1 ELSE 0 END);
  ELSE
    v_product := OLD.product_id;
    v_delta   := -(CASE WHEN OLD.deleted_at IS NULL THEN 1 ELSE 0 END);
  END IF;

  IF v_delta <> 0 THEN
    UPDATE public.products
    SET comments_count = GREATEST(comments_count + v_delta, 0)
    WHERE id = v_product;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;
--> statement-breakpoint
COMMENT ON FUNCTION public.bridge_comments_write() IS
  'Commentaires 0055 : comments_count par delta (GREATEST au décompte), sémantique TS exacte.';
--> statement-breakpoint
DROP TRIGGER IF EXISTS bridge_comments_write ON public.comments;
--> statement-breakpoint
CREATE TRIGGER bridge_comments_write
  AFTER INSERT OR UPDATE OR DELETE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.bridge_comments_write();
--> statement-breakpoint

-- 5e. Notifs commentaires (maker + auteur du parent, sans doublons)
CREATE OR REPLACE FUNCTION public.bridge_comments_notify() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_active boolean;
  v_maker uuid;
  v_name text;
  v_parent_user uuid;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT (p.deleted_at IS NULL AND p.status = 'published'), p.maker_id, p.name
    INTO v_active, v_maker, v_name
  FROM public.products p
  WHERE p.id = NEW.product_id;
  IF v_active IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  IF v_maker IS NOT NULL AND v_maker <> NEW.user_id THEN
    INSERT INTO public.notifications (id, user_id, kind, product_id, actor_id, title)
    VALUES (
      public.bridge_uuidv7(),
      v_maker,
      'comment_received',
      NEW.product_id,
      NEW.user_id,
      'Nouveau commentaire sur ' || v_name
    );
  END IF;

  IF NEW.parent_id IS NOT NULL THEN
    SELECT c.user_id INTO v_parent_user
    FROM public.comments c
    WHERE c.id = NEW.parent_id
      AND c.deleted_at IS NULL;
    IF v_parent_user IS NOT NULL
       AND v_parent_user <> NEW.user_id
       AND v_parent_user <> v_maker THEN
      INSERT INTO public.notifications (id, user_id, kind, product_id, actor_id, title)
      VALUES (
        public.bridge_uuidv7(),
        v_parent_user,
        'comment_replied',
        NEW.product_id,
        NEW.user_id,
        'Réponse à votre commentaire sur ' || v_name
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
COMMENT ON FUNCTION public.bridge_comments_notify() IS
  'Commentaires 0055 : maker (comment_received) + parent (comment_replied), jamais soi-même ni doublon.';
--> statement-breakpoint
DROP TRIGGER IF EXISTS bridge_comments_notify ON public.comments;
--> statement-breakpoint
CREATE TRIGGER bridge_comments_notify
  AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.bridge_comments_notify();
--> statement-breakpoint

-- 5f. Score commentaires (RECOMPTE exact — sémantique TS identique).
CREATE OR REPLACE FUNCTION public.bridge_comment_votes_write() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_comment uuid;
BEGIN
  v_comment := COALESCE(NEW.comment_id, OLD.comment_id);
  IF v_comment IS NOT NULL THEN
    UPDATE public.comments c
    SET score = COALESCE((
      SELECT sum(
        CASE WHEN cv.value = 'up' THEN 1
             ELSE -1
        END
      )
      FROM public.comment_votes cv
      WHERE cv.comment_id = v_comment
    ), 0)
    WHERE c.id = v_comment;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
--> statement-breakpoint
COMMENT ON FUNCTION public.bridge_comment_votes_write() IS
  'Votes commentaires 0055 : comments.score par RECOMPTE sum(up/down), jamais d''incrément.';
--> statement-breakpoint
DROP TRIGGER IF EXISTS bridge_comment_votes_write ON public.comment_votes;
--> statement-breakpoint
CREATE TRIGGER bridge_comment_votes_write
  AFTER INSERT OR UPDATE OR DELETE ON public.comment_votes
  FOR EACH ROW EXECUTE FUNCTION public.bridge_comment_votes_write();
--> statement-breakpoint

-- ============================================================
-- 6. Fermeture : EXECUTE interne seul — seuls les triggers appellent ces
--    fonctions (le verify-security, qui scanne les SECURITY DEFINER
--    accessibles depuis anon, reste vert).
--    Quatre grantees, PAS UN SEUL : le REVOKE PUBLIC seul NE SUFFIT PAS —
--    les grants par défaut Supabase (ALTER DEFAULT PRIVILEGES pour le
--    rôle postgres) ajoutent à chaque CREATE un EXECUTE explicite vers
--    anon, authenticated et service_role, qui survit au REVOKE PUBLIC.
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.bridge_uuidv7() FROM PUBLIC, anon, authenticated, service_role;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.bridge_writer_guard() FROM PUBLIC, anon, authenticated, service_role;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.bridge_reviews_write() FROM PUBLIC, anon, authenticated, service_role;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.bridge_reviews_notify() FROM PUBLIC, anon, authenticated, service_role;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.bridge_comments_write() FROM PUBLIC, anon, authenticated, service_role;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.bridge_comments_notify() FROM PUBLIC, anon, authenticated, service_role;
--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.bridge_comment_votes_write() FROM PUBLIC, anon, authenticated, service_role;
--> statement-breakpoint
