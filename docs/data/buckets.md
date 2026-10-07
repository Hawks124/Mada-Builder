# Stockage : buckets

Trois stockages, trois règles. Les BYTES ne sont jamais en DB (URLs
uniquement).

## Supabase Storage — `avatars` (public)

Avatars makers : WebP 512 (sharp), 128 px min, 10 Mo max entrée,
2 Mo max sortie. Upload via `POST /me/avatar` (le pipeline vit
côté serveur — magic-bytes, jamais confiance au client).

| Policy                                      | Effet                            |
| ------------------------------------------- | -------------------------------- |
| `avatars_read_public`                       | Lecture publique (CDN avatar)    |
| `avatars_write_own`                         | Écriture dossier own (`{uid}/…`) |
| `avatars_update_own` / `avatars_delete_own` | Idem                             |

## Supabase Storage — `appeals` (PRIVÉ)

Pièces d'appel (PNG/JPG/WebP/PDF ≤ 10 Mo ×0–3) : chemins `text[]` en DB
(`evidence_paths`), **jamais d'URLs signées persistées** (expirent) —
signées 72 h à la volée côté admin. Dépôt via `POST /appeals`.

## Cloudflare R2 (S3-compatible, pas de RLS)

Logos (`product-logos`) + captures (`product-shots`) : clés serveur
OBLIGATOIRES (R2 n'a pas de RLS — jamais en dur dans l'app).

- Lecture : URLs publiques stables, racine par bucket
  (`{R2_PUBLIC_LOGOS_BASE|R2_PUBLIC_SHOTS_BASE}/{key}`),
  `Cache-Control: public, max-age=31536000, immutable`.
- Écriture : multipart API (garde 413) OU présigné (`POST
/uploads/presign` → PUT direct → clés `staging/{maker}/{uuid}.webp`
  → pipeline au submit, purge staging 24 h).
- Validation serveur systématique : magic-bytes, 400 px min
  (256 logo), orientation du type, WebP sortie, quota 6, ratio 1:3…3:1.

## Usage mobile

- **Lecture** : URLs directes (avatars, R2) comme n'importe quelle image.
- **Écriture avatars** : `POST /me/avatar` (multipart).
- **Écriture médias** : presign recommandé (zéro RAM serveur) ;
  compresser < 2 Mo avant envoi (le serveur plafonne, tronque
  serverless vers ~4,5 Mo).
- **Jamais** de clé R2 côté client, jamais d'upload direct sans presign.
