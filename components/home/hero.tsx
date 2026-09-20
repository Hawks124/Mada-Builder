import Link from "next/link";
import { ArrowRightIcon, PlusIcon } from "@phosphor-icons/react";
import { ActionButton } from "@/components/ui/action-button";
import { HeroCategories } from "@/components/home/hero-categories";

// Data-driven — requête makers réels au backend (top contributeurs,
// profils publics uniquement). Mock aujourd'hui, même composant demain.
const MOCK_AVATARS = [
  {
    username: "kaliana",
    avatarUrl: "https://i.pravatar.cc/150?u=a042581f4e29026024d",
  },
  {
    username: "bryl",
    avatarUrl: "https://i.pravatar.cc/150?u=a04258a2462d826712d",
  },
  {
    username: "jas",
    avatarUrl: "https://i.pravatar.cc/150?u=a042581f4e29026704d",
  },
  {
    username: "lorenz-edward",
    avatarUrl: "https://i.pravatar.cc/150?u=a04258114e29026702d",
  },
  {
    username: "mauries-lopez",
    avatarUrl: "https://i.pravatar.cc/150?u=b042581f4e29026704d",
  },
];

export function Hero() {
  return (
    <div className="container px-4 md:px-8 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-8 z-10 w-full pt-8 md:pt-12 lg:pt-20 pb-32">
      {/* Left Column: Typography & CTAs */}
      <div className="flex flex-col items-start text-left space-y-6">
        {/* Social Proof Avatars (No surcontainer) */}
        <div className="flex items-center gap-3 mb-2">
          <div className="flex -space-x-2.5">
            {MOCK_AVATARS.map((maker, i) => (
              <Link
                key={maker.username}
                href={`/makers/${maker.username}`}
                aria-label={`Voir le profil de ${maker.username}`}
                className="relative transition-transform duration-300 hover:-translate-y-1 hover:z-20"
                style={{ zIndex: 10 - i }}
              >
                <img
                  src={maker.avatarUrl}
                  alt={`Maker malgache ${maker.username}`}
                  className="h-8 w-8 rounded-full border-[2.5px] border-background object-cover grayscale opacity-70 hover:grayscale-0 hover:opacity-100 transition-all duration-300"
                />
              </Link>
            ))}
          </div>
          <div className="text-[14px] font-medium text-muted-foreground">
            Rejoignez{" "}
            <strong className="text-foreground tracking-tight font-bold">
              1,200+ builders
            </strong>
          </div>
        </div>

        {/* Values pill — reprend le design eyebrow d'origine */}
        <span className="inline-flex items-center gap-2 rounded-full px-3.5 py-1 text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground max-w-full">
          Soumission gratuite · Ouvert à tous · Zéro ban arbitraire · 100 %
          local
        </span>

        {/* Huge Title (Maintained for branding as per PRD) */}
        <h1 className="text-[2.75rem] sm:text-6xl lg:text-[5.5rem] font-extrabold tracking-tighter leading-[1.03]">
          Ce que tu construis ici,
          <br />
          <span className="text-muted-foreground">on le voit ici.</span>
        </h1>

        {/* SEO Optimized Subtitle — tone unified to "tu" */}
        <p className="max-w-137.5 text-muted-foreground text-[17px] md:text-lg font-medium tracking-tight leading-relaxed pt-1">
          {
            "L'annuaire de référence des produits tech malgaches. Découvre les SaaS, applications et outils créés à Madagascar. Publie ton projet, prouve tes revenus, et gagne en visibilité."
          }
        </p>

        <div className="flex flex-col items-center sm:items-start gap-2 pt-5 w-full">
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <ActionButton href="/discover" variant="primary">
              Découvrir les produits
              <ArrowRightIcon weight="bold" className="h-4 w-4" />
            </ActionButton>

            {/* Submit CTA — même animated border que HeroCategories */}
            <div className="relative group w-full sm:w-auto flex overflow-hidden rounded-full p-[1.5px]">
              {/* Base track */}
              <div className="absolute inset-0 bg-border/40 rounded-full" />
              {/* Spinning comet — light mode */}
              <div
                className="absolute left-1/2 top-1/2 h-[400%] w-[400%] -translate-x-1/2 -translate-y-1/2 animate-[spin_3.5s_linear_infinite] dark:hidden opacity-50 group-hover:opacity-100 transition-opacity duration-500"
                style={{
                  background:
                    "conic-gradient(from 0deg at 50% 50%, transparent 0%, transparent 40%, rgba(0,0,0,0.6) 48%, rgba(0,0,0,1) 50%, transparent 50%, transparent 90%, rgba(0,0,0,0.6) 98%, rgba(0,0,0,1) 100%)",
                }}
              />
              {/* Spinning comet — dark mode */}
              <div
                className="absolute left-1/2 top-1/2 h-[400%] w-[400%] -translate-x-1/2 -translate-y-1/2 animate-[spin_3.5s_linear_infinite] hidden dark:block opacity-50 group-hover:opacity-100 transition-opacity duration-500"
                style={{
                  background:
                    "conic-gradient(from 0deg at 50% 50%, transparent 0%, transparent 40%, rgba(255,255,255,0.6) 48%, rgba(255,255,255,1) 50%, transparent 50%, transparent 90%, rgba(255,255,255,0.6) 98%, rgba(255,255,255,1) 100%)",
                }}
              />
              <ActionButton
                href="/products/submit"
                variant="outline"
                className="relative w-full border-0! shadow-none! rounded-full bg-background hover:bg-background"
              >
                <PlusIcon
                  weight="bold"
                  className="h-4 w-4 text-muted-foreground"
                />
                Soumettre un produit
              </ActionButton>
            </div>
          </div>

          {/* Micro-label de réassurance — sous le CTA, pas dans le subtitle */}
          <p className="text-[12px] text-muted-foreground/70 pl-1">
            Gratuit · Publié en moins de 24 h · Sans compte requis pour
            parcourir
          </p>
        </div>
      </div>

      {/* Right Column: Featured Section - HIDDEN ON MOBILE */}
      <div className="hidden lg:flex flex-col items-center justify-center w-full">
        <HeroCategories />
      </div>
    </div>
  );
}
