# ADR-001 — Avatars sur Supabase Storage (pas R2)

- **Statut :** accepté (2026-09-20)
- **Contexte :** les visuels produits vivent sur R2 (forte volumétrie, egress gratuit).
  Faut-il pareil pour les avatars ?

## Décision

Avatars → **bucket Supabase Storage `avatars`**, pas R2.

## Raisons

1. **Données peu mises à jour** : un avatar change rarement — le CDN agressif
   et l'egress zéro de R2 n'apportent rien ici.
2. **RLS native** : policies `own-path` (`avatars/{uid}/…`) directement dans
   Postgres, auditables en SQL, zéro code de garde custom.
3. **Cohérence auth** : même session, mêmes JWT, mêmes policies que le reste
   du domaine users. Pas de second système de credentials (tokens R2).
4. **Pipeline normalisé** : 512px WebP q82 systématique (~30-80 Ko) —
   le stockage reste trivial quel que soit le fournisseur.

## Conséquences

- `lib/supabase/storage.ts` = seule surface Storage avatars.
- Produits/screenshots restent R2 (volumétrie + egress) — les deux systèmes
  coexistent par nature de données, documenté ici pour éviter
  l'"uniformisation" future non réfléchie.
