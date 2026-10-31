import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon, FacebookLogoIcon, RocketLaunchIcon } from "@phosphor-icons/react/dist/ssr";
import { DocLayout } from "@/components/ui/doc-layout";
import { FACEBOOK_GROUP_URL } from "@/components/navbar/community-dropdown";
import {
  LAUNCH_CHECKLIST,
  WHY_PUBLISH,
  FIELD_EXPLANATIONS,
  FAQ_ITEMS,
} from "@/components/submit/sidebar/sidebar-data";

export const metadata: Metadata = {
  title: "Publier son produit | Mada-Made",
  description:
    "Le mode d'emploi complet : pourquoi publier, la checklist de lancement, le formulaire champ par champ, la revue humaine (fiche + binaire) et les réponses aux questions de la communauté.",
};

/**
 * Guide « Publier son produit » — l'adresse canonique de la guidance
 * d'inspiration (mobile compris).
 *
 * **Pourquoi ici et pas cachée dans le formulaire** : la sidebar desktop
 * convertit au bon moment, mais sous 1024 px rien ne s'y lisait. La même
 * vitrine, rendue serveur et indexable (SEO longue traîne, §4), à une
 * URL stable que le footer relie — la sidebar, elle, ne change pas.
 *
 * La source de vérité du contenu est `components/submit/sidebar/sidebar-data.ts`
 * (« all static content lives here ») : la page le met en page, elle n'en
 * détient pas. La partie binaire est écrite ici en une fois et renvoie vers
 * les guides ultra-spécifiques (`/guides/signature-apk`) plutôt que de les
 * paraphraser.
 */

const HEADINGS = [
  { id: "pourquoi-publier", text: "Pourquoi publier" },
  { id: "checklist", text: "Le lancement en 5 points" },
  { id: "formulaire", text: "Le formulaire, champ par champ" },
  { id: "revue", text: "La revue : fiche + binaire" },
  { id: "faq", text: "Vos questions" },
];

