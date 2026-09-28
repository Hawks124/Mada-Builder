import { BrandIcon, BrandSprite } from "@/components/ui/brand-mark";
import { brandHoverColor, brandHoverColorDark, brandLabel } from "@/lib/brand-paths";
import { cn } from "@/lib/utils";

/**
 * Bande « où distribuer » — les destinations supportées par le formulaire.
 *
 * **Pourquoi une liste de liens ne peut pas faire ce travail.** Le formulaire
 * de soumission déclare 15 types de produit (`PRODUCT_LINKS_BY_TYPE`) et
 * ~30 champs de liens : 10 registres de packages, 4 stores, 3 extensions
 * navigateur, 2 plateformes de jeux, des places de marché de plugins… Une
 * colonne de liens textuels oblige à choisir lesquels afficher, et tout choix
 * arbitraire fait deux choses nuisibles : la colonne devient un mur de liens,
 * et les liens écartés ont l'air d'une absence de mérite alors qu'ils sont
 * des pairs.
 *
 * **Les logos règlent le deux.** Une marque est auto-identifiante : pas de
 * libellé à lire, donc 28 entrées tiennent en 2 rangées au lieu de 28 lignes,
 * et rien n'est hiérarchisé par la longueur du texte. La couverture suit
 * `PRODUCT_LINKS_BY_TYPE` — si le formulaire accepte une destination, elle
 * est ici.
 *
 * **Le survol révèle la couleur de marque** (`hex` de Simple Icons, via
 * `--brand`), monochrome au repos comme le reste du site. Les 5 destinations
 * sans marque dans Simple Icons n'ont pas de `hex` : elles gardent le survir
 * monochrome plutôt qu'une couleur inventée.
 *
 * **Ce composant ne possède ni filet ni padding** — le footer les place, pour
 * que la bande et le wordmark géant partagent la même respiration.
 *
 * Les 28 URL ont été vérifiées en HTTP 200. `crates.io` est le seul
 * écosystème sans lien vérifiable depuis ce poste (WAF qui renvoie 404 à tout
 * client non-navigateur) : c'est la doc Cargo qui la remplace, elle mène au
 * même `cargo publish`.
 *
 * Composant **serveur** : le sprite et les `<use>` sont du HTML, aucun JS.
 */

type Destination = { brand: string; href: string };

const DESTINATIONS: Destination[] = [
  // Stores mobiles & desktop
  { brand: "apple", href: "https://developer.apple.com/app-store/review/guidelines/" },
  { brand: "googleplay", href: "https://play.google.com/about/developer-content-policy/" },
  {
    brand: "microsoft",
    href: "https://learn.microsoft.com/en-us/windows/apps/publish/store-policies",
  },
  { brand: "flathub", href: "https://flathub.org" },
  // Extensions navigateur
  { brand: "chrome", href: "https://developer.chrome.com/docs/webstore/publish" },
  { brand: "firefox", href: "https://addons.mozilla.org/en-US/developers/" },
  { brand: "edge", href: "https://microsoftedge.microsoft.com/addons" },
  // Registres de packages
  { brand: "npm", href: "https://docs.npmjs.com/" },
  { brand: "pubdev", href: "https://pub.dev/" },
  { brand: "pypi", href: "https://pypi.org/" },
  { brand: "packagist", href: "https://packagist.org/" },
  { brand: "gomodules", href: "https://pkg.go.dev/" },
  { brand: "maven", href: "https://maven.apache.org/guides/index.html" },
  { brand: "nuget", href: "https://www.nuget.org/" },
  { brand: "rubygems", href: "https://rubygems.org/" },
  { brand: "homebrew", href: "https://formulae.brew.sh/" },
  { brand: "rust", href: "https://doc.rust-lang.org/cargo/" },
  // Modèles & versions
  { brand: "hf", href: "https://huggingface.co" },
  { brand: "github", href: "https://docs.github.com/en/repositories/releasing-projects-on-github" },
  // Jeux
  { brand: "itchio", href: "https://itch.io" },
  { brand: "steam", href: "https://partner.steamgames.com/doc/home" },
  // Plugins
  { brand: "vscode", href: "https://marketplace.visualstudio.com/" },
  { brand: "openvsx", href: "https://open-vsx.org/" },
  { brand: "figma", href: "https://www.figma.com/community" },
  { brand: "wordpress", href: "https://wordpress.org/plugins/" },
  // API & chatbots
  { brand: "postman", href: "https://www.postman.com/" },
  { brand: "rapidapi", href: "https://rapidapi.com/" },
  { brand: "telegram", href: "https://core.telegram.org/bots" },
];

export function FooterDestinations() {
  // Séparation en deux rangées pour le double marquee
  const ROW_1 = DESTINATIONS.slice(0, Math.ceil(DESTINATIONS.length / 2));
  const ROW_2 = DESTINATIONS.slice(Math.ceil(DESTINATIONS.length / 2));

  const renderIconList = (items: Destination[], id: string) => (
    <ul className="flex flex-nowrap items-center gap-12 px-6 shrink-0">
      {items.map(({ brand, href }, idx) => {
        const label = brandLabel(brand) ?? brand;
        const hex = brandHoverColor(brand);
        return (
          <li key={`${brand}-${id}-${idx}`}>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              title={label}
              aria-label={label}
              {...(hex
                ? {
                    style: {
                      "--brand": hex,
                      "--brand-dark": brandHoverColorDark(brand),
                    } as React.CSSProperties,
                  }
                : {})}
              className={cn(
                "inline-flex items-center text-foreground/45 transition-all duration-300",
                hex
                  ? "hover:text-[var(--brand)] dark:hover:text-[var(--brand-dark)]"
                  : "hover:text-foreground",
              )}
            >
              <BrandIcon brand={brand} className="h-[22px] w-[22px]" />
            </a>
          </li>
        );
      })}
    </ul>
  );

  return (
    <section aria-labelledby="footer-destinations" className="relative w-full overflow-hidden">
      <BrandSprite />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:gap-4">
        <h2
          id="footer-destinations"
          className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground"
        >
          Où distribuer
        </h2>
        <p className="text-[13px] font-medium text-muted-foreground leading-relaxed">
          Les 15 types de produit acceptés par le formulaire, et où les publier. Le store n&apos;est
          pas un obstacle à être listé.
        </p>
      </div>

      <div className="mt-8 flex flex-col gap-8 w-full [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)] [&:hover_a]:opacity-30 [&:hover_a:hover]:!opacity-100 [&:hover_a:hover]:scale-110">
        {/* Ligne 1 : Défilement vers la gauche */}
        <div className="flex w-max animate-[marquee_50s_linear_infinite] hover:[animation-play-state:paused]">
          {renderIconList(ROW_1, "r1-1")}
          {renderIconList(ROW_1, "r1-2")}
          {renderIconList(ROW_1, "r1-3")}
          {renderIconList(ROW_1, "r1-4")}
        </div>

        {/* Ligne 2 : Défilement vers la droite */}
        <div className="flex w-max animate-[marquee-reverse_50s_linear_infinite] hover:[animation-play-state:paused]">
          {renderIconList(ROW_2, "r2-1")}
          {renderIconList(ROW_2, "r2-2")}
          {renderIconList(ROW_2, "r2-3")}
          {renderIconList(ROW_2, "r2-4")}
        </div>
      </div>
    </section>
  );
}
