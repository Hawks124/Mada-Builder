import Link from "next/link";
import { ArrowUpRightIcon, FacebookLogoIcon, GithubLogoIcon } from "@phosphor-icons/react/dist/ssr";
import { LogoMark } from "@/components/ui/logo";
import { FlagMadagascar } from "@/components/ui/flag-madagascar";
import { DigestForm } from "@/components/layout/digest-form";
import { FooterDestinations } from "@/components/layout/footer-destinations";
import { FACEBOOK_GROUP_URL } from "@/components/navbar/community-dropdown";

/**
 * Footer public — composant **serveur**, statique, sans lecture de session.
 *
 * 1. `(site)/layout.tsx` lit déjà la session pour le gate `/bienvenue`. Relire
 *    l'observateur ici rendrait **toutes** les pages publiques dynamiques et
 *    casserait le cache du leaderboard (PRD §16).
 * 2. Aucun état, aucun `onClick` : zéro JS client, rien à hydrater. Le strip
 *    de destinations est un sprite SVG + `<use>`, également sans JS.
 *
 * **La largeur est le point.** Un footer qui n'occupe que 40 % de son
 * conteneur a l'air vide quel que soit son contenu, et aucun changement de
 * typo ne le rattrape.
 *
 * Modèle repris des footers de référence (T.Music, Untitled UI) :
 * - la **colonne marque** porte l'identité, la description et le CTA. Les
 *   glyphes de réseau y vivaient au départ, suivant les 5 références ; ils
 *   sont passés en colonne « Le projet » (Code source, Rejoindre le groupe),
 *   parce qu'un rond Facebook de 36 px sous un CTA ne dit rien et qu'un lien
 *   textuel dit exactement où il mène ;
 * - les **liens se répartissent en groupes pleins** dans des colonnes, et non
 *   en rang d'intertits. Les références n'écrivent jamais
 *   « Explorer · Catégories · Classement » : ça se lit comme une phrase, pas
 *   comme des destinations ;
 * - le légal fusionne dans « La plateforme » : une colonne « Légal » à deux
 *   entrées est le signe le plus net d'un footer généré par CMS.
 *
 * **L'ordre des blocs est une décision, pas un empilement.** Colonnes, puis
 * l'écosystème de distribution (28 destinations), puis la signature. Les
 * destinations passent **avant** le wordmark : on énonce où un produit peut
 * vivre avant de terminer sur la marque, sinon le ghost arrive en plein
 * écran et coupe la lecture.
 *
 * Volontairement **aucun lien vers une facette de `/discover`** (`?type=…`) :
 * ces URLs sont des quasi-doublons de `/discover` et aucune page ne déclare
 * `robots` pour les désindexer. Les lier depuis toutes les pages aggraverait
 * le problème. Le footer pointe vers des pages, pas vers des filtres.
 *
 * **Pas de chiffres de vanité.** Les stats produit/domaine/type vivaient ici ;
 * elles sont retirées. Elles ne disent rien à un visiteur (l'annuaire est
 * jeune par construction, donc le compteur est bas et décourageant), et elles
 * occupaient la place du seul appel à action qui compte pour la marque : mettre
 * son produit en ligne. Le CTA prend la colonne.
 */

/** Repo canonique — déjà nommé dans `.github/ISSUE_TEMPLATE/config.yml`. */
const GITHUB_URL = "https://github.com/Hawks124/Mada-Builder";

type FooterItem = {
  label: string;
  href: string;
  external?: boolean;
  /**
   * Glyphe de marque, rendu **avant** le libellé. Reservé aux liens dont la
   * destination est une marque identifiable (GitHub, Facebook) : sans logo, un
   * lien externe se distingue des liens internes par la seule fleche `↗`, ce
   * qui est un indice faible — « Code source » ne dit pas ou.
   */
  icon?: "github" | "facebook";
};

const BRAND_GLYPH: Record<NonNullable<FooterItem["icon"]>, React.ElementType> = {
  github: GithubLogoIcon,
  facebook: FacebookLogoIcon,
};

const EXPLORER: FooterItem[] = [
  { label: "Explorer", href: "/discover" },
  { label: "Catégories", href: "/categories" },
  { label: "Classement", href: "/leaderboard" },
  { label: "Revenus vérifiés", href: "/revenue" },
];

