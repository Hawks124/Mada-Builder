# Connecter Lemon Squeezy — revenus vérifiés

> Procédure vérifiée le 2026-10-12 — source : [requêtes API](https://docs.lemonsqueezy.com/api/getting-started/requests), [abonnements](https://docs.lemonsqueezy.com/api/subscriptions/list-all-subscriptions), [prix](https://docs.lemonsqueezy.com/api/prices/the-price-object). Si le dashboard a changé, cherchez « Settings → API » puis l'ID numérique du store.

## Créer la clé

1. **Settings → API** → créez une clé (live pour le réel, test pour essayer — **les clés expirent après 1 an**).
2. Notez l'**ID numérique de la boutique** (dashboard ou API) : il vous sera demandé.
3. Copiez la clé.

## Ce que nous calculons

`GET /v1/subscriptions` (store filtré, paginé) : statut **`active` uniquement** (essais, pauses, impayés, grâces, expirés exclus), hors `test_mode`, prix **standard/package à montant fixe** (usage-based et graduated/volume exclus — montants non déterministes), `setup_fee` exclu (one-shot), mensualisation (annuel ÷ 12…). Abonnés = clients distincts comptés.

## Connecter sur Mada-Made

Fiche (création ou édition) → « Détails techniques & modèle » → activez « Revenus Vérifiés » → **Lemon Squeezy** → collez la clé + l'ID boutique → vérification immédiate → affichage au choix.

## Dépannage

- **Sync en échec après ~1 an** : normal, la clé a expiré — recréez-en une et reconnectez.
- **MRR à 0** : essais seuls, prix usage-based/graduated, ou hors `active` — voir règles ci-dessus.
- **Trop d'abonnements (> 1000)** : contactez-nous, on élargit l'intégration.
