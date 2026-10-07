# Table `auth_otp`

Codes OTP email custom (Resend) — pont vers Supabase Auth. NOUS générons
le code 6 chiffres (template FR custom, immunisé au prefetch) ;
Supabase RESTE la seule autorité de session (`generateLink`, hash
échangé server-side). Aucun fork d'auth.

## Colonnes

| Colonne       | Type                           | Notes                                                 |
| ------------- | ------------------------------ | ----------------------------------------------------- |
| `id`          | `uuid` PK, UUIDv7              |                                                       |
| `email`       | `text` NOT NULL                | Normalisé lowercase (pas de citext)                   |
| `code_hash`   | `text` NOT NULL                | SHA-256 hex — **code clair JAMAIS persisté ni loggé** |
| `action_link` | `text` NULL                    | Lien Supabase (NULL si email inconnu à la demande)    |
| `token_hash`  | `text` NULL                    | Échangé server-side via `verifyOtp`                   |
| `expires_at`  | `timestamptz` NOT NULL         | TTL 10 min                                            |
| `attempts`    | `integer` NOT NULL DEFAULT `0` | Burn après 5 tentatives                               |
| `used_at`     | `timestamptz` NULL             | Single-use                                            |
| `created_at`  | `timestamptz` NOT NULL         | Throttle 60 s/email (pas de Redis)                    |

Index : `(email, created_at)`.

## RLS (`setup.sql`)

- **Deny-all** : service seul (codes = secrets, même hashés).

## Règles métier miroir (serveur, jamais client)

- Un seul code actif (précédents supprimés) ; delete-on-use ;
  comparaison timing-safe ; throttle silencieux (OK quand même,
  anti-énumération) ; échec transport = ligne supprimée (retry propre).
- Erreurs TOUJOURS génériques côté client (« Code incorrect ou
  expiré. »), quel que soit le vrai motif.

## Realtime

- Non publiée.

## Usage mobile

- **Jamais direct** : `POST /api/v1/auth/otp/request` `{email}` →
  `{ok:true}`, puis `POST /api/v1/auth/otp/verify` `{email, code}` →
  `{access_token, refresh_token, expires_in, user}` → stocker via
  `supabase.auth.setSession()`. Détail : contrats §OTP.
