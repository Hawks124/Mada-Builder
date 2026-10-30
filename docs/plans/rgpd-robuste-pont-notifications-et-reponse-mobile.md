# Série — RGPD robuste, pont notifications mobile, réponse aux mobiles

Trois lots validés par l'opérateur (« on y va », 2026-10-30). Un commit par lot,
gates complètes avant chaque commit (`npx tsc --noEmit`, `npx eslint --max-warnings=0`,
prettier, verify réel, `npm run build`), push unique sur go explicite.

Tickets/contexte : `mada-made/app/docs/ticket-web-squad-notifications-read-at.md`
(demande mobile, SQL proposé par la squad mobile).

## Lot A — RGPD robuste (coordination uploads en vol)

- [x] `deleteAccount` (service) : purge storage maison APRÈS release des gardes —
      avatars publics (`purgeAvatarObjects`) + preuves d'appel privées
      (`purgeAppealEvidence`), via `purgeBucketPrefix` paginé (page 100 / lots 100,
      erreurs lues, throw = panne réelle), fail-soft (Sentry, jamais bloquant)
- [x] backlog RGPD systématique : `trackGdprPurge` inséré TOUJOURS (même purge
      réussie — un upload démarré avant peut atterrir après la purge), APRÈS la
      destruction de la ligne user (invariant : jamais de re-purge d'un vivant),
      UPSERT (attempts=0, cause → last_error), panne = incident Sentry
- [x] reprise `runGdprBacklogPass` (une passe sur UN owner, outcome typé) :
      1re passe vide → `attempts = 1` (marque d'observation) ; 2e passe vide →
      ligne retirée (~2 semaines de garde, volume staff-side/privé) ;
      découverte (purge > 0) → compteur relancé + last_error nettoyé ;
      panne → ligne gardée, compteur relancé, last_error porté
- [x] skip-safety : owner encore vivant (`deleted_at` null) → passe refuse la
      purge (double barrière avec l'insertion post-cascade)
- [x] `retryFailedPurges` = sélection des lignes + une passe chacune (retour
      nombre d'objets purgés, 0 = normal : vide/skipped)
- [x] appelants allégés : `app/actions/profile.ts` (deleteMyAccount) et
      `app/api/v1/me` (DELETE) ne gèrent plus que l'auth + les objets R2 produits
      (les blocs d'avatar inline non paginés partent — divergence web/mobile aussi)
- [x] commentaire cron maintenance (étape 6) mis à jour ; `db/schema/gdpr.ts`
      re-documenté (attempts réinterprété SANS migration)
- [x] `scripts/verify-0058-gdpr-purge-retries.ts` étendu : 12 checks, 0 KO en réel
      (SQL transactionnel, trackGdprPurge doublé, skip-safety fixture, cycle
      découverte → marque → retrait avec seed storage réel, cron intégral)
- [x] gates : tsc / eslint / prettier / verify 12-0 / build OK

## Lot B — pont mobile `notifications.read_at` (PostgREST, pattern 0055)

- [ ] migration `db/migrations/0059_notifications_read_at_pont.sql` : policy
      UPDATE own (RLS) + GRANT UPDATE restreint à la SEULE colonne `read_at`s
      (aucun GRANT INSERT/DELETE — table notifications en écriture serveur)
- [ ] journal drizzle : entrée idx 56 (`meta/_journal.json`)
- [ ] verify 0059 réel : UPDATE own OK / UPDATE autrui refusé / UPDATE d'une
      autre colonne refusé / INSERT + DELETE → 42501
- [ ] docs : `docs/notifications.md` + `docs/mobile-ecritures-directes.md`
- [ ] gates + commit

## Lot C — réponse aux mobiles (squad)

- [ ] texte de réponse : marker `read_at` via pont 0059 activé + fallback
      PATCH /api/v1/me/notifications à DÉBRANCHER côté Dart quand le pont est
      déployé ; download toujours via `/api/v1/products/[id]/download`
      (presign serveur, `expiresIn: 300`) — refus du presign côté client
      (clés S3 R2 jamais en Dart)

## Push

- [ ] push unique sur go explicite :
      `git push origin refs/heads/feat/lots-bce-quota8:refs/heads/Feat/lots-bce-quota8`
      (le push par nom court échoue — capitalisation de la branche PR #11)

## Règles de cette série (leçons consignées)

- verify transactionnel = rollback volontaire final (pattern 0057) — un COMMIT
  via le pooler avec savepoints + `SET LOCAL ROLE` répond « permission denied »
  (42501) sans lien avec les droits réels.
- prettier : `node node_modules/prettier/bin/prettier.cjs` (le wrapper `npx` est
  buggué sur cette machine) — JAMAIS sur les `*.sql`.
- Hors périmètre, travail opérateur en working tree (ne pas commit ni toucher) :
  `components/ui/wordmark.tsx`, `app/(auth)/signin/page.tsx`,
  `components/navbar/navbar-shell.tsx`, `CHANGELOG.md`.
