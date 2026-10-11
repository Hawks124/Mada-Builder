# Produit du jour — « Robuste pour la V1 » : ce que ça veut dire

> Ce n'est pas un euphémisme pour « fragile ».
> Ça veut dire : **robuste sous les hypothèses V1** (peu de produits, 1 locale,
> 1 slot/jour, enjeu = animer la home, pas d'argent dessus).
> Si ces hypothèses changent, l'algo doit évoluer — pas parce qu'il est bugué,
> mais parce que **le problème change**.

Référence code : `services/ranking.service.ts` (`getFeatured` / `computeFeatured`),
miroir SQL : `db/setup.sql` (`rotate_featured_daily`), cron `featured-daily` 5h UTC.

## Paliers actuels (V1)

1. **Top** (catalogue ≥ 5) : #1 d'hier en votes pondérés, non-featuré depuis 30 j.
2. **Rotation** (< 5 produits, ou hier sans publication) : jamais-featuré d'abord,
   re-feature ≥ 7 j.
3. **Latest** (1 seul produit) → le seul.
4. **Vide honnête** (0 produit) → `null` + EmptyState « soyez le premier ».
5. **Override admin** (`pinned`) respecté par le job et le calcul paresseux.
6. Gardes : que du `published` non-supprimé, **curated exclu**, RLS deny-all.

## Hypothèses → seuils d'optimisation

| Hypothèse V1                    | Pourquoi ça tient                                                                    | Signal : optimiser quand…                                                                                                        | Évolution prévue (pas maintenant)                                                               |
| ------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Petit catalogue (2–50 produits) | Rotation/latest → la home bouge tous les jours                                       | Catalogue **≥ ~200** : la rotation « jamais-featuré d'abord » mettrait en une des produits faibles                               | Pondérer la rotation par score/votes, ou shortlist d'éligibilité (seuil votes)                  |
| Enjeu = vanity, pas d'argent    | Gaming limité aux anneaux de comptes âgés ; rate-limits + shadow-weighting suffisent | **Dès MRR/Pro/sponsors** : le slot vaut de l'argent → risque fermes/achat de votes ; ou vélocité de votes anormale dans les logs | Détection d'anomalies (vélocité, graphe de votes), quorum anti-ressassement, audit trail public |
| 1 pays, 1 fuseau toléré         | Bascule minuit UTC (= 3h à Tana) documentée, acceptable                              | Exigence « jour malgache » ou audience multi-pays                                                                                | Fenêtre Tana (UTC+3) pour featured + today                                                      |
| 1 slot/jour, override manuel    | `pinned` + idempotence + calcul paresseux couvrant la panne cron                     | Les makers demandent « pourquoi lui ? » / historique                                                                             | Page archive des featured passés + affichage du palier (top/rotation)                           |
| Double moteur SQL+TS en parité  | Vérifié ligne à ligne (oct. 2026)                                                    | **Chaque retouche des paliers**                                                                                                  | Test de parité auto (même scénario sur les deux chemins) — fait avant MRR                       |

## Règle d'or

Tant que les signaux ci-dessus ne sont pas atteints : **ne pas toucher à l'algo**.
Le jour où un seuil est franchi, relire cette note avant de coder.
