import type { Metadata } from "next";
import { GridBackground } from "@/components/ui/grid-background";
import { CategoryStats } from "@/components/categories/category-index";
import {
  CategoriesControls,
  CategoriesFilterProvider,
  CategoriesList,
  type CategoryView,
} from "@/components/categories/categories-browser";
import {
  getCategoryStats,
  getCriteriaGroups,
  getDomainGroups,
} from "@/components/categories/category-data";

type SearchParams = Record<string, string | string[] | undefined>;

export const metadata: Metadata = {
  title: "Catégories des produits tech malgaches | Mada-Made",
  description:
    "Explorez les produits tech construits à Madagascar par catégorie, type, plateforme et modèle économique : fintech, santé, dev tools, IA et plus.",
};

/**
 * `/categories` — deux vues, une seule fourche.
 *
 * L'URL porte la vue (`?vue=criteres`) et c'est le serveur qui la résout :
 * les deux pages sont donc crawlables, et rien n'est caché au DOM. Le
 * visiteur choisit entre « par domaine » (l'index) et « par critère » (les
 * axes de filtrage) au lieu de devoir deviner dans laquelle des sections
 * se cache ce qu'il cherche.
 *
 * Le fond quadrillé couvre le header ET la barre de vue/recherche, puis se
 * dissout sur la moitié basse de cette zone. C'est pour ça que la barre de
 * contrôle (`CategoriesControls`) est rendue dans la zone mais la liste
 * (`CategoriesList`) en dehors : le fondu doit se terminer entre les deux,
 * et une hauteur fixe ne le ferait pas correctement en responsive.
 */
export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const view: CategoryView = sp.vue === "criteres" ? "critere" : "domaine";

  // Résolu et sérialisé côté serveur : les icônes des configs sont
  // serveur-only (cf. category-data.ts).
  const stats = getCategoryStats();
  const groups = view === "critere" ? getCriteriaGroups() : getDomainGroups();

  return (
    <CategoriesFilterProvider view={view} groups={groups}>
      <div className="flex flex-col w-full min-h-[calc(100vh-72px)]">
        {/* ── ZONE FOND : header + barre de vue/recherche ── */}
        <div className="relative w-full">
          <GridBackground variant="css" glowPlacement="centered" showBottomFade={false} />
          {/* Fondu maison sur la moitié basse : le quadrillage se dissout
              progressivement jusqu'à la recherche au lieu de s'arrêter net. */}
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-background via-background/70 to-transparent pointer-events-none" />

          <div className="relative container px-4 md:px-8 max-w-7xl mx-auto py-10">
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2">
              Annuaire
            </p>
            <h1 className="text-3xl md:text-[2.5rem] font-extrabold tracking-tighter text-foreground leading-none">
              Explorer par catégorie
            </h1>
            <p className="text-muted-foreground font-medium md:text-lg tracking-tight mt-2 max-w-2xl">
              Tous les produits tech construits par les makers malgaches, regroupés par domaine
              d&apos;application.
            </p>
            <CategoryStats
              categoryCount={stats.categoryCount}
              typeCount={stats.typeCount}
              productCount={stats.productCount}
            />
          </div>

          <div className="relative container px-4 md:px-8 max-w-7xl mx-auto pt-10 pb-16">
            <CategoriesControls />
          </div>
        </div>

        {/* ── LISTE : au-delà du fondu, sur fond plat ── */}
        <section className="container px-4 md:px-8 max-w-7xl mx-auto w-full pb-24">
          <CategoriesList />
        </section>
      </div>
    </CategoriesFilterProvider>
  );
}
