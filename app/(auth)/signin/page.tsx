import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Bricolage_Grotesque } from "next/font/google";
import { GridBackground } from "@/components/ui/grid-background";
import { SigninForm } from "@/components/auth/signin-form";
import { LogoMark } from "@/components/ui/logo";
import { cn } from "@/lib/utils";

const displayFont = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: "800",
});

export const metadata: Metadata = {
  title: "Connexion | Mada-Made",
  robots: { index: false, follow: false },
};

export default function SigninPage() {
  return (
    <div className="min-h-screen bg-background flex overflow-hidden selection:bg-foreground selection:text-background">
      {/* ── Colonne Gauche — Le Formulaire ── */}
      <div className="shrink-0 w-full lg:w-[45%] xl:w-[40%] flex flex-col justify-center px-8 sm:px-16 py-12 z-20 bg-background/80 backdrop-blur-2xl lg:bg-background lg:backdrop-blur-none border-r border-border/40 shadow-[20px_0_40px_rgba(0,0,0,0.02)] dark:shadow-none">
        <div className="max-w-md w-full mx-auto">
          <Link href="/" className="flex items-center gap-3 w-fit mb-14 group">
            <LogoMark className="h-10 w-10 shadow-sm transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-3" />
            <span className="font-bold text-lg tracking-tight text-foreground">
              Mada-Made
            </span>
          </Link>

          {/* Titres + formulaires rendus par SigninForm (accueil vs vérification). */}
          <Suspense>
            <SigninForm />
          </Suspense>
        </div>
      </div>

      {/* ── Colonne Droite — L'Expérience "Wow" ── */}
      <div className="hidden lg:flex flex-1 relative flex-col justify-center items-start bg-zinc-50 dark:bg-zinc-950 overflow-hidden px-12 xl:px-24">
        {/* 2. Le Grid d'origine */}
        <div className="absolute inset-0 pointer-events-none opacity-80 mix-blend-multiply dark:mix-blend-screen">
          <GridBackground variant="css" />
        </div>

        {/* 3. Le Slogan Typographique (Raffiné) */}
        <div className="relative z-10 flex flex-col w-full select-none mt-[-10vh]">
          <div
            className={cn(
              displayFont.className,
              "text-[5.5vw] text-foreground leading-[0.9] tracking-tighter drop-shadow-sm",
            )}
          >
            Ce que tu
          </div>

          {/* Le mot transparent avec un contour plus épais pour capter la couleur du fond */}
          <div
            className={cn(
              displayFont.className,
              "text-[11vw] leading-[0.85] tracking-tighter text-transparent my-1 -ml-2 drop-shadow-md",
            )}
            style={{ WebkitTextStroke: "3px var(--color-foreground)" }}
          >
            construis
          </div>

          <div
            className={cn(
              displayFont.className,
              "text-[5.5vw] text-foreground leading-[0.9] tracking-tighter ml-[1vw] drop-shadow-sm",
            )}
          >
            ici,
          </div>

          {/* Bloc secondaire structuré avec une belle touche de couleur */}
          <div className="flex flex-col mt-[4vh] ml-[25vw] border-l-4 border-orange-500/50 pl-6 xl:pl-10">
            <div
              className={cn(
                displayFont.className,
                "text-[4vw] text-muted-foreground/40 dark:text-muted-foreground/60 leading-[0.85] tracking-tighter",
              )}
            >
              on le
            </div>
            <div
              className={cn(
                displayFont.className,
                "text-[4vw] text-muted-foreground/40 dark:text-muted-foreground/60 leading-[0.85] tracking-tighter",
              )}
            >
              voit
            </div>
            <div
              className={cn(
                displayFont.className,
                "text-[4vw] text-muted-foreground/40 dark:text-muted-foreground/60 leading-[0.85] tracking-tighter",
              )}
            >
              ici.
            </div>
          </div>
        </div>

        {/* 4. L'Élément Extra : La Carte de Citation (Glassmorphism) */}
        {/* <div className="absolute bottom-12 right-12 z-20 max-w-sm rounded-2xl bg-white/40 dark:bg-zinc-900/40 backdrop-blur-xl border border-white/40 dark:border-zinc-800 p-6 shadow-2xl transition-transform duration-500 hover:-translate-y-2 cursor-default">
          <div className="flex gap-4 items-center mb-4">
            <div className="w-12 h-12 rounded-full bg-linear-to-tr from-orange-500 to-rose-500 p-[2px] shadow-lg">
              <div className="w-full h-full rounded-full bg-white dark:bg-zinc-950 flex items-center justify-center">
                <span className="font-bold text-sm text-foreground">JD</span>
              </div>
            </div>
            <div>
              <p className="font-bold text-foreground text-sm">Julien D.</p>
              <p className="text-xs text-muted-foreground font-medium">
                Top Builder du mois
              </p>
            </div>
          </div>
          <p className="text-[14px] font-medium text-foreground/80 leading-relaxed italic">
            "C'est ici que mon SaaS a décollé. La visibilité apportée par la
            communauté est juste incroyable."
          </p>
        </div> */}
      </div>
    </div>
  );
}
