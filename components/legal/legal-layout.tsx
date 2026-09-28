import { EnvelopeSimpleIcon } from "@phosphor-icons/react/dist/ssr";
import { Prose } from "@/components/ui/prose";
import { DocLayout } from "@/components/ui/doc-layout";
import { LegalBlock } from "@/components/legal/legal-blocks";
import { LegalIdentitySummary } from "@/components/legal/legal-identity-summary";
import { LEGAL_IDENTITY } from "@/lib/legal-content";
import type { LegalDoc } from "@/lib/legal";

/**
 * Layout des documents juridiques — la coquille de `DocLayout` plus les deux
 * blocs que seuls des actes juridiques portent : l'identité du responsable de
 * traitement et le contact opposable.
 *
 * `/regles` n'utilise **pas** ce composant : une charte communautaire n'est pas
 * un acte juridique, et lui afficher une identité de responsable de traitement
 * ferait passer un guideline pour un contrat.
 */
export function LegalLayout({
  doc,
  siblings,
}: {
  doc: LegalDoc;
  siblings: { href: string; label: string }[];
}) {
  return (
    <DocLayout
      eyebrow="Document juridique"
      title={doc.title}
      description={doc.description}
      updated={doc.updated}
      headings={doc.headings}
      footer={
        <>
          <LegalIdentitySummary className="mt-0" />
          <ContactBlock />
        </>
      }
      siblings={siblings}
    >
      {doc.parts.map((part, i) =>
        part.kind === "markdown" ? (
          <Prose key={`md-${i}`} headingIds className="max-w-none">
            {part.text}
          </Prose>
        ) : (
          <LegalBlock key={`block-${i}-${part.key}`} blockKey={part.key} />
        ),
      )}
    </DocLayout>
  );
}

/**
 * Contact — remplace les trois renvois vers une page `/contact` qui n'a jamais
 * existé (le seul vestige en était un item « Contact » marqué « Bientôt » dans
 * la barre de navigation). Un renvoi mort dans un document juridique, c'est un
 * droit qui n'est pas exercable.
 */
function ContactBlock() {
  return (
    <section aria-labelledby="legal-contact" className="mt-8">
      <h2
        id="legal-contact"
        className="flex items-center gap-2.5 text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground"
      >
        <EnvelopeSimpleIcon weight="fill" className="h-4 w-4" />
        En cas de question
      </h2>
      <p className="mt-3 max-w-[60ch] text-[15px] font-medium leading-relaxed text-muted-foreground">
        Accès à vos données, export, suppression, contestation d&apos;une modération, réclamation :
        une seule adresse, traitée par la personne qui publie ce site.
      </p>
      <a
        href={`mailto:${LEGAL_IDENTITY.contactEmail}`}
        className="mt-4 inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-[14px] font-bold text-background transition-opacity hover:opacity-90"
      >
        {LEGAL_IDENTITY.contactEmail}
      </a>
    </section>
  );
}
