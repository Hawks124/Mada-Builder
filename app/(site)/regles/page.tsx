import type { Metadata } from "next";
import Link from "next/link";
import { EnvelopeSimpleIcon, FacebookLogoIcon, ScalesIcon } from "@phosphor-icons/react/dist/ssr";
import { DocLayout } from "@/components/ui/doc-layout";
import { Prose } from "@/components/ui/prose";
import { FACEBOOK_GROUP_URL } from "@/components/navbar/community-dropdown";
import { LEGAL_IDENTITY } from "@/lib/legal-content";

export const metadata: Metadata = {
  title: "Charte de la communauté | Mada-Made",
  description:
    "Les règles de la scène dev malgache : soumissions honnêtes, revue humaine, votes loyaux, recours ouvert et respect mutuel.",
};

/**
 * Charte communautaire — le contrat social, en langage clair.
 *
 * **Ce n'est pas un document juridique.** Celui-ci, c'est
 * [les conditions](/conditions). La distinction est structurante : la charte
 * explique *pourquoi*, les conditions engagent. D'où l'absence volontaire du
 * bloc « identité du responsable » — il n'a de sens que dans un acte
 * juridique, et le faire apparaître ici ferait passer un guideline pour un
 * contrat.
 *
 * La coquille de page est celle des documents longs (`DocLayout`), donc
 * sommaire collant et même mesure de lecture : la charte doit se lire comme
 * les conditions, sans s'y substituer.
 *
 * **La version précédente avait un trou qui rendait une sanction
 * inapplicable.** Elle renvoyait aux conditions pour la sanction la plus
 * grave, qui renvoyait à la charte pour la définir — et la charte ne la
 * définissait pas. Sanctionner par renvoi à un texte qui ne prévoit rien
 * n'est pas opposable. L'échelle des mesures est donc écrite **dans les
 * conditions**, qui est le document qui engage, et la charte la résume ici en
 * renvoyant vers le lieu unique où elle fait foi.
 */

const RULES = [
  {
    id: "regles-produits-reels",
    title: "Des produits réels",
    body: "Seuls les produits réels et joignables ont leur place ici : lien fonctionnel, icône exploitable, description honnête. Pas de spam, pas de doublons, pas de coquilles vides.",
  },
  {
    id: "regles-revue-humaine",
    title: "Une revue humaine",
    body: "Chaque soumission passe en revue manuelle sous 24 h ouvrées. Un rejet est toujours motivé et réversible après correction — jamais un couperet automatique sans recours.",
  },
  {
    id: "regles-votes-loyaux",
    title: "Des votes loyaux",
    body: "Un vote par utilisateur et par produit. Les anneaux de vote, les bots et les faux comptes excluent du classement, voire du compte. Le classement ne se vend ni ne s'achète.",
  },
  {
    id: "regles-respect",
    title: "Le respect mutuel",
    body: "On critique les produits, jamais les personnes. Cette scène se construit ensemble : célèbrez le travail des autres comme vous voulez voir le vôtre célébré.",
  },
];

const SANCTIONS = [
  {
    level: "Avertissement",
    body: "Écrit, avec le motif et ce qu'il faut corriger. Sans effet sur le compte.",
  },
  {
    level: "Suspension réversible",
    body: "Perte temporaire du vote et de la soumission. Le contenu reste en ligne. Réversible sur demande.",
  },
  {
    level: "Suspension définitive",
    body: "Réservée à la fraude organisée, aux faux comptes industrialisés et au contournement délibéré des règles. Motivée et écrite.",
  },
];

const HEADINGS = [
  { id: "regles-principes", text: "Les règles" },
  { id: "regles-sanctions", text: "En cas de manquement" },
  { id: "regles-oeuvre", text: "Open source" },
  { id: "regles-contact", text: "Écrire ou rejoindre" },
];

const CODE_BLOCK = `Le code de la plateforme est sous **licence MIT** : lisez-le, forkez-le, redéployez-le.

La licence MIT **ne couvre pas** la marque « Mada-Made » ni son logo. Vous pouvez forker le projet sous un autre nom ; vous ne pouvez pas reprendre son identité sans autorisation.`;

