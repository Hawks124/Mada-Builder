-- Privilèges d'écriture resserrés sur le profil (v1, oct. 2026).
--
-- Constat : la policy `users_update_own` filtre la LIGNE (auth.uid() = id)
-- mais pas les COLONNES. Le rôle `authenticated` avait donc `UPDATE`
-- sur les 22 colonnes de `users` : en écrivant DIRECTEMENT en base
-- (PostgREST, clé anonyme publique + son propre JWT), un maker pouvait
-- contourner toute la validation serveur (occupation hors vocabulaire,
-- bio hors limite, champs non prévus) — le trigger de la migration 0044
-- ne couvre que role / banned_at / email / username / providers.
--
-- Correctif : on retire l'UPDATE global et on ne laisse que les
-- colonnes de profil — celles que l'API v1 valide déjà (Zod) et qui
-- sont legitimate de modifier soi-même. Les colonnes sensibles
-- (role, banned_at, email, username, providers) restent hors de
-- portée en plus du trigger : deux verrous, pas un.
--
-- Le service (service_role / postgres) n'est pas concerné : il
-- contourne RLS et les privilèges (c'est lui qui fait les promotions
-- admin, l'onboarding, la sync du miroir JWT).
REVOKE UPDATE ON public.users FROM authenticated;
GRANT UPDATE (
  display_name,
  bio,
  occupation,
  website_url,
  avatar_url,
  city,
  country,
  social_links,
  time_zone,
  digest_opt_out
) ON public.users TO authenticated;