// Le légal est ici et pas dans une colonne à lui : il donne à ce groupe assez
// de substance pour ne pas ressembler à un gabarit.
//
// « Discussions » a été retiré : GitHub apparaît déjà dans « Le projet »
// (Code source), et deux liens GitHub dans deux colonnes adjacentes se lisent
// comme un doublon.
const PLATEFORME: FooterItem[] = [
  { label: "Charte de la communauté", href: "/regles" },
  { label: "Politique de confidentialité", href: "/confidentialite" },
  { label: "Conditions d'utilisation", href: "/conditions" },
];

/** Code source et vie du projet. Les deux seuls liens GitHub / Facebook du site. */
const PROJET: FooterItem[] = [
  { label: "À propos", href: "/about" },
  { label: "Code source", href: GITHUB_URL, external: true, icon: "github" },
  {
    label: "Rejoindre le groupe",
    href: FACEBOOK_GROUP_URL,
    external: true,
    icon: "facebook",
  },
];

/**
 * Pas de champ email ici, **exprès**.
 *
 * Un champ qui collecte une adresse sans rien derrière est le contrôle mort
 * que cette colonne portait à sa création : il collecte des adresses qui
 * n'arrivaient nulle part. Tant que la liste d'abonnés n'existe pas, on
 * propose un bouton vers la page d'inscription — qui, elle, dit honnêtement
 * que le digest n'est pas encore lancé et donne une alternative qui marche
 * aujourd'hui.
 *
 * Cette colonne a une raison d'être juridique autant qu'éditoriale : c'est le
 * canal du préavis de 15 jours annoncé dans les conditions. Le jour où le
 * digest existe, ce champ devient le canal et le préavis redevient tenable.
 */
/**
 * Le digest : ce qui bouge dans la scène, une fois par semaine.
 *
 * La copie précédente — « les nouveaux produits et les revenus vérifiés » —
 * décrivait un contenu étroit. Une promesse trop précise sur un pied de
 * page se retourne vite contre son auteur : on s'engage sur un périmètre
 * qu'on ne peut pas tenir. Elle est donc formulée comme la promesse qu'on
 * pourra réellement honourer, et le détail du contenu reste ailleurs.
 */
const DIGEST_COPY =
  "En soumettant votre adresse e-mail, vous acceptez de recevoir la newsletter mensuelle de Raycast. Pour plus d'informations, veuillez consulter notre politique de confidentialité. Vous pouvez retirer votre consentement à tout moment.";
