"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CaretDownIcon } from "@phosphor-icons/react";
import type { LegalHeading } from "@/lib/legal";
import { cn } from "@/lib/utils";

/**
 * Sommaire d'un document juridique, avec surlignage de la section active.
 *
 * **Pourquoi du JavaScript ici, et nulle part ailleurs.** Un sommaire qui ne
 * signale pas où l'on en est n'est qu'une liste : sur 14 sections, le lecteur
 * a perdu le fil dès qu'il défile. Le surlignage est le seul comportement qui
 * mérite du client — tout le reste de la page (titres, tableaux, blocs) est
 * rendu serveur et indexable.
 *
 * Le suivi se fait sur un écouteur de `scroll` coalescé par `requestAnimationFrame`
 * plutôt que par `IntersectionObserver` : la sémantique voulue est « la
 * dernière section dont le titre est passé au-dessus de la ligne de lecture »,
 * ce qu'IO ne donne pas directement — et qu'IO laisse en porte-à-faux quand
 * plusieurs titres sont visibles à la fois. Le scroll étant déjà ce que le
 * navigateur fait, on écoute le scroll.
 */

const READ_LINE = 140;

export function LegalToc({
  headings,
  updated,
}: {
  headings: readonly LegalHeading[];
  updated: string;
}) {
  const [active, setActive] = useState<string | null>(headings[0]?.id ?? null);

  useEffect(() => {
    if (headings.length === 0) return;
    const els = headings
      .map((h) => document.getElementById(h.id))
      .filter((el): el is HTMLElement => el !== null);
    if (els.length === 0) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      let current = els[0]!.id;
      for (const el of els) {
        if (el.getBoundingClientRect().top - READ_LINE <= 0) current = el.id;
      }
      // En bas de page, la dernière section est la courante même si son titre
      // est encore sous la ligne : sinon elle ne s'allume jamais, la dernière
      // entrée du sommaire étant par construction inatteignable.
      const atBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 8;
      if (atBottom) current = els[els.length - 1]!.id;
      setActive(current);
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <>
      {/* Mobile : replié par défaut. Un sommaire de 14 entrées déplié au
          chargement pousse le contenu hors de l'écran, sur le très petit
          écran où l'on lit le plus. */}
      <details className="lg:hidden mb-8 rounded-2xl border border-border/50 bg-muted/30 print:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
          Sommaire
          <CaretDownIcon weight="bold" className="h-3.5 w-3.5" />
        </summary>
        <nav aria-label="Sommaire" className="border-t border-border/40 px-5 py-4">
          <ol className="flex flex-col gap-1">
            {headings.map((h, i) => (
              <TocRow
                key={h.id}
                heading={h}
                index={i}
                active={active === h.id}
                onNavigate={() => {}}
              />
            ))}
          </ol>
        </nav>
      </details>

      {/* Bureau : rail collant. `print:hidden` — une colonne de sommaire sur
          une page imprimée est du bruit. */}
      <nav aria-label="Sommaire" className="hidden lg:block sticky top-28 self-start print:hidden">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
          Sommaire
        </p>
        <ol className="mt-4 flex flex-col border-l border-border/60">
          {headings.map((h, i) => (
            <TocRow
              key={h.id}
              heading={h}
              index={i}
              active={active === h.id}
              onNavigate={() => {}}
            />
          ))}
        </ol>
        {updated ? (
          <p className="mt-6 border-l border-border/60 pl-4 text-[12px] font-medium leading-relaxed text-muted-foreground/80">
            Version en vigueur au{" "}
            {new Date(`${updated}T00:00:00`).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        ) : null}
      </nav>
    </>
  );
}

function TocRow({
  heading,
  index,
  active,
}: {
  heading: LegalHeading;
  index: number;
  active: boolean;
  onNavigate: () => void;
}) {
  return (
    <li>
      <Link
        href={`#${heading.id}`}
        aria-current={active ? "location" : undefined}
        className={cn(
          "-ml-px flex items-baseline gap-2.5 border-l-2 py-1.5 pl-4 text-[13px] leading-snug transition-colors",
          active
            ? "border-foreground font-bold text-foreground"
            : "border-transparent font-medium text-muted-foreground hover:border-border hover:text-foreground",
        )}
      >
        <span
          className={cn(
            "shrink-0 text-[11px] font-black tabular-nums",
            active ? "text-foreground" : "text-muted-foreground/50",
          )}
        >
          {String(index + 1).padStart(2, "0")}
        </span>
        {heading.text}
      </Link>
    </li>
  );
}
