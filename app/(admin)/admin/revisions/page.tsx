import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ReviewVerdict } from "@/components/admin/review-verdict";
import { listPendingRevisions } from "@/services/products.service";
import { PRODUCT_LINK_FIELDS } from "@/config/product-links";
import { waitingFr } from "@/lib/utils";

// noindex strict — jamais indexé, même au backend.
export const metadata: Metadata = {
  title: "Admin — Révisions",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Libellés lisibles des champs sensibles (le diff, pas des clés brutes). */
const FIELD_LABELS: Record<string, string> = {
  name: "Nom",
  tagline: "Tagline",
  description: "Description",
  links: "Liens",
  tags: "Tags",
  requirements: "Configuration requise",
  installCommand: "Commande d'installation",
};

function linkLabel(id: string): string {
  return PRODUCT_LINK_FIELDS[id]?.label ?? id;
}

function excerpt(value: unknown, max = 220): string {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object" && value !== null) {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${linkLabel(k)} : ${String(v)}`)
      .join(" · ");
  }
  const s = typeof value === "string" ? value : String(value ?? "");
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

/**
 * File des RÉVISIONS : les fiches PUBLIÉES dont le contenu sensible a
 * été modifié.
 *
 * La fiche reste en ligne avec son contenu validé (règle des stores) :
 * ce qui attend ici, c'est la nouvelle version du texte et des médias.
 * Approuver → appliqué ; refuser → la fiche garde son contenu validé.
 */
export default async function AdminRevisionsPage() {
  const revisions = await listPendingRevisions({ isStaff: true }).catch(() => []);

  return (
    <div className="w-full px-6 lg:px-12 pt-10 lg:pt-14 pb-24 flex flex-col gap-10">
      <PageHeader
        title="Révisions"
        subtitle={
          revisions.length > 0
            ? `${revisions.length} fiche(s) en ligne dont le contenu attend un regard — la version publique n'a pas bougé.`
            : "Aucune fiche publiée n'a de modification en attente."
        }
      />

      {revisions.length === 0 ? (
        <EmptyState
          size="sm"
          title="Aucune révision en attente"
          description="Les modifications du contenu sensible des fiches publiées arrivent ici."
        />
      ) : (
        <div className="flex flex-col gap-6">
          {revisions.map((r) => {
            const fields = Object.entries(r.payload);
            const mediaChanged = Boolean(r.media?.logo) || (r.media?.shots?.length ?? 0) > 0;
            return (
              <section
                key={r.id}
                className="rounded-2xl border border-border/50 bg-muted/20 p-6 flex flex-col gap-5"
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <Link
                    href={`/products/${r.slug}`}
                    className="text-[17px] font-extrabold tracking-tight text-foreground hover:underline underline-offset-4"
                  >
                    {r.name}
                  </Link>
                  <span className="text-[13px] font-medium text-muted-foreground">
                    par {r.makerDisplayName} (@{r.makerUsername})
                  </span>
                  {r.pendingAt && (
                    <span className="text-[12px] font-semibold text-amber-600 dark:text-amber-400">
                      en attente depuis {waitingFr(r.pendingAt)}
                    </span>
                  )}
                </div>

                {fields.length === 0 && !mediaChanged ? (
                  <p className="text-[13px] font-medium text-muted-foreground">
                    Aucun changement de contenu — probablement une Média.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-4">
                    {fields.map(([field, value]) => (
                      <li key={field} className="flex flex-col gap-1.5">
                        <span className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                          {FIELD_LABELS[field] ?? field}
                        </span>
                        <p className="text-[13px] font-medium leading-relaxed text-foreground/90 whitespace-pre-line break-words">
                          {excerpt(value)}
                        </p>
                      </li>
                    ))}
                    {mediaChanged && (
                      <li className="flex flex-col gap-1.5">
                        <span className="text-[11px] font-black uppercase tracking-[0.16em] text-muted-foreground">
                          Médias
                        </span>
                        <p className="text-[13px] font-medium text-foreground/90">
                          {r.media?.logo ? "Nouveau logo. " : ""}
                          {r.media?.shots?.length
                            ? `${r.media.shots.length} nouvelle(s) capture(s).`
                            : ""}
                        </p>
                      </li>
                    )}
                  </ul>
                )}

                <ReviewVerdict
                  productId={r.id}
                  productName={r.name}
                  kind="revision"
                  approveLabel="Appliquer la révision"
                  rejectLabel="Refuser (garder le contenu validé)"
                />
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
