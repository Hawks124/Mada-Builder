import type { Metadata } from "next";
import Link from "next/link";
import { FilesIcon } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/dashboard/page-header";
import { ActionButton } from "@/components/ui/action-button";

// Auth pages are noindex (§7)
export const metadata: Metadata = {
  title: "Brouillons",
  robots: { index: false, follow: false },
};

// Brouillons — MOCK ASSUMÉ (les produits n'existent pas encore).
// Au milestone listings : liste réelle (autosave submit) → entrée vers
// /products/submit pré-rempli. Aucune fausse donnée d'ici là : état vide
// honnête uniquement.
export default function DashboardDraftsPage() {
  return (
    <div className="w-full px-6 lg:px-12 pt-10 lg:pt-14 pb-24 flex flex-col gap-10">
      <PageHeader
        title="Brouillons"
        subtitle="Vos fiches en cours — reprises exactement où vous les avez laissées."
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

      <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-border/60 bg-muted/20 px-6 py-16 text-center">
        <span className="h-12 w-12 rounded-2xl bg-muted/60 flex items-center justify-center">
          <FilesIcon weight="bold" className="h-6 w-6 text-muted-foreground" />
        </span>
        <div className="flex flex-col gap-1.5 max-w-sm">
          <p className="text-[15px] font-extrabold tracking-tight text-foreground">
            Aucun brouillon pour le moment
          </p>
          <p className="text-[13px] font-medium text-muted-foreground leading-relaxed">
            Quand la soumission sera finalisée, vos fiches non publiées s&apos;enregistreront ici
            automatiquement.
          </p>
        </div>
        <Link
          href="/products/submit"
          className="text-[13px] font-bold text-foreground underline decoration-border/60 underline-offset-4 hover:decoration-foreground transition-colors"
        >
          Commencer une fiche
        </Link>
      </div>
    </div>
  );
}
