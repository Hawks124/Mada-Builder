import Link from "next/link";
import * as React from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import { slugifyHeading } from "@/lib/slug";
import { cn } from "@/lib/utils";

/**
 * Rendu markdown stylé sur les tokens du site — **serveur**, sans JS client.
 *
 * **Pourquoi un composant et non `@tailwindcss/typography`.** Le plugin n'est
 * pas installé et ne le sera pas : son échelle et son schéma de couleurs
 * (`prose-zinc`, `prose-invert`) Fighting avec la house style du site
 * (`font-black tracking-tight`, `text-foreground`/`muted-foreground`),
 * et le projet a fait le choix documenté de ne pas ajouter de dépendance. Tant
 * que le plugin était absent, toutes les classes `prose*` étaient des no-op :
 * Tailwind n'erre pas sur une classe inconnue, il n'émet rien — les titres de
 * section rendaient donc à la taille du corps de texte, en mur de prose.
 *
 * **Pourquoi tous les éléments sont mappés, pas seulement ceux utilisés.**
 * Un mapping partiel est une bombe à retardement : le jour où un rédacteur
 * écrit une citation ou un tableau, l'élément sort nu et personne ne voit
 * pourquoi. `REMAPPED` ci-dessous est la liste de contrôle : tout ce que
 * `react-markdown` sait émettre est couvert.
 *
 * `remark-gfm` n'est **pas** installé : ni tableau, ni strike, ni liste de
 * tâches, ni autolink dans le markdown. Les tableaux dont la politique a
 * besoin sont des composants React (`components/legal/legal-blocks.tsx`).
 *
 * **Sécurité.** `rehype-raw` absent : le HTML brut des documents reste
 * échappé, donc pas de vecteur XSS via le contenu. `react-markdown` applique
 * en plus son `urlTransform` par défaut, qui refuse `javascript:` et les
 * autres protocoles dangereux — on ne le surcharge pas.
 */

/** Pictogramme de sortie, inline pour ne pas dépendre du build phosphor. */
function ExternalGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 256 256"
      aria-hidden="true"
      focusable="false"
      className={cn("inline-block shrink-0", className)}
      fill="currentColor"
    >
      <path d="M200.64 72.36a8 8 0 0 0-8-8h-40V52a12 12 0 0 0-12-12H44a12 12 0 0 0-12 12v96a12 12 0 0 0 12 12h40v8a8 8 0 0 0 16 0V168h40a12 12 0 0 0 12-12V84a8 8 0 0 0-8-8Zm-4 80h-40V84h40Z" />
    </svg>
  );
}

/** Aplatit les enfants React en texte, pour dériver un slug d'ancre. */
function toText(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(toText).join("");
  if (React.isValidElement(node))
    return toText((node.props as { children?: React.ReactNode }).children);
  return "";
}

type HeadingProps = { children?: React.ReactNode };

/** Fabrique le rendu d'un titre : ancre optionnelle, échelles distinctes. */
function heading(level: 1 | 2 | 3 | 4, withIds: boolean) {
  const Tag = `h${level}` as const;
  const base = "font-extrabold tracking-tight text-foreground text-balance scroll-mt-28";
  const size = {
    1: "text-3xl md:text-4xl mt-0 mb-5",
    2: "text-2xl md:text-[1.75rem] mt-14 mb-4",
    3: "text-lg md:text-xl mt-9 mb-3",
    4: "text-base mt-7 mb-2",
  }[level];
  return function Heading({ children, ...rest }: HeadingProps) {
    const id = withIds ? slugifyHeading(toText(children)) : undefined;
    return (
      <Tag id={id} {...rest} className={cn(base, size)}>
        {children}
      </Tag>
    );
  };
}