export default function ReglesPage() {
  return (
    <DocLayout
      eyebrow="Communauté"
      title="Charte de la communauté"
      description="Quatre règles simples pour une scène dont on est fiers. Et ce qui arrive si on les enfreint — parce qu'une charte sans sanction annoncée n'est pas une charte, c'est un vœu."
      headings={HEADINGS}
      siblings={[
        { href: "/conditions", label: "Conditions d'utilisation" },
        { href: "/confidentialite", label: "Politique de confidentialité" },
      ]}
    >
      <section aria-labelledby="regles-principes" className="flex flex-col gap-8">
        <h2
          id="regles-principes"
          className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground"
        >
          Les règles
        </h2>
        <ol className="flex flex-col gap-8">
          {RULES.map((rule, i) => (
            <li key={rule.id} className="flex gap-5">
              <span className="shrink-0 text-sm font-black tabular-nums text-muted-foreground/50">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="flex flex-col gap-2">
                <h3 className="text-xl font-extrabold tracking-tight text-foreground">
                  {rule.title}
                </h3>
                <p className="text-[15px] font-medium leading-relaxed text-muted-foreground">
                  {rule.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="regles-sanctions" className="mt-14 flex flex-col gap-6">
        <h2
          id="regles-sanctions"
          className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground"
        >
          En cas de manquement
        </h2>
        <p className="text-[15px] font-medium leading-relaxed text-muted-foreground">
          Trois niveaux, du plus léger au plus grave. Chaque sanction est écrite, motivée, et
          contestable —{" "}
          <strong className="font-black text-foreground">
            un appel à la fois, et 24 heures entre deux dépôts
          </strong>
          . Aucun bannissement n&apos;est prononcé sur la base d&apos;une règle qui ne figure pas
          dans{" "}
          <Link
            href="/conditions"
            className="font-bold text-foreground underline decoration-border decoration-2 underline-offset-[3px] transition-colors hover:decoration-foreground"
          >
            nos conditions
          </Link>
          , qui est le document qui engage et qui fait foi.
        </p>
        <ol className="flex flex-col overflow-hidden rounded-2xl border border-border/60">
          {SANCTIONS.map((s) => (
            <li
              key={s.level}
              className="flex flex-col gap-1 border-b border-border/50 px-5 py-4 last:border-0 sm:flex-row sm:gap-6"
            >
              <span className="shrink-0 text-[13px] font-black text-foreground sm:w-52">
                {s.level}
              </span>
              <span className="text-[14px] font-medium leading-relaxed text-muted-foreground">
                {s.body}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="regles-oeuvre" className="mt-14 flex flex-col gap-4">
        <h2
          id="regles-oeuvre"
          className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground"
        >
          <ScalesIcon weight="fill" className="h-4 w-4" />
          Open source
        </h2>
        <Prose className="max-w-none">{CODE_BLOCK}</Prose>
      </section>

      <section
        id="regles-contact"
        aria-labelledby="regles-contact-title"
        className="mt-14 flex flex-col gap-5 "
      >
        <h2
          id="regles-contact-title"
          className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground"
        >
          <EnvelopeSimpleIcon weight="fill" className="h-4 w-4" />
          Écrire ou rejoindre
        </h2>
        <p className="text-[15px] font-medium leading-relaxed text-muted-foreground">
          Une question, un litige, un signalement ? L&apos;email va directement à la personne qui
          publie ce site ; la scène se parle aussi en temps réel dans le groupe.
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href={`mailto:${LEGAL_IDENTITY.contactEmail}`}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-foreground px-5 text-[14px] font-bold text-background transition-opacity hover:opacity-90"
          >
            <EnvelopeSimpleIcon weight="bold" className="h-4 w-4" />
            Écrire
          </a>
          <a
            href={FACEBOOK_GROUP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center gap-2 rounded-full border border-border/60 px-5 text-[14px] font-bold text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-muted/50 hover:text-foreground"
          >
            <FacebookLogoIcon weight="fill" className="h-4 w-4" />
            Rejoindre le groupe
          </a>
        </div>
      </section>
    </DocLayout>
  );
}
