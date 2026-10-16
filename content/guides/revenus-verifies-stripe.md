# Connecter Stripe — revenus vérifiés

> Procédure vérifiée le 2026-10-12 — source : [clés restreintes Stripe](https://docs.stripe.com/keys/restricted-api-keys), [référence abonnements](https://docs.stripe.com/api/subscriptions). Si le dashboard a changé, cherchez « Restricted keys » puis les 5 ressources ci-dessous.

## Créer la clé

1. Dashboard Stripe → **Developers → API keys → Create restricted key**.
2. Accordez **Read** (jamais Write) à exactement : **Customers, Subscriptions, Invoices, Prices, Products**. Tout le reste : **None**.
3. Copiez la clé `rk_live_…` (ou `rk_test_…` pour tester).

## Ce que nous lisons

`GET /v1/subscriptions?status=active` paginé : abonnements actifs mensualisés (annuel ÷ 12), essais/trialing, impayés (`past_due`), annulés, plans gratuits et metered exclus, remises en % appliquées. Abonnés = clients distincts avec abonnement actif.

## Connecter sur Mada-Made

Fiche (création ou édition) → « Détails techniques & modèle » → activez « Revenus Vérifiés » → **Stripe** → collez la clé → vérification immédiate → choisissez l'affichage (complet ou badge seul).

## Dépannage

- **« Clé secrète (sk\_) refusée »** : recréez une clé restreinte, les `sk_` ne passent jamais.
- **« Permissions insuffisantes »** : il manque un Read parmi les 5 ressources.
- **MRR à 0** : normal sans abonnement actif facturable (essais seuls = 0, c'est voulu).
