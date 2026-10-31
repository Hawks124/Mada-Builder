# ADR-003 — Mocks : la contribution sans env ni clés est une feature

- **Statut :** accepté (2026-10-27)
- **Contexte :** projet open source. Exiger une base de données, des clés
  API ou un `.env.local` pour brancher une UI dresserait une barrière
  d'entrée : seuls les mainteneurs configurés pourraient travailler. Le
  produit doit rester contribuable (designer, composants, markup,
  frustrations zéro) par quiconque clone le repo.

## Décision

- Le mode mock (ex. `components/admin/admin-mock.ts`, avatars placeholder
  `i.pravatar.cc`) est **voulu** : il permet aux contributeurs sans
  configuration de construire et tester des écrans.
- Ce ne sont ni des oubliés ni des failles : les audits et revues de code
  ne les signalent plus comme tels.
- Doctrine pour l'avenir : tant qu'un écran reste animable sans secrets,
  un mock est le chemin de contribution par défaut.

## Conséquences

- Les placeholders de mock ne rouvrent jamais d'avis « faille » — sauf si
  un mock fuilit réellement vers la production de façon non voulue (alors
  c'est un bug de wiring à corriger, pas un procès contre la doctrine).
- Qui touche un mock doit savoir que la donnée réelle vient du service;
  remplacer un mock par un service se fait à l'écran, jamais en
  supprimant le chemin mock.
