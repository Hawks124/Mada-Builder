import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = {
  title: "Page introuvable",
  description: "Cette page n'existe pas — ou plus. Retournez à l'annuaire.",
  robots: { index: false, follow: false },
};

/**
 * 404 globale (D6) : remplace le placeholder Next par la langue visuelle
 * du site (EmptyState astronaute). Une impasse sans issue est un
 * abandon — chaque 404 propose la suite (accueil, découverte).
 */
export default function NotFound() {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <EmptyState
        title="Perdu dans l'espace ?"
        description="Cette page n'existe pas — ou plus. Un lien a peut-être changé, ou ce que vous cherchez a été retiré."
        action={
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/"
              className="rounded-full bg-foreground px-6 py-2.5 text-[13px] font-bold text-background hover:opacity-90 transition-opacity"
            >
              Retour à l&apos;accueil
            </Link>
            <Link
              href="/discover"
              className="text-[13px] font-bold text-foreground underline decoration-border/60 underline-offset-4 hover:decoration-foreground transition-colors"
            >
              Découvrir les produits
            </Link>
          </div>
        }
      />
    </main>
  );
}
