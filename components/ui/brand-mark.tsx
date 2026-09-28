import { Browser, Code, Plugs, PuzzlePiece, WindowsLogo } from "@phosphor-icons/react/dist/ssr";
import { BRAND_PATHS, PHOSPHOR_MARKS } from "@/lib/brand-paths";

/**
 * Marque en SVG — **serveur**, zéro JS client, zéro requête réseau.
 *
 * Les paths sont figés dans `lib/brand-paths.ts` (Simple Icons 16.32.0, CC0,
 * générés par `scripts/gen-brand-paths.mjs`). Aucune dépendance npm, aucun
 * `<Image>`, aucun fetch : le SVG est dans le HTML.
 *
 * **Un seul sprite par page.** Toutes les marques sont émises une fois dans
 * `<defs>` (`<symbol>`), puis référencées par `<use href="#brand-…">`. Le
 * `fill="currentColor"` placé sur le `<path>` se résout **sur le `<use>`**,
 * donc une seule table de paths sert les deux thèmes sans variante — d'où
 * l'absence de `dark:` sur les logos du footer.
 *
 * Les 5 destinations sans marque disponible dans Simple Icons (Microsoft,
 * Edge, VS Code, RapidAPI, Open VSX) rendent un Phosphor générique : mieux
 * vaut une icône honnête qu'un logo approximatif.
 */

const PHOSPHOR_FALLBACK: Record<string, React.ComponentType<{ className?: string }>> = {
  Browser,
  Code,
  Plugs,
  PuzzlePiece,
  WindowsLogo,
};

/** Les `<symbol>` de toutes les marques — à poser une fois, avant le strip. */
export function BrandSprite() {
  return (
    <svg aria-hidden="true" focusable="false" className="absolute h-0 w-0 overflow-hidden">
      <defs>
        {Object.entries(BRAND_PATHS).map(([key, brand]) => (
          <symbol key={key} id={`brand-${key}`} viewBox="0 0 24 24">
            <path d={brand.path} fill="currentColor" />
          </symbol>
        ))}
      </defs>
    </svg>
  );
}

/**
 * Une marque. `className` dimensionne (`h-5 w-5`) et la couleur vient de
 * `currentColor` — donc le strip entier est monochrome d'un coup.
 */
export function BrandIcon({ brand, className }: { brand: string; className?: string }) {
  const fallback = PHOSPHOR_MARKS[brand];
  if (fallback) {
    const Icon = PHOSPHOR_FALLBACK[fallback.icon];
    if (Icon) {
      return <Icon className={className} />;
    }
  }
  if (!BRAND_PATHS[brand]) return null;
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <use href={`#brand-${brand}`} />
    </svg>
  );
}
