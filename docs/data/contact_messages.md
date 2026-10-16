# `contact_messages` — file contact plateforme (Phase 3)

> Demandes des NON-membres possibles : aucun lien `user` (l'email est
> l'identifiant). Rétention 2 ans (traçabilité business — même logique
> que le journal de modération). RLS deny-all : Drizzle serveur seul.

- `id` : UUIDv7.
- `name` : 2–80 signes (validé service).
- `email` : réponse staff — jamais exposé en public.
- `subject` : `contact_subject` (sponsoring | partenariat | presse |
  support | autre).
- `message` : 20–2000 signes, affiché échappé (React échappe — jamais
  de HTML injecté).
- `product_url` : optionnel (https://… validé, sinon rejet).
- `status` : `contact_status` (new → read → replied | archived).
- `created_at`, `updated_at` (`updated_at` = dernière transition).

## Flux

1. `POST /contact` (action `submitContactAction`) ou `POST
/api/v1/contact` → même `submitContact` : honeypot (succès
   silencieux si rempli), rate-limit IP 3/h + email 5/j (Upstash,
   fail-open), insert + email staff best-effort (`contact-notify`).
2. Inbox `/admin/contact` (file par statut, pastille nav = `new`) :
   réponse via client mail (`mailto:` pré-rempli), transitions
   lu/répondu/archivé.
3. Aucun endpoint public de lecture (pas d'oracle, pas d'enumération).

## Règles

- Succès web = « bien reçu, réponse sous 5 jours ouvrés » (jamais de
  ticket bidon, jamais l'id interne).
- Mobile : échec validation = enveloppe d'erreur standard (`ok:false`,
  code `VALIDATION`, 422) — jamais un 200 déguisé.
