/**
 * JSON-LD sûr — le `<` est échappé avant l'injection dans la balise.
 *
 * Le POURQUOI : le JSON-LD est injecté via
 * `dangerouslySetInnerHTML={{ __html: JSON.stringify(x) }}` dans une
 * balise `<script type="application/ld+json">`. Or `JSON.stringify`
 * n'échappe PAS `<` : une chaîne contenant `</script>` **ferme la
 * balise script** dans le parseur HTML, et tout ce qui suit est
 * interprété comme du HTML → **XSS stocké**.
 *
 * Le vecteur était réel et sans revue : le `displayName` d'un maker
 * (validé sur la longueur seule, `services/users.service.ts`) et la
 * `bio` (400 caractères) sont injectés dans le `personLd` du profil
 * public — un compte inscrit pouvait donc injecter du script dans une
 * page indexable, et voler la session d'un staff qui la visite.
 *
 * `\u003c` est la séquence JSON de `<` : le JSON reste valide, le
 * parseur HTML ne voit plus de `<`, et le contenu est restitué à
 * l'identique par le lecteur JSON-LD.
 */
export function safeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}