export function Prose({
  children,
  className,
  headingIds = false,
}: {
  /** Source markdown. */
  children: string;
  className?: string;
  /** Pose un `id` (slug FR) sur chaque titre — requis pour le sommaire. */
  headingIds?: boolean;
}) {
  const components: Components = {
    h1: heading(1, headingIds),
    h2: heading(2, headingIds),
    h3: heading(3, headingIds),
    h4: heading(4, headingIds),

    p: ({ children, ...rest }) => (
      <p
        {...rest}
        className="text-[15px] md:text-[16px] font-medium leading-[1.75] text-muted-foreground my-5 first:mt-0 last:mb-0 text-pretty"
      >
        {children}
      </p>
    ),

    // Interne -> `next/link` (client transition). Externe -> nouvel onglet,
    // `noopener noreferrer` et pictogramme : une URL externe doit être
    // signalée, sinon rien ne dit à l'utilisateur qu'il va quitter le site.
    a: ({ href, children, ...rest }) => {
      const isInternal = typeof href === "string" && href.startsWith("/");
      if (isInternal) {
        return (
          <Link
            href={href}
            {...rest}
            className="font-bold text-foreground underline decoration-border decoration-2 underline-offset-[3px] transition-colors hover:decoration-foreground"
          >
            {children}
          </Link>
        );
      }
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          {...rest}
          className="font-bold text-foreground underline decoration-border decoration-2 underline-offset-[3px] transition-colors hover:decoration-foreground"
        >
          {children}
          <ExternalGlyph className="ml-1 size-3 align-[0.05em] opacity-60" />
        </a>
      );
    },

    ul: ({ children, ...rest }) => (
      <ul {...rest} className="my-5 flex flex-col gap-2 pl-1 list-none">
        {children}
      </ul>
    ),
    ol: ({ children, ...rest }) => (
      <ol {...rest} className="my-5 flex flex-col gap-2 pl-1 list-none [counter-reset:prose-ol]">
        {children}
      </ol>
    ),
    li: ({ children, className, ...rest }) => {
      const ordered = /^\s*ol\b/.test(className ?? "");
      return (
        <li
          {...rest}
          className={cn(
            "relative pl-7 text-[15px] md:text-[16px] font-medium leading-[1.75] text-muted-foreground",
            "before:absolute before:left-0 before:top-[0.62em] before:size-[5px] before:rounded-full before:bg-muted-foreground/50",
            ordered &&
              "before:hidden before:inset-auto before:left-0 before:top-0 before:w-6 before:h-6 before:rounded-none before:bg-transparent before:text-[13px] before:font-black before:tabular-nums before:text-muted-foreground/60 before:content-[counter(prose-ol)'_']",
            className,
          )}
        >
          {children}
        </li>
      );
    },

    strong: ({ children, ...rest }) => (
      <strong {...rest} className="font-black text-foreground">
        {children}
      </strong>
    ),
    em: ({ children, ...rest }) => (
      <em {...rest} className="italic text-foreground/90">
        {children}
      </em>
    ),
    del: ({ children, ...rest }) => (
      <del {...rest} className="line-through opacity-70">
        {children}
      </del>
    ),

    blockquote: ({ children, ...rest }) => (
      <blockquote
        {...rest}
        className="my-6 border-l-2 border-foreground/25 bg-muted/40 py-4 pl-5 pr-4 rounded-r-xl"
      >
        {children}
      </blockquote>
    ),

    hr: () => <hr className="my-10 border-0 border-t border-border" />,

    code: ({ children, className, ...rest }) => {
      // react-markdown passe `className="language-…"` sur les blocs.
      const isBlock = Boolean(className);
      if (isBlock) {
        return (
          <code {...rest} className={cn("block font-mono text-[13px] leading-relaxed", className)}>
            {children}
          </code>
        );
      }
      return (
        <code
          {...rest}
          className="rounded-md border border-border/60 bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground"
        >
          {children}
        </code>
      );
    },
    pre: ({ children, ...rest }) => (
      <pre
        {...rest}
        className="my-6 overflow-x-auto rounded-2xl border border-border/60 bg-muted p-5 text-foreground"
      >
        {children}
      </pre>
    ),

    img: ({ src, alt, ...rest }) => (
      // `alt` reste obligatoire : une image sans alternative est invisible
      // pour un lecteur d'écran, et une `<img>` sans `alt` n'est pas valide.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt ?? ""}
        loading="lazy"
        decoding="async"
        {...rest}
        className="my-6 max-w-full rounded-2xl border border-border/60"
      />
    ),

    // `react-markdown` n'émet pas de tableau sans `remark-gfm`, mais le
    // mapping est là pour qu'un jour l'ajout du plugin ne casse pas la mise
    // en page. Le wrapper est focusable : sans `tabIndex`, un tableau qui
    // déborde est inatteignable au clavier.
    table: ({ children, ...rest }) => (
      <div
        role="region"
        aria-label="Tableau de données"
        tabIndex={0}
        className="my-7 overflow-x-auto rounded-2xl border border-border/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/40"
      >
        <table {...rest} className="w-full border-collapse text-left text-[14px]">
          {children}
        </table>
      </div>
    ),
    thead: ({ children, ...rest }) => (
      <thead {...rest} className="border-b border-border">
        {children}
      </thead>
    ),
    tbody: ({ children, ...rest }) => (
      <tbody
        {...rest}
        className="[&>tr]:border-b [&>tr]:border-border/50 [&>tr:last-child]:border-0"
      >
        {children}
      </tbody>
    ),
    tr: ({ children, ...rest }) => (
      <tr {...rest} className="transition-colors hover:bg-muted/40">
        {children}
      </tr>
    ),
    th: ({ children, ...rest }) => (
      <th
        scope="col"
        {...rest}
        className="whitespace-nowrap px-4 py-3 text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground"
      >
        {children}
      </th>
    ),
    td: ({ children, ...rest }) => (
      <td {...rest} className="px-4 py-3 align-top font-medium text-muted-foreground">
        {children}
      </td>
    ),

    kbd: ({ children, ...rest }) => (
      <kbd
        {...rest}
        className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-mono text-[0.8em] text-foreground"
      >
        {children}
      </kbd>
    ),
    sup: ({ children, ...rest }) => (
      <sup {...rest} className="text-[0.7em] font-bold">
        {children}
      </sup>
    ),
    sub: ({ children, ...rest }) => (
      <sub {...rest} className="text-[0.7em]">
        {children}
      </sub>
    ),
    // Listes de tâches (task lists). Pas de GFM ici, mais le cas est couvert.
    input: ({ className, ...rest }) => (
      <input
        {...rest}
        type="checkbox"
        readOnly
        className={cn("mr-2 size-4 accent-foreground align-[-0.1em]", className)}
      />
    ),
  };

  return (
    <div className={cn("max-w-[68ch] text-foreground", className)}>
      <ReactMarkdown components={components}>{children}</ReactMarkdown>
    </div>
  );
}
