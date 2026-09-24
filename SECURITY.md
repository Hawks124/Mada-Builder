# Politique de sécurité — Mada-Made

## Signaler une faille

**Ne jamais ouvrir d'issue publique** pour une faille. Écrire à : **tojorinaud@gmail.com** avec : description, impact estimé, étapes de reproduction, et si possible un correctif. Réponse sous 72 h ouvrées, correctif selon criticité, crédit public si souhaité.

## Périmètre sensible (revue renforcée)

- Clés de facturation (chiffrées au repos, périmètre restreint, jamais loggées ni renvoyées au client).
- RLS Supabase (`db/setup.sql`) : deny-all par défaut, chaque policy est une décision de sécurité.
- Auth : OTP (hachage SHA-256, timing-safe, single-active), sessions (Supabase seule autorité), miroir JWT des rôles.
- Secrets : jamais dans `app/`/`components/`, jamais dans les logs, jamais côté client (la CI échoue sinon — voir CONTRIBUTING).
- Uploads : magic-bytes obligatoires (images, pièces d'appel), SVG/GIF/exécutables refusés.

## Garanties utilisateurs

Agrégats uniquement (jamais de données clients des fournisseurs), suppression RGPD réelle, pas de pixel tiers (analytics Plausible/Umami, pas de bannière cookie).
