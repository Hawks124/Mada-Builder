# ADR-002 — Modération users : ban only, jamais de delete admin

- **Statut :** accepté (2026-09-20)
- **Contexte :** le produit dénonce les bans arbitraires et irréversibles des
  stores (§0 AGENTS.md). L'admin ne doit pas reproduire ce qu'il combat.

## Décision

- **Ban réversible par défaut** : `banned_at` + `ban_reason` obligatoire,
  appels illimités, débannissement en un clic.
- **Aucune suppression user côté admin.** L'arme lourde vit au niveau
  **produit** (delete manuel, confirm + détails) et côté **user lui-même**
  (auto-suppression RGPD réelle, §6F).
- Contenu banni masqué (lecture filtrée), données conservées (audit, recours).

## Conséquences

- Pas de bouton delete dans `users-table.tsx` — ne pas l'ajouter sans rouvrir
  cette ADR.
- `admin_actions` (audit trail) au milestone auth : qui, quoi, quand, motif.
- Bannir ne supprime rien : produits, votes et snapshots restent intacts
  (visibilité gérée par filtrage, pas par destruction).
