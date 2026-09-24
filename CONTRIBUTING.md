# Contribuer à Mada-Made

Bienvenue ! Ce guide explique comment proposer des changements. Le projet est en français (UI, docs, messages) ; le code et les identifiants sont en anglais.

## Principes

1. **Scope d'abord.** Le périmètre V1 est figé (`CHANGELOG.md`, section `Non-inclus`) : une fonctionnalité hors scope reste hors scope, même "évidemment utile". En cas de doute, ouvre une issue avant de coder.
2. **Zero UI.** Pas de cartes : typographie + séparateurs. Chaque état vide propose l'action suivante.
3. **Petites PRs.** Une PR = un sujet, description courte. Les gros changements se discutent en issue d'abord.
4. **Serveur seul pour le sensible.** Jamais de SQL ni de secrets dans `app/`/`components/`, jamais de données personnelles dans les logs.
5. **Vérifier, pas affirmer.** Types, lint, garde-fous et build verts avant de demander une review (voir ci-dessous).

## Démarrage (5 minutes)

```bash
npm install
cp .env.example .env.local   # renseigner : Supabase, Resend, Upstash
npm run db:migrate:local     # applique les migrations
npm run db:setup             # trigger + RLS + buckets (idempotent)
npm run dev
```

**Sans clés Supabase** (pas de compte) : l'app tourne en données mock — c'est normal, tu peux travailler sur l'UI. Les lectures/écritures réelles exigent les clés.

## Proposer un changement

1. Fork + branche depuis `main` : `feat/…`, `fix/…`, `docs/…`.
2. Commits courts, en français, à l'impératif : `feat(admin): filtre Appels`, `fix(otp): burn à 5`, `docs(readme): quickstart`.
3. Ouvre une PR avec le template rempli. Checklist :
   - [ ] `npx tsc --noEmit` et `npx eslint` propres
   - [ ] `npx tsx scripts/verify-*.ts` concernés verts
   - [ ] Aucun anglais en UI, thèmes clair/sombre vérifiés, 375 px vérifié
   - [ ] Pas de secret ni de SQL dans `app/`/`components/`
   - [ ] `CHANGELOG.md` mis à jour (section `Non versionné`)
4. Une review est requise avant merge. Pas de push direct sur `main`, pas de force-push.

## Conventions code

- Icônes Phosphor (`dist/ssr` côté serveur), `useSearchParams` sous Suspense, pas de `<a>` dans `<a>`.
- Notifications : `?toast=` après redirect, `toast()` sur place — 120 signes max, texte seul.
- Erreurs métier : codes stables (`ProfileError`), jamais de détail technique exposé à l'utilisateur.
- Migrations via `db:generate` (toujours relire le SQL) + `db:migrate:local`.
- Dépendances : `npm install` complet pour toute modif (jamais `--package-lock-only` seul — lock structurellement cassé détectable uniquement par `npm ci`, cf. incident CI 2026-09). Lock généré sous npm 11 (pinné en CI) : valider par un vrai `npm ci` local, jamais `--dry-run` (saute la validation stricte).
- Emails : `lib/email-templates/`, previews locales via `npm run email:preview`.
- API v1 : enveloppe `{ok, code}`, auth Bearer, couverte par `scripts/verify-api-v1.ts`.

## Ne sera pas mergé

Push direct sur `main` · secrets ou SQL dans `app/`/`components/` · données personnelles en logs · anglais en UI · fonctionnalité hors scope sans discussion préalable · screenshots contenant des données réelles d'utilisateurs.

## Déploiement (pour info, aucune action requise)

Chaque PR reçoit une URL de prévisualisation automatique. La production suit uniquement la branche `main` après merge et review.

## Besoin d'aide ?

Ouvre une issue (`bug` ou `idée`). Faille de sécurité → `SECURITY.md` (jamais en issue publique). Comportement → `CODE_OF_CONDUCT.md`.
