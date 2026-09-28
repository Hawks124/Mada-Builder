/**
 * Descriptions longues des fiches produit (données de mock).
 *
 * Pourquoi un module à part : le catalogue porte la fiche courte (nom,
 * tagline, compteurs), la description longue est de la prose de produit
 * éditoriale. La mélanger au `ProductAbout` l'avait rendue **codée en dur** —
 * donc identique sur toutes les fiches, et fantaisiste. Les données
 * appartiennent à la couche métier, jamais au composant qui les affiche.
 *
 * Clé = id produit. Un produit absent de cette table n'a pas de description
 * longue : c'est l'état normal, pas une erreur, et la fiche affiche alors un
 * état propre au lieu d'un texte vide.
 */
export const CATALOG_DESCRIPTIONS: Record<string, string> = {
  p1: `
Tarsi est une application de finance personnelle **offline-first** conçue pour les utilisateurs qui veulent reprendre le contrôle de leur argent sans friction. Pensée pour la réalité malgache — des connexions internet instables aux habitudes de paiement en cash — Tarsi fonctionne partout, tout le temps.

## Ce qui rend Tarsi unique

Contrairement aux applications bancaires classiques, Tarsi ne requiert aucune connexion bancaire pour fonctionner. Vous entrez vos transactions manuellement ou vous les importez via CSV, et l'application s'occupe du reste : catégorisation intelligente, alertes de budget, et insights visuels en temps réel.

### Fonctionnalités clés

- **Suivi offline complet** — synchronisé dès que vous vous reconnectez
- **Interface Zero-UI** — pas de bruit visuel, juste vos données
- **Budgets intelligents** — alertes à 80 % avant de dépasser
- **Rapports mensuels** — exportables en PDF ou CSV
- **Multi-devises** — support natif de l'ariary (MGA) et du dollar
- **Sécurité locale** — vos données ne quittent jamais votre appareil sans votre accord

## Stack technique

Construit avec **Next.js**, **React Native** et **Supabase** pour une expérience native cross-plateforme. Le moteur de synchronisation est basé sur des CRDT pour garantir la cohérence des données sans conflits.

> "Je voulais une app à la fois belle et honnête avec les données. Tarsi, c'est ma réponse à tout ce que les apps de finance font mal." — *Bryl Lim, créateur*

## Feuille de route publique

La V2 est en cours de développement avec le support des comptes Mobile Money (MVola, Orange Money) et un mode famille pour les dépenses partagées.
`,
};