export default function PublierGuidePage() {
  return (
    <DocLayout
      eyebrow="Guides makers"
      title="Publier son produit"
      description="De la création du compte au verdict de la revue : tout ce qui prépare une publication qui passe sans frictions — écrit une fois, à jour, relié partout."
      headings={HEADINGS}
      siblings={[
        { href: "/guides/signature-apk", label: "Signer son APK release" },
        { href: "/guides/revenus-verifies", label: "Revenus vérifiés (Bêta)" },
        { href: "/regles", label: "Charte de la communauté" },
      ]}
      footer={
        <section
          aria-labelledby="publier-cta"
          className="rounded-2xl border border-border/60 bg-muted/20 p-6 flex flex-col gap-4"
        >
          <h2 id="publier-cta" className="text-xl font-extrabold tracking-tight text-foreground">
            Prêt à soumettre ?
          </h2>
          <p className="text-[14px] font-medium leading-relaxed text-muted-foreground">
            Le formulaire vous mène à votre rythme — un brouillon s&apos;enregistre dès le nom, la
            revue tranche sous 24 h ouvrées. Une question sans réponse ici ? Le groupe est le bon
            endroit.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/products/submit"
              className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3 text-[14px] font-bold text-background transition-opacity hover:opacity-90"
            >
              Publier mon produit
              <ArrowRightIcon weight="bold" className="h-4 w-4" />
            </Link>
            <Link
              href={FACEBOOK_GROUP_URL}
              className="inline-flex items-center gap-2 rounded-full border border-border/60 px-5 py-3 text-[14px] font-bold text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-muted/50 hover:text-foreground"
            >
              <FacebookLogoIcon weight="fill" className="h-4 w-4" />
              Poser la question au groupe
            </Link>
          </div>
        </section>
      }
    >
      <section aria-labelledby="pourquoi-publier" className="flex flex-col gap-6">
        <h2
          id="pourquoi-publier"
          className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground"
        >
          Pourquoi publier
        </h2>
        <ul className="flex flex-col gap-5">
          {WHY_PUBLISH.map((item, i) => (
            <li key={item.title} className="flex gap-5">
              <span className="shrink-0 text-sm font-black tabular-nums text-muted-foreground/50">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="flex flex-col gap-1.5">
                <h3 className="text-[16px] font-extrabold tracking-tight text-foreground">
                  {item.title}
                </h3>
                <p className="text-[15px] font-medium leading-relaxed text-muted-foreground">
                  {item.text}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="checklist" className="mt-14 flex flex-col gap-6">
        <h2
          id="checklist"
          className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground"
        >
          Le lancement en 5 points
        </h2>
        <ol className="flex flex-col overflow-hidden rounded-2xl border border-border/60">
          {LAUNCH_CHECKLIST.map((item) => (
            <li
              key={item.number}
              className="flex gap-5 border-b border-border/50 px-5 py-4 last:border-0"
            >
              <span className="shrink-0 text-sm font-black tabular-nums text-muted-foreground/50">
                {item.number}
              </span>
              <div className="flex flex-col gap-1">
                <h3 className="text-[15px] font-extrabold tracking-tight text-foreground">
                  {item.title}
                </h3>
                <p className="text-[14px] font-medium leading-relaxed text-muted-foreground">
                  {item.desc}
                </p>
              </div>
            </li>
          ))}
        </ol>
        <p className="text-[13px] font-medium leading-relaxed text-muted-foreground">
          L&apos;APK Android, lui, a son propre rituel (keystore, schémas de signature) :{" "}
          <Link
            href="/guides/signature-apk"
            className="font-bold text-foreground underline decoration-border decoration-2 underline-offset-[3px] transition-colors hover:decoration-foreground"
          >
            le guide de signature
          </Link>{" "}
          le couvre pas-à-pas, framework par framework.
        </p>
      </section>

      <section aria-labelledby="formulaire" className="mt-14 flex flex-col gap-6">
        <h2
          id="formulaire"
          className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground"
        >
          Le formulaire, champ par champ
        </h2>
        <p className="text-[15px] font-medium leading-relaxed text-muted-foreground">
          « Pourquoi on vous demande ça ? » — la réponse de chaque champ, sans mystère.
        </p>
        <dl className="flex flex-col overflow-hidden rounded-2xl border border-border/60">
          {FIELD_EXPLANATIONS.map((explanation) => (
            <div
              key={explanation.field}
              className="flex flex-col gap-1 border-b border-border/50 px-5 py-4 last:border-0"
            >
              <dt className="text-[15px] font-extrabold tracking-tight text-foreground">
                {explanation.field}
              </dt>
              <dd className="text-[14px] font-medium leading-relaxed text-muted-foreground">
                {explanation.explanation}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="revue" className="mt-14 flex flex-col gap-4">
        <h2
          id="revue"
          className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground"
        >
          La revue : fiche + binaire
        </h2>
        <p className="text-[15px] font-medium leading-relaxed text-muted-foreground">
          <RocketLaunchIcon
            weight="duotone"
            className="mr-1 inline-block h-4 w-4 align-[-2px] text-emerald-600 dark:text-emerald-500"
          />
          Deux pistes indépendantes, chacune avec son verdict :
        </p>
        <ol className="flex flex-col overflow-hidden rounded-2xl border border-border/60">
          <li className="flex flex-col gap-1 border-b border-border/50 px-5 py-4 sm:flex-row sm:gap-6">
            <span className="shrink-0 text-[13px] font-black text-foreground sm:w-52">
              La fiche (textes, liens, images)
            </span>
            <span className="text-[14px] font-medium leading-relaxed text-muted-foreground">
              Lue par un humain sous 24 h ouvrées — produit réel et joignable, chaîne de liens
              vérifiée, pas de doublon. Refusée = motif écrit et réversible après correction.
            </span>
          </li>
          <li className="flex flex-col gap-1 border-b border-border/50 px-5 py-4 sm:flex-row sm:gap-6">
            <span className="shrink-0 text-[13px] font-black text-foreground sm:w-52">
              Le binaire (APK Android)
            </span>
            <span className="text-[14px] font-medium leading-relaxed text-muted-foreground">
              Analysé localement (manifest + signature), téléversé en direct, puis installé et testé
              sur un vrai téléphone. Universel, signé release et installable : ce qui ne
              s&apos;installe pas ne reste pas — le debug et les splits par ABI sont refusés
              d&apos;office.
            </span>
          </li>
          <li className="flex flex-col gap-1 border-b border-border/50 px-5 py-4 last:border-0 sm:flex-row sm:gap-6">
            <span className="shrink-0 text-[13px] font-black text-foreground sm:w-52">
              Ce qui fait foi après l&apos;approbation
            </span>
            <span className="text-[14px] font-medium leading-relaxed text-muted-foreground">
              L&apos;empreinte SHA-256 de votre certificat est pincée : toute substitution de
              binaire est détectable à chaque mise à jour, et une rotation de clé signale la revue
              avant approbation. Les APK vivent en stockage privé — téléchargeables via des liens
              signés, jamais en accès public.
            </span>
          </li>
        </ol>
        <p className="text-[13px] font-medium leading-relaxed text-muted-foreground">
          Le contrat entier (votes, sanctions, recours) vit dans{" "}
          <Link
            href="/regles"
            className="font-bold text-foreground underline decoration-border decoration-2 underline-offset-[3px] transition-colors hover:decoration-foreground"
          >
            la charte de la communauté
          </Link>
          .
        </p>
      </section>

      <section aria-labelledby="faq" className="mt-14 flex flex-col gap-6">
        <h2
          id="faq"
          className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground"
        >
          Vos questions
        </h2>
        <div className="flex flex-col gap-5">
          {FAQ_ITEMS.map((item) => (
            <details
              key={item.question}
              className="group rounded-2xl border border-border/60 bg-muted/20 px-5 py-4 open:bg-muted/30"
            >
              <summary className="cursor-pointer text-[15px] font-extrabold tracking-tight text-foreground marker:content-none">
                {item.question}
              </summary>
              <p className="mt-3 text-[14px] font-medium leading-relaxed text-muted-foreground">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </section>
    </DocLayout>
  );
}
