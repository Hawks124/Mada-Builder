---
title: "Politique de confidentialité"
description: "Quelles données la plateforme collecte, sur quelle base légale, où elles vont, combien de temps elles restent — et comment exercer vos droits."
updated: "2026-10-09"
---

<!-- TODO(Jalon 5) : validation par juriste. Reste à confirmer avant mise en production — (a) l'autorité de contrôle malgache est citée de façon volontairement neutre, à nommer si vérifié ; (b) le mécanisme de transfert hors UE (Londres) n'est pas chiffré dans ce document ; (c) l'adresse postale n'est pas publiée, l'email suffit à identifier le responsable ; (d) le périmètre exact des données lues dans les APK et la purge du stockage binaire restent à confirmer. -->

Ce document décrit les traitements effectués par Mada-Made, l'annuaire des produits tech malgaches. Il s'adresse aux visiteurs comme aux makers inscrits. Il est volontairement précis : une politique de confidentialité qui ne dit pas où vont les données, ni pourquoi, ni combien de temps, n'est pas une politique.

L'identité du responsable figure en bas de cette page.

## Ce que nous traitons, et sur quelle base

Chaque traitement a une base légale. Nous ne demandons rien dont le service n'ait besoin, et nous ne conservons aucune donnée pour laquelle le service ne la réclame pas.

{{block:legal-basis}}

Aucune donnée n'est vendue, louée ou échangée avec un tiers à des fins publicitaires. Il n'y a pas de cookie publicitaire et aucun pixel de suivi tiers.

## Mon compte

À l'inscription : votre adresse email, le fournisseur d'authentification choisi (Google, GitHub, GitLab ou lien magique), et votre avatar. Aucun mot de passe n'est stocké — l'authentification est déléguée à votre fournisseur.

Votre compte est nécessaire au vote, à la soumission de produits et à l'affichage de vos revenus vérifiés. Sans lui, la consultation de l'annuaire reste ouverte.

## Mon profil public est public, et c'est voulu

Nom d'affichage, bio, liens, localisation, avatar : tout ce que vous y mettez est **public par conception et indexé par les moteurs de recherche**. Une page de profil Mada-Made est une page web, pas un espace privé.

C'est un choix, pas un oubli. Ne publiez rien que vous ne voudriez pas voir apparaître dans un résultat de recherche : une fois indexé, on ne contrôle plus où l'index le remonte.

## Mes produits, mes votes, mes revenus

Vos descriptions, images, liens, catégories et votes sont conservés pour faire fonctionner l'annuaire et le classement.

L'unicité du vote — un utilisateur, un produit — implique un lien durable entre votre compte et vos votes. C'est la seule raison pour laquelle un vote est rattaché à un compte identifiable.

**Les revenus vérifiés ne sont que des agrégats.** Nous lisons un chiffre mensuel récurrent et un nombre d'abonnés auprès de votre prestataire de facturation. Nous ne recevons jamais l'identité de vos clients, ni le détail de vos transactions, ni le montant unitaire de vos ventes.

## Mes binaires Android (APK)

Si vous envoyez un APK, voilà exactement ce qu'on en fait — rien de plus.

**Ce qu'on lit.** Au moment de l'envoi, votre navigateur extrait : le manifest (nom de package, versions, permissions, SDK minimum), le certificat de signature (empreinte SHA-256, émetteur) et l'icône. C'est tout. On ne lit ni votre code, ni vos assets, ni quoi que ce soit d'autre dans le fichier.

**Ce qu'on stocke.** Le binaire et ces métadonnées, dans un stockage privé. Seuls les builds **approuvés** sont téléchargeables, via des liens temporaires de 5 minutes — jamais d'adresse permanente, jamais d'accès direct. L'historique des versions est conservé : c'est la traçabilité qui prouve qu'une mise à jour vient bien de vous, empreinte comparée à chaque envoi.

**Ce qu'on ne fait jamais.** Revendre, analyser au-delà du manifest et du certificat, ou transmettre votre binaire à un tiers. Votre APK reste votre propriété, comme votre fiche.

**Suppression.** Binaire et métadonnées partent avec la fiche et avec le compte, réellement effacés de la base. Les copies sur le stockage suivent la purge automatique, avec un court délai technique.

## Mes clés de facturation

