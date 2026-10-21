import { Prose } from "@/components/ui/prose";
import { CaretDownIcon, CaretUpIcon } from "@phosphor-icons/react/dist/ssr";

/**
 * Description longue d'une fiche produit — **composant serveur**.
 *
 * Trois défauts corrigés ici, tous visibles sur la page produit :
 *
 * 1. **Le contenu était codé en dur.** Une constante Markdown dans le
 *    composant décrivait un produit fictif quelle que soit la fiche affichée :
 *    toutes les pages produit racontaient la même histoire. La prose vient
 *    maintenant du catalogue, et l'absence de description est un état normal
 *    (`null` → rien) plutôt qu'un texte fantaisiste.
 *
 * 2. **La troncature cassait le markdown.** `split(" ").slice(0, 80)` coupe au
 *    milieu d'un mot, donc au milieu d'un `**gras**` ou d'une puce : selon
 *    l'endroit, on affichait des astérisques littéraux ou une puce orpheline.
 *    Ici on découpe **par blocs** (séparés par une ligne vide) : un bloc est
 *    entièrement gardé ou entièrement laissé de côté, jamais coupé.
 *
 * 3. **Seuls les 80 premiers mots arrivaient au HTML serveur.** Le reste
 *    n'apparaissait qu'après un clic, donc la description longue n'était pas
 *    dans le document indexable — contraire au PRD §1 et §6 (« description
 *    longue (markdown) », pages serveur et indexables).
 *
 * **Le repli est une case à cocher CSS, pas un `<details>`.** `<details>` ne
 * sait replier qu'un bloc entier ; il aurait fallu décider malgré tout où
 * couper, donc rendre deux fois le markdown (aperçu + suite) — donc
 * **dupliquer le texte dans le HTML**, ce qui pèse sur l'indexation. Ici le
 * markdown est rendu **une seule fois, complet** ; c'est une règle CSS
 * (`[&>h2~*]:hidden`) qui masque ce qui suit le premier `h2` tant que la case
 * n'est pas cochée. Le texte complet est donc toujours présent dans le HTML
 * rendu, et le composant n'a besoin d'aucun JavaScript — d'où le passage en
 * composant serveur, qui rend toute la section indexable.
 */
export function ProductAbout({ name, markdown: raw }: { name: string; markdown: string }) {
  const markdown = raw.trim();
  // Pas de description longue : on ne rend rien. Un cadre vide serait pire
  // qu'une absence — le lecteur ne doit pas deviner ce qui manque.
  if (!markdown) return null;

  // Repli sur la LONGUEUR du texte, pas sur la structure du markdown : une
  // description en paragraphes (sans `h2`) n'était jamais repliée — le
  // bouton « Voir plus » s'affichait sans rien masquer (un contrôle qui ne
  // commande aucun changement = un mensonge), et la page PRODUCT devenait
  // interminable : les avis et les commentaires, en dessous, devenaient
  // inatteignables.
  const collapsible = plainLength(markdown) > DESCRIPTION_COLLAPSE_CHARS;

  return (
    <section
      aria-labelledby="product-about"
      className="flex flex-col gap-5 border-t border-border/40 pt-6"
    >
      <h2 id="product-about" className="text-2xl font-extrabold tracking-tight text-foreground">
        À propos de {name}
      </h2>

      {collapsible ? (
        <div className="group/about relative">
          <input
            type="checkbox"
            id="product-about-toggle"
            className="peer sr-only"
            aria-label={`Afficher la description complète de ${name}`}
          />

          {/* Repli à la HAUTEUR (et non au premier `h2`) : la coupe tombe
              au même endroit visuel sur tous les écrans, et tout le
              markdown reste dans le HTML rendu (indexable, sans JS). */}
          <div className="relative max-h-[20rem] overflow-hidden transition-[max-height] duration-300 peer-checked:max-h-none">
            <Prose className="max-w-none">{markdown}</Prose>
            {/* Dégradé de fin de lecture — masqué quand la description est
                déployée (il ne doit jamais couvrir la dernière ligne). */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-background to-transparent transition-opacity peer-checked:opacity-0" />
          </div>

          <label
            htmlFor="product-about-toggle"
            className="mt-1 flex w-fit cursor-pointer items-center gap-1.5 text-[12px] font-black uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground"
          >
            <CaretDownIcon
              weight="bold"
              className="h-3.5 w-3.5 transition-transform duration-200 group-has-checked/about:hidden"
            />
            Voir plus
            <CaretUpIcon
              weight="bold"
              className="hidden h-3.5 w-3.5 transition-transform duration-200 group-has-checked/about:block"
            />
            Voir moins
          </label>
        </div>
      ) : (
        <Prose className="max-w-none">{markdown}</Prose>
      )}
    </section>
  );
}

/**
 * Longueur du texte lisible (hors syntaxe markdown) — le seuil qui
 * décide du repli. 700 caractères ≈ l'accroche + le premier paragraphe :
 * en dessous, la description est lisible d'un trait ; au-dessus, on
 * coupe pour que les avis restent atteignables.
 */
const DESCRIPTION_COLLAPSE_CHARS = 700;

function plainLength(markdown: string): number {
  return markdown
    .replace(/```[\s\S]*?```/g, " ") // blocs de code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // liens (on garde le texte)
    .replace(/[#*`>_\-|~]/g, " ")
    .replace(/\s+/g, " ")
    .trim().length;
}
