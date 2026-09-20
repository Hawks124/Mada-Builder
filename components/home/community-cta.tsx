"use client";

import Link from "next/link";
import { FacebookLogo } from "@phosphor-icons/react";
import { GridBackground } from "@/components/ui/grid-background";

export function CommunityCTA() {
  return (
    <section className="relative w-full bg-background pt-24 pb-32 lg:py-40 border-t border-border/20 overflow-hidden">
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
      `}</style>

      {/* Metal glow (deepest layer) */}
      <div className="cta-metal absolute inset-0 pointer-events-none" />

      {/* Grid overlay using shared GridBackground — masked so it only appears strictly on the right */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          WebkitMaskImage:
            "radial-gradient(ellipse 80% 90% at 85% 50%, black 0%, transparent 72%)",
          maskImage:
            "radial-gradient(ellipse 80% 90% at 85% 50%, black 0%, transparent 72%)",
        }}
      >
        <GridBackground
          variant="css"
          showGlows={false}
          showBottomFade={false}
        />
      </div>

      <div className="container px-4 md:px-8 max-w-7xl mx-auto relative z-10 min-h-105 flex items-center">
        <div className="relative z-10 flex flex-col items-start gap-6 w-full">
          {/* Badge — spinning conic border */}
          <div className="relative group flex overflow-hidden rounded-full p-[1.5px] w-fit">
            <div className="absolute inset-0 bg-border/40 rounded-full" />
            <div
              className="absolute left-1/2 top-1/2 h-[400%] w-[400%] -translate-x-1/2 -translate-y-1/2 animate-[spin_4s_linear_infinite] dark:hidden opacity-40"
              style={{
                background:
                  "conic-gradient(from 0deg at 50% 50%, transparent 0%, transparent 40%, rgba(0,0,0,0.5) 48%, rgba(0,0,0,0.9) 50%, transparent 50%, transparent 90%, rgba(0,0,0,0.5) 98%, rgba(0,0,0,0.9) 100%)",
              }}
            />
            <div
              className="absolute left-1/2 top-1/2 h-[400%] w-[400%] -translate-x-1/2 -translate-y-1/2 animate-[spin_4s_linear_infinite] hidden dark:block opacity-40"
              style={{
                background:
                  "conic-gradient(from 0deg at 50% 50%, transparent 0%, transparent 40%, rgba(255,255,255,0.5) 48%, rgba(255,255,255,0.9) 50%, transparent 50%, transparent 90%, rgba(255,255,255,0.5) 98%, rgba(255,255,255,0.9) 100%)",
              }}
            />
            <span className="relative px-4 py-1.5 rounded-full bg-background text-foreground text-sm font-semibold z-10">
              Rejoindre le mouvement
            </span>
          </div>

          {/* Title: 2 lines — long first + short "punch" second, bleeds across the grid */}
          <h2 className="text-5xl md:text-6xl lg:text-[5.5rem] xl:text-[6rem] font-black tracking-tighter text-foreground leading-[0.95] mt-1 w-full">
            <span className="block">Bâtissons la souveraineté</span>
            <span className="block text-muted-foreground">
              numérique locale.
            </span>
          </h2>

          <p className="text-lg md:text-xl font-medium text-muted-foreground tracking-tight leading-relaxed max-w-2xl">
            L'époque où l'on construisait dans l'ombre en dépendant de plateformes 
            étrangères par défaut est révolue. Reprenons le contrôle de notre visibilité, 
            rassemblons nos pairs, et prouvons la valeur réelle de l'ingénierie malgache.
          </p>

          <Link
            href="https://facebook.com/groups/malagasytech"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex items-center gap-2 px-8 py-4 rounded-full bg-foreground text-background hover:scale-105 transition-all duration-300 font-bold text-sm md:text-base shadow-xl dark:shadow-[0_0_30px_rgba(255,255,255,0.08)]"
          >
            <FacebookLogo
              weight="fill"
              className="w-5 h-5"
              style={{ color: "#1877F2" }}
            />
            Ouvrir le groupe Facebook
          </Link>
        </div>
      </div>
    </section>
  );
}