export function Footer() {
  return (
    <footer className="bg-muted">
      <div className="container px-4 md:px-8 max-w-7xl mx-auto py-12 md:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.35fr_0.8fr_1fr_0.85fr_1.05fr] gap-x-8 lg:gap-x-8 gap-y-10">
          {/* ── Colonne marque ── */}
          <div className="flex flex-col gap-5">
            <Link href="/" className="group flex items-center gap-2.5 w-fit">
              <LogoMark className="h-7 w-7 transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-3" />
              <span className="text-[14px] font-bold tracking-tight text-foreground">
                Mada-Made
              </span>
            </Link>

            <p className="text-2xl font-extrabold tracking-tighter text-foreground leading-tight">
              Construit à Madagascar.
            </p>
            <p className="flex items-center gap-2.5 -mt-3">
              <FlagMadagascar />
              <span className="text-[13px] font-medium text-muted-foreground leading-relaxed">
                L&apos;annuaire de référence des produits tech malgaches.
              </span>
            </p>

            {/* Le seul appel à action du footer : c'est ce que le site attend
                du visiteur. Classes alignées sur `profile-form.tsx` — pas de
                composant Button shadcn dans ce repo, la convention est
                `rounded-full bg-foreground text-background` posée à la main. */}
            <Link
              href="/products/submit"
              className="mt-1 inline-flex w-fit items-center gap-2 rounded-full bg-foreground px-6 py-2.5 text-[13px] font-bold text-background transition-all hover:opacity-90 active:scale-[0.98]"
            >
              Publier un produit
              <ArrowUpRightIcon weight="bold" aria-hidden="true" className="h-3.5 w-3.5" />
            </Link>
          </div>

          <FooterColumn label="Explorer" items={EXPLORER} />
          <FooterColumn label="La plateforme" items={PLATEFORME} />
          <FooterColumn label="Le projet" items={PROJET} />
          <FooterDigest />
        </div>

        {/* ── Où distribuer ── */}
        {/* La bande passe **avant** la signature : on énonce l'écosystème
            (28 destinations) avant de terminer sur la marque. Le filet et le
            padding sont ici, pas dans la bande, pour que les deux blocs
            partagent la même respiration. */}
        <div className="mt-14 border-t border-foreground/10 pt-10 pb-14">
          <FooterDestinations />
        </div>

        {/* ── Signature : le wordmark géant ── */}
        {/* ForgeEquip. Les liens restent en haut, et le footer se termine sur
            la marque en grand plutôt que sur une ligne de copyright. C'est
            le seul élément qui donne une signature au site, et ça ne coûte
            aucune donnée, aucun back-end, aucun lien factice. */}
        <div className="border-t border-foreground/10" aria-hidden="true" />

        {/* **Le mot est un fantôme, pas un mot effacé.** Le dégradé part de 10 %
            d'opacité en haut et se dissout vers le bas : le wordmark garde sa
            masse de signature mais sa ligne de base plonge dans le fond.

            Le dégradé passe par un `mask-image` et non par
            `bg-clip-text` + `text-transparent` : avec `text-transparent`, si le
            dégradé ne se peint pas, le mot devient *invisible* — un logo
            perdu. Ici la couleur est posée sur le texte et le masque ne fait
            qu'effacer : au pire le mot reste lisible à 10 %, jamais absent.
            `currentColor` fait que les deux thèmes sont couverts sans
            variante. */}
        <Link
          href="/"
          aria-label="Mada-Made — accueil"
          className="group mt-10 block overflow-hidden text-[clamp(2.15rem,12.5vw,11rem)] font-extrabold tracking-tighter leading-[0.8] text-center"
        >
          <span
            aria-hidden="true"
            className="block whitespace-nowrap text-foreground opacity-[0.08] mask-[linear-gradient(to_bottom,#000,transparent)] transition-opacity duration-500 group-hover:opacity-90"
          >
            ZAO MALAGASY
          </span>
        </Link>

        <div className="mt-10 border-t border-foreground/10" aria-hidden="true" />

        <p className="mt-6 text-center text-[12px] text-muted-foreground">
          © {new Date().getFullYear()} Mada-Made
        </p>
      </div>
    </footer>
  );
}

/**
 * Colonne « Rester informé » — champ en ligne, honnête sur son état.
 *
 * Le champ est réel, mais il **n'écrit nulle part** : il n'y a pas de table
 * d'abonnés. Plutôt que d'afficher « merci, vous êtes inscrit » — un mensonge
 * qui ferait perdre une adresse à quelqu'un qui l'a donnée de bonne foi — la
 * soumission révèle un message qui dit la vérité et donne un canal qui
 * fonctionne : l'email de l'éditeur.
 *
 * Le jour où le digest existe, il ne reste qu'à brancher l'action et à
 * remplacer ce message par une double confirmation.
 */
function FooterDigest() {
  return (
    <div className="flex flex-col">
      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground pb-3 border-b border-foreground/10">
        Rester informé
      </h3>
      <p className="mt-3.5 text-[11px] font-medium text-muted-foreground/80 leading-relaxed">
        {DIGEST_COPY}
      </p>
      <DigestForm />
    </div>
  );
}

function FooterColumn({ label, items }: { label: string; items: FooterItem[] }) {
  return (
    <nav aria-label={label} className="flex flex-col">
      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground pb-3 border-b border-foreground/10">
        {label}
      </h3>
      <ul className="mt-3.5 flex flex-col gap-2.5">
        {items.map((item) => {
          const Glyph = item.icon ? BRAND_GLYPH[item.icon] : null;
          return (
            <li key={item.label}>
              <Link
                href={item.href}
                {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="group inline-flex items-center gap-2 text-[14px] text-muted-foreground transition-colors hover:text-foreground hover:font-bold"
              >
                {/* Un logo de marque remplace la fleche : la fleche ne dit que
                    « externe », le logo dit *ou*. Les deux ensemble font
                    doublon. */}
                {Glyph ? (
                  <Glyph
                    weight="fill"
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 text-foreground/55 transition-colors group-hover:text-foreground"
                  />
                ) : null}
                {item.label}
                {item.external && !Glyph && (
                  <ArrowUpRightIcon
                    weight="bold"
                    aria-hidden="true"
                    className="h-3 w-3 opacity-50 transition-opacity group-hover:opacity-100"
                  />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
