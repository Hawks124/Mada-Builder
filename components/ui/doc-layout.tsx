import Link from "next/link";
import { LegalToc } from "@/components/legal/legal-toc";

/**
 * Coquille d'un document long — sommaire collant, colonne de lecture, renvois.
 *
 * **Générique, pas juridique.** `/confidentialite` et `/conditions` l'utilisent
 * via `LegalLayout`, qui ajoute les blocs propres au droit (identité du
 * responsable, contact opposable). `/regles` l'utilise **directement**, sans
 * ces blocs : une charte communautaire est un engagement moral lisible, pas un
 * acte juridique. Lui afficher une « identité du responsable de traitement »
 * ferait passer un guideline pour un contrat — et surtout ferait croire à tort
 * qu'on y trouve des engagements opposables.
 *
 * Trois colonnes sur grand écran, une sur mobile : rail de sommaire collant,
 * colonne de lecture bornée à 68 ch, renvois entre documents. La mesure n'est
 * pas un détail esthétique : à 1 200 px de large l'œil perd la ligne en
 * revenant à gauche, et un texte long se lit mal à ce format.
 *
 * Le rail est le seul élément client (`LegalToc`, pour le surlignage de la
 * section active) ; le reste est rendu serveur.
 */
export function DocLayout({
  eyebrow,
  title,
  description,
  updated,
  headings,
  children,
  footer,
  siblings,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  updated?: string;
  headings: { id: string; text: string }[];
  children: React.ReactNode;
  /** Bloc après le contenu (contact, appel à l'action). */
  footer?: React.ReactNode;
  siblings?: { href: string; label: string }[];
}) {
  return (
    <main className="w-full bg-background">
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-24 print:pt-0 print:pb-0">
        {/* ── En-tête ── */}
        <header className="mb-12 flex flex-col gap-4">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
            {eyebrow}
          </p>
          <h1 className="max-w-[24ch] text-4xl md:text-5xl font-black tracking-tight text-foreground text-balance">
            {title}
          </h1>
          {description ? (
            <p className="max-w-[62ch] text-lg font-medium leading-relaxed text-muted-foreground text-pretty">
              {description}
            </p>
          ) : null}
          {updated ? (
            <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-muted-foreground/80">
              Mis à jour le{" "}
              {new Date(`${updated}T00:00:00`).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          ) : null}
        </header>

        <div className="grid grid-cols-1 gap-x-12 lg:grid-cols-[15rem_minmax(0,1fr)]">
          <LegalToc headings={headings} updated={updated ?? ""} />

          <article className="min-w-0 max-w-[68ch]">{children}</article>
        </div>

        {footer ? <div className="mt-14">{footer}</div> : null}

        {/* ── Renvois ── */}
        {siblings && siblings.length > 0 ? (
          <nav
            aria-label="Autres documents"
            className="mt-16 flex flex-wrap items-center gap-2 border-t border-border/40 pt-8 print:hidden"
          >
            {siblings.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className="rounded-full border border-border/60 px-5 py-2.5 text-[14px] font-bold text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-muted/50 hover:text-foreground"
              >
                {s.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </div>
    </main>
  );
}
