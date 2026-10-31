# Mada-Made

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/logos/mada-made-dark.svg">
    <img alt="Mada-Made" src="public/logos/mada-made-light.svg" height="220">
  </picture>
</p>

<p align="center">
  <a href="https://github.com/Hawks124/Mada-Builder/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/Hawks124/Mada-Builder/actions/workflows/ci.yml/badge.svg"></a>
  <a href="./LICENSE"><img alt="License MIT" src="https://img.shields.io/github/license/Hawks124/Mada-Builder"></a>
  <a href="https://coderabbit.ai"><img alt="CodeRabbit Pull Request Reviews" src="https://img.shields.io/coderabbit/prs/github/Hawks124/Mada-Builder?utm_source=oss&utm_medium=github&utm_campaign=Hawks124%2FMada-Builder&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews"></a>
  <a href="./CONTRIBUTING.md"><img alt="PRs welcome" src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg"></a>
</p>

**Ce que tu construis ici, on le voit ici.** L'annuaire des produits construits par les développeurs malgaches : publie ton produit, gagne ta place au leaderboard quotidien, et prouve optionnellement tes revenus réels (vérifiés en lecture seule, jamais auto-déclarés).

> Statut : `v1` (pré-déploiement) — fondations, listings, leaderboard, binaires APK, avis & commentaires livrés. Reste : revenus vérifiés (MRR). Voir [CHANGELOG.md](./CHANGELOG.md).

## Stack

<p>
  <img alt="Next.js 16" src="https://img.shields.io/badge/Next.js_16-000000?logo=nextdotjs&logoColor=white">
  <img alt="React 19" src="https://img.shields.io/badge/React_19-61DAFB?logo=react&logoColor=black">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white">
  <img alt="Tailwind v4" src="https://img.shields.io/badge/Tailwind_v4-06B6D4?logo=tailwindcss&logoColor=white">
  <img alt="Zod 4" src="https://img.shields.io/badge/Zod_4-3068B3?logo=zod&logoColor=white">
  <img alt="Postgres (Drizzle)" src="https://img.shields.io/badge/Postgres_%C2%B7_Drizzle-4169E1?logo=postgresql&logoColor=white">
  <img alt="Supabase Auth" src="https://img.shields.io/badge/Supabase_Auth-3FCF8E?logo=supabase&logoColor=black">
  <img alt="Cloudflare R2" src="https://img.shields.io/badge/Cloudflare_R2-F38020?logo=cloudflare&logoColor=black">
  <img alt="Resend" src="https://img.shields.io/badge/Resend-000000?logo=resend&logoColor=white">
  <img alt="Upstash" src="https://img.shields.io/badge/Upstash-00E9A1?logo=upstash&logoColor=black">
  <img alt="Vercel" src="https://img.shields.io/badge/Vercel-000000?logo=vercel&logoColor=white">
  <img alt="Sentry" src="https://img.shields.io/badge/Sentry-362D59?logo=sentry&logoColor=white">
</p>

Jobs : `pg_cron` (SQL — score 15 min, produit du jour, purge brouillons, recomptage téléchargements quotidien) · GitHub Actions (CI — digest hebdo, sync revenus horaire, maintenance hebdo : sweep R2/purges/dead man switch). Déploiement Vercel, opéré avec [`docs/` + `STACK.md`](./STACK.md).

## Démarrage

```bash
npm install
cp .env.example .env.local   # renseigner : Supabase, Resend, Upstash, ADMIN_EMAILS
npm run db:setup             # trigger signup, RLS, buckets (idempotent)
npm run dev
```

| Script                                     | Usage                                                                                                                                                                    |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run db:generate` / `db:migrate:local` | migration Drizzle (générer, appliquer avec `.env.local`)                                                                                                                 |
| `npm run db:setup`                         | `setup.sql` post-migration (64 instructions, rejouable)                                                                                                                  |
| `npm run check`                            | **le point de vérification** : types, lint, format, les 4 non-régressions du web (sécurité, APK, produit du jour, produits) et le build — une commande, une fois par lot |
| `npx tsx scripts/verify-*.ts`              | garde-fous (OTP, toasts, emails, API v1…)                                                                                                                                |
| `npx tsc --noEmit` + `npx eslint`          | vérifs rapides pendant l'édition                                                                                                                                         |

Sans clés Supabase, l'app tourne en mock (voir `docs/auth.md`).

## Carte des docs

- [`docs/README.md`](./docs/README.md) — index de la documentation.
- [`docs/architecture.md`](./docs/architecture.md) — proxy, services, RLS, realtime, jobs.
- [`docs/auth.md`](./docs/auth.md) — référence du protocole d'authentification.
- [`docs/mobile-contrats.md`](./docs/mobile-contrats.md) — contrats de l'API v1 (équipe Flutter).
- [`CHANGELOG.md`](./CHANGELOG.md) — ce qui est livré, version par version.
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — conventions (lire avant toute PR).
- [`SECURITY.md`](./SECURITY.md) — signaler une faille (jamais en issue publique).
- [`DESIGN.md`](./DESIGN.md) — design system & patterns UI (à suivre impérativement).
- [`STACK.md`](./STACK.md) — postes d'infra, coût 0 $/mois possible.
- [`docs/data/`](./docs/data/) — fiches par table (contrat data de référence).

## Contribuer

Projet open source sous licence MIT. Lire [`CONTRIBUTING.md`](./CONTRIBUTING.md) et le [code de conduite](./CODE_OF_CONDUCT.md). La [marque](./TRADEMARK.md) n'est pas couverte par la MIT. Faille de sécurité → [`SECURITY.md`](./SECURITY.md) (jamais en issue publique).

Ce dépôt est référencé dans le [XERJ Corpus Hub](https://github.com/xerj-org/xerj), un index public de solutions réutilisables par les agents de code : les extraits y sont servis sous la licence du dépôt, avec attribution.
