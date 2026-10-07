import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PencilSimpleIcon } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/dashboard/page-header";
import { ActionButton } from "@/components/ui/action-button";
import { EmptyState } from "@/components/ui/empty-state";
import { DraftDeleteButton } from "@/components/dashboard/draft-delete-button";
import { getSessionUser } from "@/lib/supabase/server";
import { fetchMyProducts } from "@/services/products.service";

// Auth pages are noindex (§7)
export const metadata: Metadata = {
  title: "Brouillons",
  robots: { index: false, follow: false },
};

// Toujours dynamique (données personnelles — cf. overview).
export const dynamic = "force-dynamic";

function updatedFr(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

// Brouillons réels : fiches `draft` du maker — reprise exacte via
// /products/submit?edit=<id> (pré-rempli), suppression RGPD.
export default async function DashboardDraftsPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/signin?next=/dashboard/drafts");
  const { items: rows } = await fetchMyProducts(sessionUser.id);
  const drafts = rows.filter((r) => r.status === "draft");

  return (
    <div className="w-full px-6 lg:px-12 pt-10 lg:pt-14 pb-24 flex flex-col gap-10">
      <PageHeader
        title="Brouillons"
        subtitle={
          drafts.length === 0
            ? "Vos fiches en cours — reprises exactement où vous les avez laissées."
            : `${drafts.length} fiche${drafts.length > 1 ? "s" : ""} en cours — reprenez où vous vous étiez arrêté.`
        }
        actions={
          <ActionButton
            href="/products/submit"
            variant="primary"
            isFullWidthOnMobile={false}
            className="h-11! px-6! text-[14px]!"
          >
            Nouveau produit
          </ActionButton>
        }
      />

      {drafts.length === 0 ? (
        <EmptyState
          title="Aucun brouillon pour le moment"
          description="Enregistrez une fiche comme brouillon depuis la soumission — elle apparaîtra ici."
          action={
            <Link
              href="/products/submit"
              className="text-[13px] font-bold text-foreground underline decoration-border/60 underline-offset-4 hover:decoration-foreground transition-colors"
            >
              Commencer une fiche
            </Link>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {drafts.map((d) => (
            <li
              key={d.id}
              className="flex items-center gap-4 rounded-2xl border border-border/40 bg-muted/20 px-5 py-4"
            >
              <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                <p className="text-[15px] font-extrabold tracking-tight text-foreground truncate">
                  {d.name}
                </p>
                <p className="text-[13px] font-medium text-muted-foreground truncate">
                  {d.tagline}
                </p>
                <p className="text-[12px] font-medium text-muted-foreground/70">
                  Modifié le {updatedFr(d.updatedAt)}
                </p>
              </div>
              <Link
                href={`/products/submit?edit=${d.id}`}
                aria-label={`Reprendre ${d.name}`}
                className="shrink-0 flex items-center gap-1.5 rounded-full border border-border/40 px-4 py-2 text-[13px] font-bold text-muted-foreground hover:text-foreground hover:border-border/80 hover:bg-muted/50 transition-colors"
              >
                <PencilSimpleIcon weight="bold" className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Reprendre</span>
              </Link>
              <DraftDeleteButton productId={d.id} productName={d.name} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
