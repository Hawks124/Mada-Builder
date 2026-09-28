"use client";

import Link from "next/link";
import { FacebookLogo, ArrowRight } from "@phosphor-icons/react";
import { GridBackground } from "@/components/ui/grid-background";
import { CommunityArmillary } from "@/components/home/community-armillary";
import { FACEBOOK_GROUP_URL } from "@/components/navbar/community-dropdown";

export function CommunityCTA() {
  return (
    <section className="relative w-full bg-background pt-20 pb-24 lg:py-28 border-t border-border/20 overflow-hidden">
      <style>{`
        /* Monochrome metallic glow — layered radials simulating brushed steel reflections */
        .cta-metal {
          background:
            radial-gradient(ellipse 45% 55% at 90% 30%, rgba(180,180,190,0.22) 0%, transparent 60%),
            radial-gradient(ellipse 60% 40% at 75% 70%, rgba(150,150,160,0.15) 0%, transparent 55%),
            radial-gradient(ellipse 35% 50% at 95% 55%, rgba(220,220,230,0.18) 0%, transparent 50%);
        }
        .dark .cta-metal {
          background:
            radial-gradient(ellipse 45% 55% at 90% 30%, rgba(255,255,255,0.04) 0%, transparent 60%),
            radial-gradient(ellipse 60% 40% at 75% 70%, rgba(255,255,255,0.025) 0%, transparent 55%),
            radial-gradient(ellipse 35% 50% at 95% 55%, rgba(255,255,255,0.05) 0%, transparent 50%);
        }
        
        /* Monochromatic Sweep Animation */
        @keyframes sweep {
          0% { transform: translateX(-200%); }
          100% { transform: translateX(200%); }
        }
        .animate-sweep {
          animation: sweep 4s infinite linear;
        }
      `}</style>

      {/* Metal glow (deepest layer) */}
      <div className="cta-metal absolute inset-0 pointer-events-none" />

      {/* Grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          WebkitMaskImage: "radial-gradient(ellipse 80% 90% at 85% 50%, black 0%, transparent 72%)",
          maskImage: "radial-gradient(ellipse 80% 90% at 85% 50%, black 0%, transparent 72%)",
        }}
      >
        <GridBackground variant="css" showGlows={false} showBottomFade={false} />
      </div>

      <div className="container px-4 md:px-8 max-w-7xl mx-auto relative z-10 py-4">
        <div className="grid grid-cols-1 items-center gap-x-16 gap-y-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.92fr)]">
          <div className="flex flex-col items-start gap-6">
            {/* Badge Monochrome (Réinventé) : Un outline fin avec un flash métallique */}
            <div className="group relative overflow-hidden rounded-full p-[1px] w-fit shadow-sm">
              <div className="absolute inset-0 bg-foreground/20" />
              <div className="animate-sweep absolute inset-0 w-[150%] bg-gradient-to-r from-transparent via-foreground/50 to-transparent" />
              <div className="relative bg-background px-4 py-1.5 rounded-full flex items-center gap-2 transition-colors group-hover:bg-background/80">
                <div className="h-1.5 w-1.5 rounded-full bg-foreground/60" />
                <span className="text-foreground font-semibold text-xs uppercase tracking-widest">
                  Rejoindre le mouvement
                </span>
              </div>
            </div>

            {/* Titre (Stark Monochrome) */}
            <h2 className="text-[2rem] sm:text-[2.25rem] lg:text-[3.25rem] xl:text-[4rem] font-black tracking-tighter text-foreground leading-[0.92]">
              <span className="block">Bâtissons</span>
              <span className="block">la souveraineté</span>
              <span className="block text-muted-foreground">numérique locale.</span>
            </h2>

            <p className="text-lg md:text-xl font-medium text-muted-foreground tracking-tight leading-relaxed max-w-xl">
              L&apos;époque où l&apos;on construisait dans l&apos;ombre en dépendant de plateformes
              étrangères par défaut est révolue. Reprenons le contrôle de notre visibilité,
              rassemblons nos pairs, et prouvons la valeur réelle de l&apos;ingénierie malgache.
            </p>

            {/* Bouton High-End Monochrome */}
            <Link
              href={FACEBOOK_GROUP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative mt-2 flex items-center gap-3 px-8 py-4 rounded-full bg-foreground text-background transition-all duration-300 hover:scale-[1.02] active:scale-95 shadow-xl hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)] dark:hover:shadow-[0_8px_30px_rgba(255,255,255,0.08)]"
            >
              <FacebookLogo
                weight="fill"
                className="w-5 h-5 text-background transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-110"
              />
              <span className="font-bold text-sm md:text-base">Ouvrir le groupe Facebook</span>
              <div className="ml-1 flex h-6 w-6 items-center justify-center rounded-full bg-background/10 transition-transform duration-300 group-hover:translate-x-1">
                <ArrowRight weight="bold" className="w-3.5 h-3.5 text-background" />
              </div>
            </Link>
          </div>

          <div className="relative hidden lg:flex items-center justify-center min-h-[450px]">
            <CommunityArmillary />
          </div>
        </div>
      </div>
    </section>
  );
}
