# Connecter RevenueCat — revenus vérifiés

> Procédure vérifiée le 2026-10-12 — source : [API v2 RevenueCat](https://www.revenuecat.com/docs/api-v2/overview), [charts & metrics](https://www.revenuecat.com/docs/api-v2/charts-and-metrics). Si le dashboard a changé, cherchez « API keys → New (V2) » puis les permissions charts.

## Créer la clé

1. Réglages projet → **API keys → New**, version **V2** (les clés v1 ne marchent pas sur l'API v2).
2. Cochez **uniquement** : `charts_metrics:charts:read` + `charts_metrics:overview:read`.
3. Notez le **Project ID** (Réglages projet → API Keys) : il vous sera demandé aussi.

## Ce que nous lisons

Métriques officielles `mrr` + abonnés payants (`actives`) du projet — aucun calcul maison, essais et impayés exclus par construction (métriques payants uniquement).

## Connecter sur Mada-Made

Fiche (création ou édition) → « Détails techniques & modèle » → activez « Revenus Vérifiés » → **RevenueCat** → collez la clé + l'ID du projet → vérification immédiate → affichage au choix.

## Dépannage

- **« Métrique MRR introuvable »** : permissions charts manquantes sur la clé, ou mauvais Project ID.
- **« Clé refusée »** : clé v1 utilisée sur l'API v2 — recréez une clé v2.
