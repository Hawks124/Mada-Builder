import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";
import { GridBackground } from "@/components/ui/grid-background";
import { WHY_PUBLISH, SECURITY_GUARANTEES } from "@/components/submit/sidebar/sidebar-data";

export const metadata: Metadata = {
  title: "À propos | Mada-Made",
  description:
    "Pourquoi Mada-Made existe : la scène tech malgache n'a pas d'endroit à elle. Un annuaire, un classement qui ne se vend pas, et des revenus vérifiés en lecture seule.",
};

const RELEVE = "27 septembre 2026";

const PROBLEME = [
  {
    titre: "Pas de scène en ligne",
    texte:
      "Il y a des apps, des sites, des outils qui sortent de Madagascar. Ils n'ont pas d'endroit où se retrouver. Un produit malgache est présenté au monde, il n'est pas présenté à son pays.",
  },
  {
    titre: "Pas de preuve",
    texte:
      "Un développeur solo n'a aujourd'hui aucun endroit où démontrer que son produit est réel, utilisé, et qu'il rapporte. La seule preuve qui compte reste privée, dans son tableau de bord.",
  },
  {
    titre: "Pas de pairs",
    texte:
      "Chacun construit dans son coin, sans réseau de confrères et sans signal de reconnaissance. Le talent se révèle ici, mais il s'explique à l'étranger.",
  },
];

const SOLUTION = [
  {
    titre: "Un annuaire, pas un réseau social",
    texte:
      "Chaque produit publié a sa page, son lien, ses votes, son auteur. Indexée, partageable, durable. Rien à scope : la page est le livrable.",
  },
  {
    titre: "Un classement qui ne se vend pas",
    texte:
      "Le rang vient des votes et du temps, jamais d'un abonnement. Dès qu'un classement se vend, il cesse d'être un classement — et c'est là que tout le projet tient.",
  },
  {
    titre: "Des revenus vérifiés, lus directement",
    texte:
      "Tu connectes une clé en lecture seule. Le chiffre affiché vient de ton prestataire de facturation, agrégé, rafraîchi, jamais auto-déclaré. C'est le seul signal difficile à falsifier, donc c'est le seul qui fait foi.",
  },
  {
    titre: "Une revue humaine",
    texte:
      "Chaque fiche est lue par quelqu'un, en général sous 24 h ouvrées. C'est lent, c'est coûteux, et c'est exactement ce qui rend l'annuaire crédible.",
  },
];

const CONSTRUCTION = [
  {
    etape: "01",
    titre: "Formes principales",
    texte: "Les pics du Tsingy",
  },
  {
    etape: "02",
    titre: "Structure",
    texte: "Rythme et variation",
  },
  {
    etape: "03",
    titre: "Symbole final",
    texte: "Équilibre et lisibilité",
  },
];

const PALETTE = [
  { nom: "Noir", hex: "#000000", ink: true },
  { nom: "Zinc", hex: "#A7A9AC", ink: false },
  { nom: "Gris clair", hex: "#E5E5E5", ink: false },
  { nom: "Blanc", hex: "#FFFFFF", ink: false },
];

/**
 * Étiquette de mouvement, dans la marge gauche sur grand écran — le système
 * des notes marginales de l'édition imprimée.
 *
 * **Pas de table des matières.** `/regles` en a une parce que c'est de la
 * documentation de référence, qu'on consulte. Ici c'est un récit : une page
 * d'histoire qui affiche un sommaire et une barre latérale se lit comme un
 * contrat, et perd le rythme. La marge donne le repère sans l'imposer.
 */
