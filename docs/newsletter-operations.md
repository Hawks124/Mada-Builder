# Newsletter — runbook ops (Phase 2)

> Pour l'opérateur : activer le digest hebdo, synchroniser l'audience
> one-shot, gérer les secrets. Le contenu maker n'a pas de guide : le
> digest est automatique, les one-shot sont rédigés au dashboard Resend.

## Digest hebdo (automatique, Resend direct)

1. **Rien à créer** : `sendWeeklyDigest` envoie un email par inscrit
   éligible (ni supprimé, ni banni, ni opt-out, email réel) avec ≥1
   notification non lue (7 j). Ne marque rien comme lu.
2. **Scheduler** : workflow `digest-weekly.yml` (lundi 7 h Tana =
   `0 4 * * 1` UTC), mêmes secrets que `revenue-sync` (`SITE_URL`,
   `CRON_SECRET`).
3. **Vérifier** : Actions → `digest-weekly` → `Run workflow` →
   `{"eligible":N,"sent":M,"dryRun":false}`. Premier run à vide possible
   (zéro non-lue = zéro envoi, normal).
4. **Contrôle sec** : `npx tsx scripts/run-jobs.ts digest --dry-run`
   (comptes sans envoyer) ou `POST /api/cron/digest?dryRun=1` (Bearer).

Sans `CRON_SECRET`, la route répond 503. Sans domaine Resend vérifié,
les envois échouent en 422 (test-mode) — attrapés par inscrit, le
digest des autres part quand même.

## Annonces one-shot (manuel, Broadcasts)

1. **Créer l'audience** : dashboard Resend → Audiences → « Mada-Made »
   → copier l'ID.
2. **Poser `RESEND_AUDIENCE_ID`** : `.env.local` (dev) + Vercel
   (prod). Sans elle, `run-jobs audience` refuse franchement.
3. **Synchroniser** : `npx tsx scripts/run-jobs.ts audience --dry-run`
   (contrôle), puis sans flag (écriture). Éligibilité = digest.
   Ajouts manuels dashboard conservés ; retraits = seuls emails connus
   devenus inéligibles.
4. **Envoyer** : dashboard Resend → Broadcasts → nouveau (audience
   « Mada-Made »). FR, lien de désinscription Resend inclus
   (obligatoire — il alimente l'opt-out local, voir ci-dessous).
5. **Webhook** : même endpoint (`/api/webhooks/resend`), y ajouter
   l'événement `contact.updated`. Une désinscription via lien Resend
   passe `digest_opt_out` à vrai (vérifiable en settings) ; la prochaine
   sync retire le contact.

## Préavis légal (changement confidentialité/conditions)

Le jour du changement (pas avant — le préavis de 15 jours court à
l'envoi), depuis un shell avec `.env.local` :

```bash
# Contrôle sec d'abord (comptes sans écrire ni envoyer) :
npx tsx scripts/run-jobs.ts announce --doc confidentialite --summary "Ce qui change, en une phrase." --effective "entre en vigueur le 1er novembre 2026" --dry-run
# Envoi réel (in-app + email à tous les membres actifs, opt-out ignoré) :
npx tsx scripts/run-jobs.ts announce --doc confidentialite --summary "Ce qui change, en une phrase." --effective "entre en vigueur le 1er novembre 2026"
```

`--doc confidentialite|conditions`. L'email dit lui-même pourquoi il
part malgré l'opt-out (préavis contractuel).

## Pannes types

| Symptôme                               | Cause probable                         | Action                                     |
| -------------------------------------- | -------------------------------------- | ------------------------------------------ |
| Digest `{"eligible":0,"sent":0}`       | Aucune non-lue (7 j)                   | Normal — vérifier un lundi actif           |
| Envois 422 en masse                    | Domaine non vérifié (test-mode)        | Vérifier le domaine (`resend.com/domains`) |
| `audience` refuse (pas d'ID)           | `RESEND_AUDIENCE_ID` absente           | Étapes 1–2 ci-dessus                       |
| Désinscrit Resend toujours synchronisé | Webhook `contact.updated` non souscrit | L'ajouter, ou attendre la sync             |
| Contact supprimé qui réapparaît        | Normal : toujours éligible en local    | Le retirer = opt-out local d'abord         |
