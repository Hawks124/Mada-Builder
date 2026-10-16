import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  REVENUE_CONFIG_SPECS,
  REVENUE_LOGO_DARK_INVERT,
  REVENUE_PROVIDER_IDS,
} from "@/services/revenue/types";

/**
 * Table « Les 5 providers » du hub revenus vérifiés — pilotée par
 * `REVENUE_CONFIG_SPECS`, pas recopiée en markdown (le tableau en dur
 * dans le `.md` dupliquait formats de clé et champs extra : dérive
 * garantie au premier changement de scope côté provider).
 *
 * Serveur, zéro JS : mêmes classes que le rendu `Prose` des tableaux
 * (filet, thead micro-label, hover) pour une continuité visuelle avec
 * le reste du guide. Logo 18px + inversion dark par provider (même
 * liste que l'api-shell et les chips guides).
 */
export function ProviderTable() {
  return (
    <section aria-labelledby="les-5-providers">
      <h2
        id="les-5-providers"
        className="font-extrabold tracking-tight text-foreground text-balance text-2xl md:text-[1.75rem] mt-14 mb-4 scroll-mt-28"
      >
        Les 5 providers
      </h2>
      <div
        role="region"
        aria-label="Tableau de données"
        tabIndex={0}
        className="my-7 overflow-x-auto rounded-2xl border border-border/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground/40"
      >
        <table className="w-full border-collapse text-left text-[14px]">
          <thead className="border-b border-border">
            <tr>
              <th
                scope="col"
                className="whitespace-nowrap px-4 py-3 text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground"
              >
                Provider
              </th>
              <th
                scope="col"
                className="whitespace-nowrap px-4 py-3 text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground"
              >
                Clé à créer
              </th>
              <th
                scope="col"
                className="whitespace-nowrap px-4 py-3 text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground"
              >
                Infos en plus
              </th>
              <th
                scope="col"
                className="whitespace-nowrap px-4 py-3 text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground"
              >
                Fiche pas-à-pas
              </th>
            </tr>
          </thead>
          <tbody className="[&>tr]:border-b [&>tr]:border-border/50 [&>tr:last-child]:border-0">
            {REVENUE_PROVIDER_IDS.map((id) => {
              const spec = REVENUE_CONFIG_SPECS[id];
              return (
                <tr key={id} className="transition-colors hover:bg-muted/40">
                  <td className="px-4 py-3 align-top font-medium text-muted-foreground">
                    <span className="inline-flex items-center gap-2 font-bold text-foreground">
                      <Image
                        src={spec.logo}
                        alt=""
                        aria-hidden="true"
                        width={20}
                        height={20}
                        className={cn(
                          "h-[18px] w-[18px] shrink-0 object-contain",
                          REVENUE_LOGO_DARK_INVERT.includes(id) && "dark:brightness-0 dark:invert",
                        )}
                      />
                      {spec.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top font-medium text-muted-foreground">
                    <code className="rounded-md border border-border/60 bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">
                      {spec.keyFormat.example}
                    </code>
                    <span className="text-muted-foreground"> (lecture seule)</span>
                  </td>
                  <td className="px-4 py-3 align-top font-medium text-muted-foreground">
                    {spec.extraFields.length > 0
                      ? spec.extraFields.map((f) => f.label).join(" + ")
                      : "—"}
                  </td>
                  <td className="px-4 py-3 align-top font-medium text-muted-foreground">
                    <Link
                      href={`/guides/revenus-verifies/${spec.guideSlug}#creer-la-cle`}
                      className="font-bold text-foreground underline decoration-border decoration-2 underline-offset-[3px] transition-colors hover:decoration-foreground"
                    >
                      Guide {spec.label}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
