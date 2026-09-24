import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";
import { ActionButton } from "@/components/ui/action-button";
import { HeroSubmitCta } from "./hero-submit-cta";
import { HeroMakers } from "./hero-makers";
import { HeroCategories } from "@/components/home/hero-categories";

export function Hero() {
  return (
    <div className="container px-4 md:px-8 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-8 z-10 w-full pt-8 md:pt-12 lg:pt-20 pb-32">
      {/* Left Column: Typography & CTAs */}
      <div className="flex flex-col items-start text-left space-y-6">
        {/* Makers vivants — derniers inscrits + total réel (mock sans backend) */}
        <HeroMakers />

        {/* Values pill — reprend le design eyebrow d'origine */}
        <span className="inline-flex items-center gap-2 rounded-full px-3.5 py-1 text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground max-w-full">
          Gratuite · Ouvert à tous · Zéro ban arbitraire · 100 % malagasy
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

            {/* Submit CTA — session-aware (?next= si anonyme) */}
            <HeroSubmitCta />
          </div>

          {/* Micro-label de réassurance — sous le CTA, pas dans le subtitle */}
          <p className="text-[12px] text-muted-foreground/70 pl-1">
            Gratuit · Publié en moins de 24 h · Sans compte requis pour parcourir
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
