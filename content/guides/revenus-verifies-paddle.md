# Connecter Paddle — revenus vérifiés

> Procédure vérifiée le 2026-10-12 — source : [authentification Paddle](https://developer.paddle.com/api-reference/about/authentication), [API metrics 2026](https://developer.paddle.com/changelog/2026/metrics-api). Si le dashboard a changé, cherchez « Developer tools → Authentication » puis la permission `metrics.read`.

## Créer la clé

1. Paddle → **Developer tools → Authentication → New API key** (live pour le réel, sandbox pour tester).
2. Cochez **`metrics.read`** (permission 2026 — les anciennes clés ne l'ont pas : éditez la clé pour l'ajouter).
3. Copiez la clé `pdl_live_…`.

## Ce que nous lisons

`GET /metrics/monthly-recurring-revenue` (dernier point journalier) + `GET /metrics/active-subscribers`. Montants en centimes, devise du compte. Aucun calcul maison.

## Connecter sur Mada-Made

Fiche (création ou édition) → « Détails techniques & modèle » → activez « Revenus Vérifiés » → **Paddle** → collez la clé → vérification immédiate → affichage au choix.

## Dépannage

- **« Métrique illisible / permission manquante »** : ajoutez `metrics.read` à la clé existante (pas besoin d'en recréer une).
- **Clé sandbox** : acceptée — les chiffres seront ceux du bac à sable (connectez la live pour le badge public).
