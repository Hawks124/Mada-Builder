# Documentation — index

> Tout est en français (produit, docs, emails). Le code et les
> identifiants restent en anglais.
>
> Règle : un nouveau `.md` = une ligne ci-dessous, sinon il n'existe
> pas. Le **vivant** pilote le produit ; l'**archive** raconte
> l'histoire (lire, ne pas suivre).

## Vivant

| Doc                                                                  | Pour qui       | Contenu                                                                 |
| -------------------------------------------------------------------- | -------------- | ----------------------------------------------------------------------- |
| [`architecture.md`](./architecture.md)                               | tous           | où vit quoi, RLS, realtime, emails, jobs                                |
| [`auth.md`](./auth.md)                                               | web            | protocole auth : OTP, onboarding, ban/appels, rôles, post-mortems       |
| [`mobile-contrats.md`](./mobile-contrats.md)                         | équipe Flutter | référence API v1 + contrats data                                        |
| [`desktop-client.md`](./desktop-client.md)                           | tous           | client desktop natif : cadrage, dépendances API, déclencheur (non daté) |
| [`revenue-operations.md`](./revenue-operations.md)                   | opérateur      | sync MRR : secrets, rotation clé, pannes                                |
| [`newsletter-operations.md`](./newsletter-operations.md)             | opérateur      | digest, audience, préavis légal : déclencheurs, pannes                  |
| [`featured-produit-du-jour-v1.md`](./featured-produit-du-jour-v1.md) | tous           | produit du jour : rotation, override, seuils                            |
| [`data/`](./data/index.md)                                           | tous           | contrats par table (21 fiches : produits, votes, revenus…)              |
| [`adr/`](./adr/)                                                     | tous           | décisions structurantes (avatars, ban-only…)                            |
| [`../CONTRIBUTING.md`](../CONTRIBUTING.md)                           | contributeurs  | conventions, workflow PR                                                |
| [`../CHANGELOG.md`](../CHANGELOG.md)                                 | tous           | livré par version (+ non-inclus honnête)                                |

## Archive (histoire, pas mode d'emploi)

| Doc                                                                                | Statut                                                               |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| [`plans/products-milestone.md`](./plans/products-milestone.md)                     | jalon produits : coché, gardé pour mémoire                           |
| [`plans/phase-mrr-newsletter-contact.md`](./plans/phase-mrr-newsletter-contact.md) | plan de pilotage : vivant tant que les phases courent, archive après |
| [`reviews/phase1-2.md`](./reviews/phase1-2.md)                                     | revue passée : constats absorbés ou caducs                           |

Produit (vision, périmètre V1) : voir `AGENTS.md` (local, non versionné).
