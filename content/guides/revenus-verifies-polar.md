# Connecter Polar — revenus vérifiés

> Procédure vérifiée le 2026-10-12 — source : [aperçu API Polar](https://polar.sh/docs/api-reference/introduction), [métriques](https://polar.sh/docs/api-reference/metrics/get-metrics). Si le dashboard a changé, cherchez « Organization settings → Access tokens ».

## Créer la clé

1. Réglages de votre organisation → créez un **Organization Access Token** (jamais dans du code client).
2. Scopes : **`metrics:read`** (+ **`subscriptions:read`** pour le comptage d'abonnés).
3. Copiez le token `polar_oat_…` (sandbox : `sandbox-api.polar.sh`, tokens séparés).

## Ce que nous lisons

`GET /v1/metrics/` (MRR en centimes) + abonnés actifs (métriques, repli : liste paginée). Essais et impayés exclus.

## Connecter sur Mada-Made

Fiche (création ou édition) → « Détails techniques & modèle » → activez « Revenus Vérifiés » → **Polar** → collez le token → vérification immédiate → affichage au choix.

## Dépannage

- **« Clé refusée »** : token révoqué ou mauvais environnement (sandbox vs live : tokens séparés).
- **« Métrique MRR introuvable »** : scope `metrics:read` manquant sur le token.
