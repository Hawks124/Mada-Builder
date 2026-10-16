# Revenus vérifiés — mode d'emploi (BÊTA)

> Fonctionnalité en bêta : la tuyauterie est réelle, vos retours la durcissent.
> Un problème ? Signalez-le depuis votre dashboard — chaque sync en échec affiche son motif exact.

## Ce que prouve le badge

Le badge « revenus vérifiés » affiche votre MRR **lu directement chez votre fournisseur de facturation**, rafraîchi **toutes les heures**. Jamais auto-déclaré, jamais estimé : si la sync échoue deux fois de suite, le badge passe « en échec » au lieu d'afficher un vieux chiffre.

**Règles de calcul (identiques pour tous)** : essais et impayés exclus, devise native affichée sans conversion, montants invalides refusés (pas de chiffre affiché plutôt qu'un faux chiffre).

## Connecter (2 minutes)

1. Créez la clé chez votre provider en suivant sa fiche (scopes exacts ci-dessus — **rien de plus**).
2. Sur Mada-Made : créez ou éditez votre fiche → « Détails techniques & modèle » → activez « Revenus Vérifiés » → choisissez le provider → collez la clé (+ l'ID projet/boutique si demandé).
3. La clé est **vérifiée immédiatement** (lecture d'essai) puis **chiffrée** : nous ne la ré-affichons jamais, même masquée.

## Affichage : chiffre complet ou badge seul

- **Complet** : MRR, ARR, abonnés, courbe 90 jours, « vérifié il y a N h ».
- **Badge seul** : la vérification sans le chiffre (même confiance, zéro exposition). Recommandé si vous ne voulez pas publier de montants.

## Révoquer

Supprimez la connexion depuis la fiche ou `/dashboard/api` : la sync s'arrête aussitôt, les snapshots déjà publiés restent (transparence de l'historique), la clé chiffrée est purgée. Révoquez aussi côté provider pour couper à la source.

## Questions fréquentes

**La clé peut-elle déclencher un paiement ?** Non : lecture seule imposée côté provider (et pour Stripe, les clés `sk_` sont refusées — seule `rk_` passe).

**Voyez-vous mes clients ?** Non : seuls des agrégats transitent (MRR, devise, nombre d'abonnés). Aucun email, nom, ni détail de transaction.

**Sync en échec ?** Le motif exact s'affiche (clé expirée — Lemon Squeezy expire à 1 an —, permissions manquantes, limite de débit). Corrigez puis reconnectez : l'historique reprend.

**Plusieurs devises ?** Chaque snapshot garde sa devise native, sans conversion. Le classement regroupe par devise.