function Movement({
  num,
  label,
  title,
  children,
}: {
  num: string;
  label: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border/60 pt-10">
      <div className="lg:grid lg:grid-cols-[10rem_minmax(0,1fr)] lg:gap-x-12">
        <div className="mb-4 lg:mb-0">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground/60">
            <span className="tabular-nums">{num}</span> — {label}
          </p>
        </div>
        <div className="max-w-[62ch]">
          <h2 className="mb-5 text-2xl font-black tracking-tight text-foreground md:text-[2rem] md:leading-[1.1]">
            {title}
          </h2>
          <div className="flex flex-col gap-5 text-[16px] font-medium leading-[1.75] text-muted-foreground md:text-[17px]">
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function AproposPage() {
  return (
    <>
      {/* ── Ouverture ──
          La photo du Tsingy **est** l'argument : le symbole est fait de ces
          pics. Elle porte le propos avant le premier mot. `logo-origin.webp`
          fait 126 Ko — le PNG d'origine en faisait 2,2 Mo. */}
      <section className="relative">
        <div className="relative h-[52vh] min-h-80 w-full overflow-hidden md:h-[62vh]">
          <Image
            src="/branding/logo-origin.webp"
            alt="Les pics calcaires du Tsingy de Bemaraha, à Madagascar : des lames minces dressées dans une plaine karstique."
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-linear-to-t from-background via-background/25 to-background/10" />
        </div>
        <div className="container mx-auto max-w-8xl px-4 md:px-8">
          {/* `relative z-10` : le chevauchement est voulu, mais la photo
              précédait sans contexte d'empilement et la **première ligne du
              titre passait dessous** — c'est ce qui dessinait un trait
              parasites au-dessus du mot suivant.

              La largeur est en rem, pas en `ch` : au corps display, `ch` vaut
              une mesure beaucoup trop étroite et cassait la phrase sur six
              lignes. `text-balance` équilibre les deux lignes. */}
          <h1 className="relative z-10 -mt-10 max-w-[min(100%,38rem)] pb-4 text-6xl font-black leading-[0.95] tracking-tight text-balance text-muted-foreground md:-mt-14 md:text-7xl">
            Ce que tu construis ici, on le voit ici.
          </h1>
        </div>
      </section>

      {/* ── État des lieux ──
          **Le chiffre ne nous appartient pas, et n'est pas écrit comme s'il
          nous appartenait.** Une version précédente de cette page disait
          « La communauté de Mada-Made est un groupe public » : c'était faux.
          Mada-Made n'a pas de communauté, et le groupe en question n'est pas
          le nôtre. Mada-Made est un projet en cours, sans contributeurs et
          sans communauté établie — tant qu'il n'en a pas, la page ne peut pas
          en inventer une.

          Le nombre est donc présenté pour ce qu'il mesure réellement : la
          taille d'un public malgache qui existe déjà, et qu'aucun annuaire
          malgache n'a jamais servi. C'est un fait sur le marché, pas une
          revendication. Le groupe n'est pas nommé : tant que l'usage n'est
          pas autorisé, le nom n'apparaît pas publiquement.
        */}
      <section className="container mx-auto max-w-7xl px-4 md:px-8">
        <div className="border-y border-border/60 py-8">
          <p className="max-w-[56ch] text-[15px] font-medium leading-relaxed text-muted-foreground">
            Un groupe IT malgache compte{" "}
            <strong className="font-black text-foreground">plus de 70 000</strong> membres.
            C&apos;est la taille d&apos;un public qui existe déjà — et qu&apos;aucun annuaire
            malgache n&apos;a jamais servi.
          </p>
          <p className="mt-3 text-[12px] font-medium text-muted-foreground/60">
            Relevé le {RELEVE}. Ce chiffre bouge tous les jours — c&apos;est le seul nombre de cette
            page, et il est daté pour cette raison.
          </p>
        </div>
      </section>

      {/* ── Les quatre mouvements ── */}
      <div className="container mx-auto flex max-w-7xl flex-col gap-20 px-4 py-20 md:px-8 md:py-28">
        <Movement num="01" label="Problème" title="Trois manques, pas trois intentions.">
          {PROBLEME.map((p) => (
            <p key={p.titre}>
              <strong className="font-black text-foreground">{p.titre}.</strong> {p.texte}
            </p>
          ))}
        </Movement>

        <Movement
          num="02"
          label="Objectif"
          title="Être l'endroit où l'on cherche un produit malgache, et où l'on est fier de ce que la scène construit."
        >
          <p>
            L&apos;objectif tient en une phrase :{" "}
            <strong className="font-black text-foreground">
              ce que tu construis ici, on le voit ici
            </strong>
            . Pas une ambition internationale — les produits qui sortent de Madagascar trouvent leur
            public ailleurs, et c&apos;est normal. Il s&apos;agit de la scène <em>locale</em>, de ce
            qui se construit ici et qui n&apos;a nulle part où se montrer.
          </p>
          <p>
            Le périmètre est net : le maker est malgache, ou le produit vise le marché malgache. Les
            deux sont acceptés. Ni hobby, ni multinationale qui repostule son ancienneté.
          </p>
          <p>
            Ce que la page refuse de faire, c&apos;est viser les marchés étrangers saturés dès le
            premier jour, en dormant peu, en payant des commissions, en vivant sous la menace
            d&apos;un retrait de compte, en achètant des comptes pour gonfler un chiffre —{" "}
            <strong className="font-black text-foreground">
              on n&apos;a pas encore réussi à construire pour nous-mêmes, autant le faire maintenant
            </strong>
            .
          </p>
        </Movement>

        <Movement
          num="03"
          label="Solution"
          title="Un annuaire, un classement honnête, et une preuve qui ne s'invente pas."
        >
          <p>Quatre briques, et rien d&apos;autre. Chacune répond directement à un manque du 01.</p>
          <ol className="mt-2 flex flex-col gap-6">
            {SOLUTION.map((s, i) => (
              <li key={s.titre} className="flex gap-4">
                <span className="shrink-0 text-[13px] font-black tabular-nums text-muted-foreground/50">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex flex-col gap-1">
                  <strong className="font-black text-foreground">{s.titre}</strong>
                  <span>{s.texte}</span>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-2">
            Sur les revenus vérifiés, parce que c&apos;est le point où la confiance se joue :
          </p>
          <ul className="flex flex-col gap-3">
            {SECURITY_GUARANTEES.map((g) => (
              <li key={g.title} className="flex gap-3">
                <span className="mt-[0.7em] h-1 w-1 shrink-0 rounded-full bg-foreground/30" />
                <span>
                  <strong className="font-black text-foreground">{g.title}.</strong> {g.desc}
                </span>
              </li>
            ))}
          </ul>
        </Movement>

        <Movement num="04" label="Valeur" title="Ce que ça change pour toi, puis pour le pays.">
          <p>
            Les raisons concrètes de publier ici. Elles sont les mêmes que celles affichées dans le
            formulaire de soumission — une seule source, pour que les deux pages ne puissent pas
            diverger.
          </p>
          <ul className="mt-2 flex flex-col gap-5">
            {WHY_PUBLISH.map((b) => (
              <li key={b.title} className="flex gap-3">
                <span className="mt-[0.7em] h-1 w-1 shrink-0 rounded-full bg-foreground/30" />
                <span>
                  <strong className="font-black text-foreground">{b.title}.</strong> {b.text}
                </span>
              </li>
            ))}
          </ul>
        </Movement>

        {/* ── Le choix de la sobriété ──
            Une observation datée, pas une opinion. C'est ce qui fait de notre
            minimalisme une décision informée plutôt qu'un oubli. */}
        <section className="border-t border-border/60 pt-10">
          <div className="lg:grid lg:grid-cols-[10rem_minmax(0,1fr)] lg:gap-x-12">
            <div className="mb-4 lg:mb-0">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground/60">
                Sobriété
              </p>
            </div>
            <div className="max-w-[62ch]">
              <h2 className="mb-5 text-2xl font-black tracking-tight text-foreground md:text-[2rem] md:leading-[1.1]">
                On a vu la liste. On l&apos;a coupée.
              </h2>
              <div className="flex flex-col gap-5 text-[16px] font-medium leading-[1.75] text-muted-foreground md:text-[17px]">
                <p>
                  Avant de commencer, on a étudié une plateforme de référence construite sur le même
                  modèle, pour un pays de taille comparable. C&apos;est de là que vient l&apos;idee
                  du classement quotidien et des revenus vérifiés — et c&apos;est aussi de là que
                  vient la mise en garde.
                </p>
                <p>
                  Son menu portait déjà, quelques années après son lancement : un forum, un job
                  board, des demandes de produits, une recherche de testeurs, des pages par ville,
                  un fil d&apos;activité, des notifications, des favoris, et un emplacement sponsor.
                  Chacun est raisonnable seul. Ensemble, ce sont huit communautés qui réclament
                  chacune leur propre masse critique — et un site qui semble occupé tout en
                  paraissant vide.
                </p>
                <p>
                  Notre liste est plus courte, et c&apos;est un choix.{" "}
                  <strong className="font-black text-foreground">
                    On préfère quatre briques qui marchent à huit qui n&apos;arrivent pas à
                    démarrer.
                  </strong>
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── La marque ──
            Tout le texte est **retypé** en HTML, et non lu dans une image :
            le texte d'une image est invisible pour un lecteur d'écran, non
            traduisible, et illisible à l'échelle du mobile. La photo reste une
            photo. */}
        <section className="border-t border-border/60 pt-10">
          <div className="lg:grid lg:grid-cols-[10rem_minmax(0,1fr)] lg:gap-x-12">
            <div className="mb-4 lg:mb-0">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground/60">
                Identité
              </p>
            </div>
            <div className="flex max-w-[62ch] flex-col gap-10">
              <div>
                <h2 className="mb-5 text-2xl font-black tracking-tight text-foreground md:text-[2rem] md:leading-[1.1]">
                  Le symbole vient d&apos;ici.
                </h2>
                <div className="flex flex-col gap-5 text-[16px] font-medium leading-[1.75] text-muted-foreground md:text-[17px]">
                  <p>
                    Le symbole de Mada-Made vient des{" "}
                    <strong className="font-black text-foreground">Tsingy de Madagascar</strong>.
                    Des formations rocheuses étroites, sculptées par le temps. Une géométrie
                    naturelle, unique au monde.
                  </p>
                  <p>
                    Le nom dit la même chose : <em>built from Madagascar</em> — construit à partir
                    d&apos;ici, par ici. Pas une étiquette d&apos;origine qui dit d&apos;où vient un
                    produit, mais celle qui dit qui l&apos;a fait.
                  </p>
                </div>
              </div>

              <figure className="flex flex-col gap-4">
                <div className="overflow-hidden rounded-2xl border border-border/60">
                  <Image
                    src="/branding/logo-coposition.webp"
                    alt="Panneau de composition du symbole : de la photo du Tsingy jusqu'au symbole final, en sept étapes."
                    width={1536}
                    height={1024}
                    sizes="(max-width: 1024px) 100vw, 62ch"
                    className="h-auto w-full"
                  />
                </div>
                <figcaption className="text-[12px] font-medium text-muted-foreground/60">
                  De la photo à la forme finale, en sept étapes.
                </figcaption>
              </figure>

              <div>
                <h3 className="mb-4 text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground/60">
                  Construction
                </h3>
                <ol className="flex flex-col gap-4">
                  {CONSTRUCTION.map((c) => (
                    <li key={c.etape} className="flex gap-4">
                      <span className="shrink-0 text-[13px] font-black tabular-nums text-muted-foreground/50">
                        {c.etape}
                      </span>
                      <span>
                        <strong className="font-black text-foreground">{c.titre}</strong>
                        <span className="text-muted-foreground/70"> — {c.texte}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </div>

              <div>
                <h3 className="mb-4 text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground/60">
                  Palette
                </h3>
                <ul className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  {PALETTE.map((p) => (
                    <li key={p.hex} className="flex items-center gap-3">
                      <span
                        className="h-8 w-8 shrink-0 rounded-md border border-border/60"
                        style={{ backgroundColor: p.hex }}
                        aria-hidden="true"
                      />
                      <span className="flex flex-col leading-tight">
                        <span className="text-[13px] font-black text-foreground">{p.nom}</span>
                        <span className="text-[12px] font-medium tabular-nums text-muted-foreground/60">
                          {p.hex}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <figure className="flex flex-col gap-4">
                <div className="overflow-hidden rounded-2xl border border-border/60">
                  <Image
                    src="/branding/mockup.webp"
                    alt="Le symbole Mada-Made embossé sur un ordinateur portable, à côté de sa signature."
                    width={1536}
                    height={1024}
                    sizes="(max-width: 1024px) 100vw, 62ch"
                    className="h-auto w-full"
                  />
                </div>
                <figcaption className="text-[12px] font-medium text-muted-foreground/60">
                  Technologie&nbsp;: Madagascar. Impact&nbsp;: avenir.
                </figcaption>
              </figure>
            </div>
          </div>
        </section>
      </div>

      {/* ── Invitation ──
          Bandeau inversé : fond `--foreground`, texte inversé. La fin d'un
          récit éditorial se ferme par un contraste, pas par un bouton de plus.

          Le décor n'est pas un aplat : c'est la **même grille que le reste du
          site**, via le composant partagé, en variante `inverted` — sans elle
          la grille serait claire sur un fond sombre, donc invisible. `isolate`
          est nécessaire : le composant est en `-z-10`, et sans contexte
          d'empilement ici il passerait derrière le `bg-foreground`. Motif
          repris du même montage que `community-cta.tsx`. */}
      <section className="relative isolate overflow-hidden bg-foreground text-background">
        <div className="absolute inset-0 pointer-events-none">
          <GridBackground variant="css" inverted showGlows={false} showBottomFade={false} />
        </div>
        <div className="container relative z-10 mx-auto max-w-7xl px-4 py-20 md:px-8 md:py-28">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] md:items-end">
            <div className="flex max-w-[min(100%,30rem)] flex-col gap-5">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-background/60">
                La suite vous appartient
              </p>
              <h2 className="text-3xl font-black leading-[1.05] tracking-tight text-balance md:text-5xl">
                Inscrivez ce que vous construisez.
              </h2>
            </div>
            <div className="flex flex-col gap-6">
              <p className="text-[15px] font-medium leading-relaxed text-background/70">
                Gratuit, sans abonnement, sans paperasse. Chaque fiche est lue par un humain, en
                général sous 24 h ouvrées.
              </p>
              <Link
                href="/products/submit"
                className="inline-flex h-12 w-fit items-center gap-2 rounded-full bg-background px-6 text-[14px] font-black text-foreground transition-opacity hover:opacity-90"
              >
                Publier un produit
                <ArrowRightIcon weight="bold" className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
