## Description

<!-- Que change cette PR, et pourquoi. Une PR = un sujet. Issue liée : #… -->

## Type

- [ ] `feat` (fonctionnalité dans le périmètre V1)
- [ ] `fix` (correction)
- [ ] `docs` / `chore` (docs, scripts, config)

## Comment tester (obligatoire — le reviewer ne devine pas)

<!-- Étapes exactes, compte/rôle nécessaire, données de test. Ex :
1. Se connecter en admin (compte : …)
2. Aller sur /admin/users?status=banned
3. Déplier l'historique de … → constater … -->

1.
2.
3.

## Checklist

- [ ] `npx tsc --noEmit` propre
- [ ] `npx eslint` silencieux (fichiers touchés)
- [ ] `scripts/verify-*.ts` concernés verts
- [ ] FR vérifié (aucun anglais en UI), thèmes clair/sombre, 375 px
- [ ] Pas de SQL ni de secret dans `app/`/`components/`, pas de PII en log
- [ ] `CHANGELOG.md` mis à jour si comportement visible
- [ ] Scope : rien hors périmètre V1 (ou justification explicite)

## Captures

<!-- Avant/après pour tout changement visible (clair + sombre si pertinent). Données réelles floutées. -->

## Risques / rollback

<!-- Qu'est-ce qui peut casser (migration ? RLS ? emails ?) et comment on revient en arrière. "Aucun" n'est une réponse valide si vraie. -->
