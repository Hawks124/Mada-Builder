import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";
import { GridBackground } from "@/components/ui/grid-background";
import contenu from "@/content/nouveautes.json";

export const metadata: Metadata = {
  title: "Nouveautés | Mada-Made",
  description:
    "Ce qui change sur Mada-Made : le classement, les revenus vérifiés, la mise à jour d'un binaire, les catégories. En clair, et daté.",
};

/** « 2026-10-20 » → « 20 octobre 2026 ». */
const MOIS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

function dateLisible(iso: string): string {
  const [a, m, j] = iso.split("-").map(Number);
  if (!a || !m || !j) return iso;
  return `${j} ${MOIS[m - 1]} ${a}`;
}

/**
 * `/nouveautés` — le journal public de la plateforme.
 *
 * Une page éditoriale datée, pas un changelog technique : le `CHANGELOG.md`
 * raconte ce que les développeurs ont changé, ce fichier raconte ce que ça
 * change pour un maker ou un visiteur. Une entrée = une date, un titre, ce
 * que ça change, et le lien pour aller voir.
 *
 * Le contenu vit dans `content/nouveautes.json` : le garder hors du code
 * permet de le modifier sans toucher au composant, et de le relire
 * facilement.
 */
export default function NouveautesPage() {
  return (
    <>
      {/* ── Ouverture ── */}
      <section className="relative border-b border-border/40">
        <GridBackground variant="css" glowPlacement="centered" showBottomFade={false} />
        <div className="absolute inset-x-0 bottom-0 h-10 bg-linear-to-t from-background via-background/70 to-transparent pointer-events-none" />
        <div className="relative container mx-auto max-w-5xl px-4 py-12 md:px-8 md:py-16">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2">
            Journal
          </p>
          <h1 className="text-3xl md:text-[2.5rem] font-extrabold tracking-tighter text-foreground leading-none">
            Nouveautés
          </h1>
          <p className="text-muted-foreground font-medium md:text-lg tracking-tight mt-2 max-w-2xl">
            {contenu.intro}
          </p>
        </div>
      </section>

      {/* ── Chronologie ──
          La date est l'axe de lecture : c'est elle qui dit « ce qui est
          récent », pas l'ordre du fichier. La ligne verticale à gauche
          reprend la règle des fiches : la séparation se fait au blanc. */}
      <div className="container mx-auto max-w-5xl px-4 py-12 md:px-8 md:py-16">
        <ol className="flex flex-col">
          {contenu.entrees.map((e, i) => (
            <li
              key={e.date}
              className={`flex flex-col gap-4 py-8 md:flex-row md:gap-10 ${
                i === 0 ? "" : "border-t border-border/50"
              }`}
            >
              <div className="md:w-40 md:shrink-0">
                <time
                  dateTime={e.date}
                  className="text-[13px] font-black tabular-nums tracking-tight text-foreground"
                >
                  {dateLisible(e.date)}
                </time>
              </div>
              <div className="flex flex-col gap-3 max-w-[62ch]">
                <h2 className="text-xl md:text-2xl font-black tracking-tight text-foreground leading-tight">
                  {e.titre}
                </h2>
                <p className="text-[15px] font-medium leading-relaxed text-muted-foreground">
                  {e.resume}
                </p>
                <ul className="flex flex-col gap-2">
                  {e.points.map((p) => (
                    <li key={p} className="flex gap-3">
                      <span className="mt-[0.7em] h-1 w-1 shrink-0 rounded-full bg-foreground/30" />
                      <span className="text-[14px] font-medium leading-relaxed text-muted-foreground">
                        {p}
                      </span>
                    </li>
                  ))}
                </ul>
                {e.lien ? (
                  <Link
                    href={e.lien.href}
                    className="mt-1 inline-flex w-fit items-center gap-1.5 text-[13px] font-black text-foreground hover:underline underline-offset-4"
                  >
                    {e.lien.label}
                    <ArrowRightIcon weight="bold" className="w-3.5 h-3.5" />
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ol>

        <p className="mt-6 text-[13px] font-medium text-muted-foreground/70">
          Le journal parle de la plateforme. Pour les produits eux-mêmes, la page{" "}
          <Link
            href="/discover"
            className="font-bold text-foreground hover:underline underline-offset-4"
          >
            Fraîchement shippé
          </Link>{" "}
          suit les dernières publications.
        </p>
      </div>
    </>
  );
}