Si vous reliez une clé **en lecture seule** (Stripe, RevenueCat, Paddle, Polar ou Lemon Squeezy — [mode d'emploi](/guides/revenus-verifies)), elle est **chiffrée au repos** (AES-256) dès sa réception, **jamais ré-affichée** après votre saisie — pas même masquée —, et **jamais écrite dans les journaux**. Elle ne peut déclencher ni paiement, ni remboursement, ni transfert. Pour Stripe, seules les clés restreintes (`rk_`) sont acceptées : les clés secrètes (`sk_`) sont refusées avant tout stockage.

**Ce qu'on lit.** Toutes les heures, un seul chiffre par connexion : le MRR actif, sa devise et le nombre d'abonnés. Essais, impayés et résiliations exclus. **Ce qu'on ne lit jamais** : vos clients (ni noms, ni emails), vos transactions une par une, vos moyens de paiement.

Vous pouvez la révoquer à tout moment, depuis votre tableau de bord ou auprès de votre prestataire. La révocation purge la clé de notre côté ; les agrégats déjà publiés restent (transparence de l'historique).

## Qui traite mes données, et où

Nous n'hébergeons pas nous-mêmes. Les services ci-dessous sont les **sous-traitants** de la plateforme, avec leur rôle et leur localisation.

{{block:subprocessors}}

### Transferts hors de Madagascar

**C'est le point le plus important de cette politique, et nous ne le cachons pas.** Les données de compte et les contenus sont hébergés **en Europe (Londres)**, et certaines sous-traitances sont **aux États-Unis**. Vos données quittent donc Madagascar.

Ce transfert est nécessaire au fonctionnement du service : la plateforme est hébergée par des fournisseurs commerciaux, pas sur une infrastructure locale. Nous n'avons pas la main sur leur localisation.

Si vous résidez dans l'Union européenne, ces transferts sont encadrés par le droit européen. Si vous avez une question sur ce point, c'est le bon moment pour la poser.

## Sécurité

Chiffrement en transit pour l'ensemble des échanges, et au repos pour les secrets. Périmètres d'accès restreints, moindre privilège côté administration, secrets jamais renvoyés au client.

En cas de violation de données vous concernant, nous vous prévenons directement, en décrivant ce qui a été exposé et ce que nous faisons pour contenir.

## Combien de temps

{{block:retention}}

## Mes droits

- **Accéder** à vos données, depuis votre tableau de bord.
- **Les exporter** en archive, depuis les paramètres de votre compte.
- **Les rectifier** — chaque champ que vous avez rempli est modifiable.
- **Supprimer votre compte**, à tout moment et sans justification. Profil, produits, votes, binaires et connexions sont **réellement et définitivement effacés**. Seules les sauvegardes techniques subsistent le temps de leur rotation, puis sont purgées. Les statistiques publiques et anonymisées ne sont pas des données personnelles et survivent.
- **Vous opposer** à un traitement fondé sur l'intérêt légitime, dont la mesure d'audience.

Ces droits sont les vôtres, pas une faveur. Aucune demande n'est soumise à un délai caché.

## Réclamation

Si vous estimez qu'une réponse ne vous satisfait pas, vous pouvez saisir **l'autorité de contrôle compétente**. Nous ne pouvons pas nous y soustraire et ne le ferons pas : c'est votre droit le plus direct.

Nous préférons quand même le mentionner ici plutôt qu'après coup — une politique qui ne rappelle pas ce droit semble en avoir honte.

## Si vous avez moins de 13 ans

Nous ne collectons pas sciemment de données d'enfants en dehors de ce qu'exige le fonctionnement d'un compte. Les produits qui visent les moins de 13 ans doivent fournir une politique de confidentialité claire, comme l'exigent les stores : c'est une obligation de la fiche, pas la nôtre.

## Cookies et mesure d'audience

Aucun cookie publicitaire, aucun traceur tiers. Ce qui est stocké, et pourquoi :

{{block:storage}}

La bannière qui apparaît au premier passage **n'est pas un mécanisme de consentement** : aucun stockage non essentiel n'est déposé, donc rien n'est à accepter ou à refuser. Elle sert à vous informer une fois. Vous pouvez la fermer, et elle ne reviendra pas.

## Les emails que nous envoyons

Des emails **transactionnels** uniquement : lien de connexion, approbation ou rejet d'une soumission ou d'un binaire, alerte de sécurité, puis les changements de conditions. Rien d'autre — jamais de marketing, jamais de revente d'adresses.

Le digest hebdomadaire existe : un récap de vos notifications non lues, chaque lundi, réservé aux membres (aucune liste externe — votre compte est l'abonnement). Il est **désinscriptible en un clic** (profil → notifications), et les rares annonces de la plateforme respectent le même opt-out.

Le formulaire de contact (`/contact`, sans compte requis) transmet nom, email, motif et message à l'équipe, conservés **2 ans** (suivi des échanges, notamment sponsoring et partenariat). Écrivez-nous pour faire rectifier ou effacer votre message avant ce délai.

## Les dons

Les dons à la plateforme passent par des tiers (mobile money, BuyMeACoffee) : leurs propres politiques de confidentialité s'appliquent à vos paiements, et nous n'y avons pas accès.

**Les dons financent la plateforme, pas les builders.** Nous ne versons aucune rémunération individuelle, et un don n'achète ni visibilité, ni classement, ni mise en avant.

Nous n'enregistrons que ce que vous nous transmettez : une référence de paiement, un montant, et un nom si vous autorisez qu'il soit affiché.

## Modifications de cette politique

Cette politique évolue avec le produit. La date de mise à jour figure en haut de cette page, et toute modification substantielle est annoncée **au moins 15 jours avant son entrée en vigueur** : notification in-app + email direct à tous les membres (préavis contractuel — il part même si vous avez coupé le récap hebdo).

En attendant, le moyen le plus sûr d'être informé des changements est de nous écrire : nous vous répondons directement, sans liste de diffusion ni intermédiaire.
