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

- [x] migration `db/migrations/0059_notifications_read_at_pont.sql` : policy
      UPDATE own (RLS) + GRANT UPDATE restreint à la SEULE colonne `read_at`
      (aucun GRANT INSERT/DELETE — table notifications en écriture serveur)
- [x] **sécurité bonus** : la policy SELECT own ne vivait que dans
      `db/setup.sql` (reconstruction neuf) — une base n'appliquant QUE les
      migrations restait sans RLS sur `notifications` avec le GRANT SELECT
      de 0055 : toutes les lignes lisibles par tout authenticated (fuite
      inter-makers). 0059 est autoportant (RLS enable + les deux policies)
      et déterministe (REVOKE ALL + re-grants, style 0055)
- [x] journal drizzle : entrée idx 56 (`meta/_journal.json`, tag
      `0059_notifications_read_at_pont`) ; appliquée via `db:migrate:local`
      (journal réinitialisé une fois pour re-poser la version corrigée —
      le premier draft oubliait le re-GRANT SELECT : attrapé par le verify
      avant le commit)
- [x] `db/setup.sql` §3d-quater : miroir 0059 (update_own + UPDATE read_at)
- [x] verify `scripts/verify-0059-notifications-read-at-pont.ts` : 24 checks,
      0 KO réel — état RLS/grants au catalog, isolation SELECT mutuelle,
      marque-lu own = 1 ligne exactement, cross-user = 0 ligne silencieux,
      INSERT/DELETE/title/user_id/created_at → 42501, anon fermé
- [x] docs : `docs/data/notifications.md` (RLS 0059 + usage mobile direct),
      `docs/mobile-ecritures-directes.md` (4e domaine du pont), commentaire
      `db/schema/notifications.ts`
- [x] gates : tsc / eslint / prettier / verify 24-0 / build

## Lot C — réponse aux mobiles (squad)

- [x] texte de réponse livré :
      `mada-made/app/docs/ticket-web-squad-notifications-read-at-reponse.md`
      (untracked côté repo mobile — leur working tree est sale, aucun commit
      là-bas) : pont 0059 activé pour le marque-lu (côté Dart, RIEN à
      changer), fallback `PATCH /api/v1/me/notifications` CONSERVÉ (filet,
      retrait à leur rythme — non bloquant) ; download UNIQUEMENT via
      `GET /api/v1/products/{id|slug}/download` (presign serveur,
      `expiresIn: 300`, sha256 à vérifier après téléchargement) — presign
      côté client REFUSÉ (clés S3/R2 jamais en Dart)
- [x] miroirs docs mobile synchronisés (Lot B appliqué aux copies de
      `app/docs/` : `notifications.md`, `mobile-ecritures-directes.md`)

## Push

- [ ] push unique sur go explicite :
      `git push origin refs/heads/feat/lots-bce-quota8:refs/heads/Feat/lots-bce-quota8`
      (le push par nom court échoue — capitalisation de la branche PR #11 ;
      branche distante confirmée)

## Règles de cette série (leçons consignées)

- verify transactionnel = rollback volontaire final (pattern 0057) — un COMMIT
  via le pooler avec savepoints + `SET LOCAL ROLE` répond « permission denied »
  (42501) sans lien avec les droits réels.
- prettier : `node node_modules/prettier/bin/prettier.cjs` (le wrapper `npx` est
  buggué sur cette machine) — JAMAIS sur les `*.sql`.
- Hors périmètre, travail opérateur en working tree (ne pas commit ni toucher) :
  `components/ui/wordmark.tsx`, `app/(auth)/signin/page.tsx`,
  `components/navbar/navbar-shell.tsx`, `CHANGELOG.md`.
