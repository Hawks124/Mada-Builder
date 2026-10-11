import { cn } from "@/lib/utils";

/**
 * Drapeau malgache — 3 bandes CSS, aucune image.
 *
 * Blanc au mât sur 1/3, puis rouge au-dessus du vert sur les 2/3 restants.
 * Mêmes `red-600` / `green-600` que l'hommage au drapeau du `GridBackground`,
 * donc cohérent avec le reste du site. 24×16px : en dessous de ~20px de haut, il se
 * lit comme un voyant plutôt que comme un drapeau.
 *
 * **La bande est `bg-white` volontairement.** `bg-background` suit le thème et la
 * rendrait noire en mode sombre. Un drapeau n'a pas de couleur de thème ; le
 * `ring` inset lui garde un bord sur fond blanc.
 *
 * **Ne pas surcharger la taille par un `h-*`/`w-*`.** Ce composant porte son
 * propre `h-4 w-6` ; deux utilitaires de même type dans une même chaîne sont
 * arbitrés par l'ordre de la feuille générée, pas par la chaîne. Pour l'agrandir,
 * appliquer une `scale` uniforme, qui préserve le rapport.
 *
 * **Source unique.** Le drapeau apparaît dans le pied de page et au point
 * focal de l'armillaire de la home ; dupliqué, il divergerait au premier
 * correctif — c'est le même principe que les configs, les liens produit et
 * les marques, tous en source unique.
 *
 * `aria-hidden` : le texte voisin dit déjà « Madagascar ». Un drapeau sans
 * alternative lue « divorce » par un lecteur d'écran, ce qui est pire que rien.
 */
export function FlagMadagascar({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex h-4 w-6 shrink-0 overflow-hidden rounded-[2px] ring-1 ring-inset ring-foreground/20",
        className,
      )}
    >
      <span className="w-1/3 bg-white" />
      <span className="flex w-2/3 flex-col">
        <span className="h-1/2 bg-red-600" />
        <span className="h-1/2 bg-green-600" />
      </span>
    </span>
  );
}
