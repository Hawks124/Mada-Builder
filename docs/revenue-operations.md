# Revenus vérifiés — runbook ops (Phase 2 MRR, BÊTA)

> Pour l'opérateur : activer la sync, vérifier qu'elle tourne, gérer les
> secrets et les pannes. Le mode d'emploi maker vit dans `/guides`.

## Activer la sync horaire

1. **Vercel (prod)** : poser `REVENUE_KEY` (32 octets, base64 — générer :
   `openssl rand -base64 32`) et `CRON_SECRET` (chaîne longue aléatoire).
   Redéployer pour prendre en compte.
2. **GitHub (repo → Settings → Secrets → Actions)** : `SITE_URL`
   (origine exacte de la prod, sans slash final) + `CRON_SECRET` (même
   valeur qu'en prod).
3. **Vérifier** : onglet Actions → `revenue-sync` → `Run workflow` →
   réponse `{"synced":N,…}` (premier run à vide : zéros, normal).
   **Lot B** : si le run est TOUT ROUGE (0 réussite, ≥ 1 échec), la
   route répond **503** — le workflow rougit au lieu d'un 200
   trompeur ; les échecs partiels restent 200 avec `failed: N`
   (alertes par produit déjà gérées côté sync).
4. **Contrôle continu** : `/admin` affiche « Sync revenus en échec » dès
   qu'une connexion décroche (motif exact par ligne).
5. **Filet anti-silence (lot B)** : la maintenance hebdo
   (`maintenance-weekly.yml`, samedi 03:43 UTC) fait tourner un
   **dead man switch** — des connexions actives sans AUCUN snapshot
   frais (< 26 h) = sync morte (secret expiré, workflow désactivé…)
   → alerte Sentry, même si aucune autre pièce ne s'en est plainte.

Sans `REVENUE_KEY`, connexions impossibles et sync en échec franche
(fail closed — jamais de clé en clair). Sans `CRON_SECRET`, la route
cron répond 503 (jamais de sync sans garde).

## Rotation de la clé maître

`REVENUE_KEY` perdue ou compromise : générer une nouvelle valeur, la
poser en prod, puis **reconnecter chaque fiche** (les anciennes clés
chiffrées deviennent illisibles → connexions `failing` avec motif
explicite, pas de corruption silencieuse). Il n'y a pas de migration :
une clé = un chiffrement, les makers reconnectent.

## Pannes types

| Symptôme                                | Cause probable                             | Action                                                  |
| --------------------------------------- | ------------------------------------------ | ------------------------------------------------------- |
| `failing` « clé refusée / permissions » | Clé révoquée côté provider, scopes retirés | Le maker reconnecte (guide du provider)                 |
| `failing` « ID projet/boutique requis » | Config manquante                           | Reconnecter avec l'ID                                   |
| `failing` après ~1 an (Lemon Squeezy)   | Clé expirée (politique 1 an)               | Recréer + reconnecter                                   |
| `failing` « limite de débit »           | Pic provider                               | Reprise automatique à l'heure suivante                  |
| Workflow rouge (non-200)                | `SITE_URL`/`CRON_SECRET` désalignés        | Re-saisir les secrets, re-run manuel                    |
| Aucune snapshot fraîche (> 26 h)        | Workflow désactivé / runs silencieux morts | La maintenance hebdo alerte (Sentry) ; vérifier Actions |

## Emails d'alerte

À la 2e failure : notif in-app + email maker (motif + CTA). **Réserve
bêta** : Resend est en test-mode (domaine non vérifié) — les emails
n'atteignent que l'adresse du compte tant que le domaine n'est pas
vérifié (`resend.com/domains`). La notif in-app + `/admin` restent
les canaux fiables.
