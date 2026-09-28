import { LEGAL_IDENTITY } from "@/lib/legal-content";

/**
 * Identité du responsable — **source unique**, rendue à l'identique sur les
 * trois pages juridiques (confidentialité, conditions, charte).
 *
 * Dupliqué dans chaque page, il divergerait. Ici, corriger l'adresse de
 * contact une fois la corrige partout.
 *
 * **Elle est affichée, pas seulement cachée.** Tant qu'aucune entité
 * légale n'existe, l'éditeur est un développeur indépendant identifiable par
 * son email de contact : c'est suffisant pour que vos droits soient
 * exerçables, et c'est honnête — là où un nom d'entité inventé serait une
 * fausse déclaration publiée et indexable.
 *
 * `legalEntity` et `postalAddress` valent `null` : le jour où une entité est
 * créée, il suffit de renseigner ces deux champs, aucun texte à réécrire.
 */
export function LegalIdentitySummary({ className }: { className?: string }) {
  const id = LEGAL_IDENTITY;
  const rows: { label: string; value: string }[] = [
    { label: "Éditeur", value: id.legalEntity ?? id.editorLabel },
    { label: "Projet", value: id.projectName },
    { label: "Pays", value: id.country },
    {
      label: "Juridiction",
      value: `Droit applicable : ${id.governingLaw} — ${id.courtName}`,
    },
    { label: "Autorité de contrôle", value: id.authorityName },
  ];

  return (
    <section
      aria-labelledby="legal-identity"
      className={className ?? "mt-14 overflow-hidden rounded-2xl border border-border/60"}
    >
      <h2
        id="legal-identity"
        className="bg-muted/50 px-5 py-3 text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground"
      >
        Identité du responsable
      </h2>
      <dl className="flex flex-col">
        {rows.map((row) => (
          <div
            key={row.label}
            className="grid grid-cols-1 gap-1 border-t border-border/40 px-5 py-4 first:border-0 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-6"
          >
            <dt className="text-[12px] font-black uppercase tracking-[0.1em] text-muted-foreground">
              {row.label}
            </dt>
            <dd className="text-[15px] font-medium leading-relaxed text-foreground">{row.value}</dd>
          </div>
        ))}
        {id.postalAddress ? (
          <div className="grid grid-cols-1 gap-1 border-t border-border/40 px-5 py-4 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-6">
            <dt className="text-[12px] font-black uppercase tracking-[0.1em] text-muted-foreground">
              Adresse
            </dt>
            <dd className="text-[15px] font-medium leading-relaxed text-foreground">
              {id.postalAddress}
            </dd>
          </div>
        ) : null}
        <div className="grid grid-cols-1 gap-1 border-t border-border/40 px-5 py-4 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-6">
          <dt className="text-[12px] font-black uppercase tracking-[0.1em] text-muted-foreground">
            Cadre applicable
          </dt>
          <dd className="text-[15px] font-medium leading-relaxed text-foreground">
            {id.frameworks.join(" · ")}
          </dd>
        </div>
      </dl>
    </section>
  );
}
