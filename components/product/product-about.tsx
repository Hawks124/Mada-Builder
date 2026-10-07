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

  const collapsible = hasSubsequentBlocks(markdown);

  return (
    <section
      aria-labelledby="product-about"
      className="flex flex-col gap-5 border-t border-border/40 pt-6"
    >
      <h2 id="product-about" className="text-2xl font-extrabold tracking-tight text-foreground">
        À propos de {name}
      </h2>

      {collapsible ? (
        <div className="group/about">
          <input
            type="checkbox"
            id="product-about-toggle"
            className="peer sr-only"
            aria-label={`Afficher la description complète de ${name}`}
          />

          {/* Repli : on masque tout ce qui suit le premier titre de niveau 2,
              c'est-à-dire tout au-delà de l'accroche. */}
          <div className="[&>h2]:mt-8 [&>h2:first-child]:mt-0 [&>h2~*]:hidden peer-checked:[&>h2~*]:block">
            <Prose className="max-w-none">{markdown}</Prose>
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
              className="hidden h-3.5 w-3.5 group-has-checked/about:block"
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
 * Le markdown contient-il des blocs au-delà de son premier `h2` ?
 *
 * Sans ce test, une description d'un seul paragraphe poserait un interrupteur
 * qui ne changeait rien — un contrôle qui ne commande aucun changement, donc
 * un mensonge de l'interface.
 */
function hasSubsequentBlocks(markdown: string): boolean {
  const blocks = markdown.trim().split(/\n{2,}/);
  const firstHeading = blocks.findIndex((b) => /^#{2,3}\s/.test(b.trim()));
  if (firstHeading < 0) return blocks.length > 1;
  return blocks.slice(firstHeading + 1).some((b) => b.trim() !== "");
}
