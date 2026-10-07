# Auth (Supabase)

Le Next.js est le seul backend (toutes les clés y vivent). Flutter est
un client mince : session native Supabase + HTTP vers `/api/v1/*`.
**Un seul projet Supabase** pour web + mobile (mêmes users, mêmes RLS).

## Fournisseurs

- **Google / GitHub** : via `supabase_flutter` (OAuth natif, même projet
  que le web). Le trigger crée la ligne `public.users` (voir ci-dessous).
- **Email OTP custom** (pas le magiclink Supabase) : code 6 chiffres
  Resend (template FR), TTL 10 min, 5 tentatives (burn), un seul code
  actif, throttle 60 s/email, anti-énumération (réponses identiques).
  - Web : cookies (échange server-side, jamais de trip navigateur).
  - Mobile : `POST /api/v1/auth/otp/request` `{email}` →
    `POST /api/v1/auth/otp/verify` `{email, code}` →
    `{access_token, refresh_token, expires_in, user}` → stocker via
    `supabase.auth.setSession()`. Erreurs TOUJOURS génériques
    (« Code incorrect ou expiré. »). Détail : contrats §OTP.

## Trigger `handle_new_user`

À chaque `auth.users` : crée la ligne `public.users` (username dérivé

- file d'attente si pris, display, avatar, providers). La ligne peut
  accuser un retard (race) : les lectures tolèrent l'absence, les
  écritures exigent la ligne (401 propre, pas de crash).

## JWT & sessions

- Access token HS256, audience `authenticated`, TTL court Supabase ;
  refresh via `supabase_flutter` (échec → écran login).
- Vérification serveur : locale (`SUPABASE_JWT_SECRET`, zéro roundtrip)
  - repli distant (`auth.getUser`) si secret absent/incident — jamais
    de refus sur un hoquet infra. Forgé/expiré = 401 direct, sans repli.
- Révocation : le JWT local reste valide jusqu'à `exp` ; la ligne
  `users` tranche (supprimé → 401, banni → 403).
- `auth.uid()` = clé de TOUTES les policies own-row (RLS + Realtime).

## Rôles & miroir

- `users.role` (`user`/`moderateur`/`admin`) + miroir JWT
  (`app_metadata.role`, lu par le proxy — zéro requête par hit).
- Grade `admin` inaltérable via UI (SQL only).

## Usage mobile — résumé auth

1. OAuth : `supabase_flutter` (rien de custom).
2. Email : les 2 endpoints OTP + `setSession`.
3. Appels API : `Authorization: Bearer <access_token>`.
4. Refresh auto du package ; 401 persistant → login.
5. Realtime : clé anon, UNIQUEMENT ses lignes (RLS) — voir `notifications.md`.
