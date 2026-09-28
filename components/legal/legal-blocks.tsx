import {
  LEGAL_BASIS_ROWS,
  NOT_SUBPROCESSORS,
  RETENTION_ROWS,
  STORAGE_ROWS,
  SUBPROCESSOR_ROWS,
  type RetentionRow,
  type StorageRow,
  type SubprocessorRow,
} from "@/lib/legal-content";

/**
 * Blocs de données insérés dans le flux d'un document juridique via le
 * marqueur `{{block:cle}}` (voir `splitParts` dans `lib/legal.ts`).
 *
 * Chaque bloc est un **vrai `<table>`** sémantique : `caption`, `th scope`,
 * et un wrapper `overflow-x-auto` focusable — sans quoi un tableau qui déborde
 * devient inatteignable au clavier. C'est précisément ce que markdown ne peut
 * pas offrir ici (pas de `remark-gfm`).
 */

function Table({
  caption,
  headers,
  children,
}: {
  caption: string;
  headers: readonly string[];
  children: React.ReactNode;
}) {
  return (
    <div
      role="region"
      aria-label={caption}
      tabIndex={0}
      className="my-7 overflow-x-auto rounded-2xl border border-border/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/40 print:border-foreground/20"
    >
      <table className="w-full border-collapse text-left text-[14px]">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-border bg-muted/40">
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                scope="col"
                className="whitespace-nowrap px-4 py-3 text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&>tr]:border-b [&>tr]:border-border/50 [&>tr:last-child]:border-0">
          {children}
        </tbody>
      </table>
    </div>
  );
}

function Cell({ children, header = false }: { children: React.ReactNode; header?: boolean }) {
  const Tag = header ? "th" : "td";
  return (
    <Tag
      {...(header ? { scope: "row" } : {})}
      className={
        header
          ? "px-4 py-3 align-top text-left font-bold text-foreground"
          : "px-4 py-3 align-top font-medium text-muted-foreground"
      }
    >
      {children}
    </Tag>
  );
}

/** `{{block:legal-basis}}` — base légale par traitement. */
export function LegalBasisBlock() {
  return (
    <Table
      caption="Base légale de chaque traitement"
      headers={["Traitement", "Données", "Base légale"]}
    >
      {LEGAL_BASIS_ROWS.map((row) => (
        <tr key={row.treatment}>
          <Cell header>{row.treatment}</Cell>
          <Cell>{row.data}</Cell>
          <Cell>{row.basis}</Cell>
        </tr>
      ))}
    </Table>
  );
}

/** `{{block:retention}}` — durées de conservation. */
export function RetentionBlock() {
  return (
    <Table
      caption="Durées de conservation par type de donnée"
      headers={["Donnée", "Durée", "Pourquoi"]}
    >
      {RETENTION_ROWS.map((row: RetentionRow) => (
        <tr key={row.data}>
          <Cell header>{row.data}</Cell>
          <Cell>{row.duration}</Cell>
          <Cell>{row.rationale}</Cell>
        </tr>
      ))}
    </Table>
  );
}

/** `{{block:subprocessors}}` — sous-traitants réels. */
export function SubprocessorsBlock() {
  return (
    <>
      <Table
        caption="Sous-traitants et transferts"
        headers={["Service", "Traitement", "Localisation"]}
      >
        {SUBPROCESSOR_ROWS.map((row: SubprocessorRow) => (
          <tr key={row.service}>
            <Cell header>
              {row.service}
              {row.note ? (
                <span className="block text-[12px] font-medium text-muted-foreground">
                  {row.note}
                </span>
              ) : null}
            </Cell>
            <Cell>{row.purpose}</Cell>
            <Cell>{row.location}</Cell>
          </tr>
        ))}
      </Table>

      {/* Ce qui n'est PAS un sous-traitant : sans cette précision, un lecteur
          croirait que Stripe et RevenueCat sont nos prestataires, et
          l'inverse de la vérité se retourne contre nous. */}
      <div className="my-6 rounded-2xl border border-border/60 bg-muted/40 p-5">
        <p className="text-[11px] font-black uppercase tracking-[0.15em] text-muted-foreground">
          Ce qui n&apos;est pas un sous-traitant
        </p>
        <ul className="mt-3 flex flex-col gap-3">
          {NOT_SUBPROCESSORS.map((text) => (
            <li
              key={text}
              className="relative pl-5 text-[15px] font-medium leading-relaxed text-muted-foreground before:absolute before:left-0 before:top-[0.6em] before:size-[5px] before:rounded-full before:bg-muted-foreground/50"
            >
              {text}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

/** `{{block:storage}}` — ce qui est stocké dans le navigateur. */
export function StorageBlock() {
  return (
    <Table
      caption="Stockage local et traceurs"
      headers={["Élément", "Pourquoi", "Portée", "Détail"]}
    >
      {STORAGE_ROWS.map((row: StorageRow) => (
        <tr key={row.name}>
          <Cell header>{row.name}</Cell>
          <Cell>{row.purpose}</Cell>
          <Cell>
            {row.scope === "essentiel" ? (
              <span className="font-bold text-foreground">Essentiel</span>
            ) : (
              <span className="font-bold text-foreground">Mesure d&apos;audience</span>
            )}
          </Cell>
          <Cell>{row.detail}</Cell>
        </tr>
      ))}
    </Table>
  );
}

/** Clé de marqueur → composant. Clé inconnue = rendu ignoré, jamais une exception. */
const BLOCKS: Record<string, () => React.ReactNode> = {
  "legal-basis": LegalBasisBlock,
  retention: RetentionBlock,
  subprocessors: SubprocessorsBlock,
  storage: StorageBlock,
};

export function LegalBlock({ blockKey }: { blockKey: string }) {
  const Block = BLOCKS[blockKey];
  if (!Block) return null;
  return <>{Block()}</>;
}

export const LEGAL_BLOCK_KEYS = Object.keys(BLOCKS);
