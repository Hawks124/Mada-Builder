-- 0058 — Filet de reprise pour la purge RGPD des preuves d'appel.
--
-- Pourquoi : `purgeAppealEvidence` purge les objets Storage
-- `appeals/{uid}/…` au moment où le compte est détruit (promesse légale :
-- « réellement et définitivement effacés »). Une panne transitoire du
-- Storage (list/remove en échec) laissait l'objet en place SANS TRACE
-- récupérable : l'utilisateur a disparu, personne ne relance jamais la
-- purge. La table persiste l'épisode raté — sans FK sur owner_id (le
-- compte est DÉJÀ détruit, la ligne doit survivre à la cascade) — et le
-- cron maintenance hebdo la re-essaie ; une purge aboutie retire la
-- ligne (l'échec précédent était transitoire).
--
-- Volume attendu faible (une ligne = un épisode de suppression raté) :
-- UNIQUE(owner_id) suffit, pas d'historique par tentative (attempts
-- compte les échecs consécutifs, last_error raconte le dernier).
--
-- Table service-side : RLS deny-all, aucune policy, la suppression
-- account-side ne peut JAMAIS l'écrire (pas de FK non plus).
CREATE TABLE IF NOT EXISTS public.gdpr_purge_retries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL UNIQUE,
  -- Échecs consécutifs : incrémenté à chaque reprise ratée (le cron
  -- ré-essaie chaque semaine ; le compteur documente la persistance
  -- du problème, sentry alerte en parallèle).
  attempts integer NOT NULL DEFAULT 0,
  -- Message du dernier échec (contexte humain, jamais de secret).
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS deny-all : seule l'application (service_role) lit cette table.
ALTER TABLE public.gdpr_purge_retries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.gdpr_purge_retries FROM anon, authenticated;

COMMENT ON TABLE public.gdpr_purge_retries IS
  'Filet de reprise RGPD : purges de preuves d appel ratees a la suppression du compte. Deny-all, service seule, la reprise hebdo nettoie.';
