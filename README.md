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

> Statut : `v0.1.0` — fondations, identité & modération. Voir [CHANGELOG.md](./CHANGELOG.md) (pas encore un MVP : listings, leaderboard et revenus vérifiés arrivent).

## Stack

Next.js 16 (App Router) + TypeScript · Tailwind v4 · Postgres (Drizzle) · Supabase Auth (Google, GitHub, email OTP) · Resend · Upstash (rate-limit) · Vercel + pg_cron (jobs).

## Démarrage

```bash
npm install
cp .env.example .env.local   # renseigner : Supabase, Resend, Upstash, ADMIN_EMAILS
npm run db:setup             # trigger signup, RLS, buckets (idempotent)
npm run dev
```

| Script                                     | Usage                                                    |
| ------------------------------------------ | -------------------------------------------------------- |
| `npm run db:generate` / `db:migrate:local` | migration Drizzle (générer, appliquer avec `.env.local`) |
| `npm run db:setup`                         | `setup.sql` post-migration (31 instructions, rejouable)  |
| `npx tsx scripts/verify-*.ts`              | garde-fous (OTP, toasts, emails, API v1…)                |
| `npx tsc --noEmit` + `npx eslint`          | vérifs avant chaque lot                                  |

Sans clés Supabase, l'app tourne en mock (voir `docs/auth.md`).

## Carte des docs

- [`docs/README.md`](./docs/README.md) — index de la documentation.
- [`docs/architecture.md`](./docs/architecture.md) — proxy, services, RLS, realtime, jobs.
- [`docs/auth.md`](./docs/auth.md) — référence du protocole d'authentification.
- [`docs/mobile-contrats.md`](./docs/mobile-contrats.md) — contrats de l'API v1 (équipe Flutter).
- [`CHANGELOG.md`](./CHANGELOG.md) — ce qui est livré, version par version.
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — conventions (lire avant toute PR).

## Contribuer

Projet open source sous licence MIT. Lire [`CONTRIBUTING.md`](./CONTRIBUTING.md) et le [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md). Faille de sécurité → [`SECURITY.md`](./SECURITY.md) (jamais en issue publique).
