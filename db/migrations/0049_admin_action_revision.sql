-- 0049 : deux actions d'audit pour les RÉVISIONS de fiche publiée.
--
-- Une révision = la modification du contenu sensible d'une fiche
-- publiée, en attente d'un regard admin. L'audit doit distinguer
-- « appliquée » de « refusée » (comme pour les fiches et les binaires).
ALTER TYPE public.admin_action ADD VALUE IF NOT EXISTS 'revision_approved';
ALTER TYPE public.admin_action ADD VALUE IF NOT EXISTS 'revision_rejected';
