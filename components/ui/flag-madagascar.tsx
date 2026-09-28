import { cn } from "@/lib/utils";

/**
 * Drapeau malgache — 3 bandes CSS, aucune image.
 *
 * Blanc au mât sur 1/3, puis rouge au-dessus du vert sur les 2/3 restants.
 * Mêmes `red-600` / `green-600` que l'hommage au drapeau du `GridBackground`,
 * donc cohérent avec le reste du site. 24×16px : en dessous de ~20px de haut, il se
 * lit comme un voyant plutôt que comme un drapeau.
 *
 * **La bande est en `bg-white`, pas en `bg-background`.** `bg-background` est un
 * jeton de thème : il valait `#09090b` en mode sombre, donc **la bande blanche
 * du drapeau s'affichait noire** — et en mode clair elle se confondait avec les
 * pastilles `bg-background/70` du site. Le drapeau ne se lisait dans aucun
 * thème. Le blanc d'un drapeau est blanc : ce n'est pas une couleur de thème.
 * Le `ring` inset conserve le bord de la bande sur fond blanc.
 *
 * **Ne pas surcharger la taille par une classe.** Ce composant porte déjà
 * `h-4 w-6`, son propre rapport. Ajouter un `h-*` concurrent produit une
 * chaîne contenant deux utilitaires `height`, dont le gagnant est l'ordre de la
 * feuille générée, pas celui de la chaîne : le drapeau s'est retrouvé en
 * 24×36, donc en portrait, déformé à 90°. Pour l'agrandir, **utiliser une
 * `scale` uniforme** (`scale-150` → 36×24), qui ne peut pas déformer et laisse
 * ce composant maître de son rapport.
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
