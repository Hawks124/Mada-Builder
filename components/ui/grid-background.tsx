import { cn } from "@/lib/utils";

interface GridBackgroundProps {
  className?: string;
  /** "svg" = current grid.svg mask (default) | "css" = pure CSS inline grid */
  variant?: "svg" | "css";
  /** Whether to show the red/green ambient glows (defaults to true) */
  showGlows?: boolean;
  /** Whether to show the fade out to background color at the bottom (defaults to true) */
  showBottomFade?: boolean;
  /**
   * "default" = % glows ancrés en haut (grandes zones, ex. home).
   * "centered" = tailles fixes centrées verticalement (headers courts :
   * les % + blur 140 sur ~380px diffusent jusqu'à l'invisible).
   */
  glowPlacement?: "default" | "centered";
  /**
   * Pour les surfaces **inversées** (`bg-foreground text-background`).
   *
   * Les deux couleurs de la grille et le fondu bas sont calés sur une toile
   * claire, donc ils sont faux sur un bandeau inversé : en thème clair le
   * bandeau est presque noir et la grille claire y disparaît, et le fondu
   * bas y verse du `background` clair par-dessus. `inverted` retourne la
   * correspondance — grille blanche discrète sur bandeau sombre en thème
   * clair, grille sombre discrète sur bandeau blanc en thème sombre.
   *
   * Défaut `false` : les huit appelants existants sont inchangés.
   *
   * **S'applique à la variante `css`.** La variante `svg` s'appuie sur
   * `bg-border`, qui bascule avec le thème mais pas avec une surface
   * inversée : elle demanderait un mask propre, pas un simple retournement de
   * couleur. À ne pas combiner sans traitement.
   *
   * **Utiliser `isolate` sur la section inversée.** Ce composant est en
   * `-z-10`, ce qui fonctionne sur une section sans fond mais le ferait
   * disparaître derrière le `bg-foreground` d'un bandeau. `isolate` fait de
   * la section le contexte d'empilement : la grille se peint alors au-dessus
   * du fond et en dessous du contenu.
   */
  inverted?: boolean;
}

export function GridBackground({
  className,
  variant = "svg",
  showGlows = true,
  showBottomFade = true,
  glowPlacement = "default",
  inverted = false,
}: GridBackgroundProps) {
  return (
    <div className={cn("absolute inset-0 -z-10 pointer-events-none overflow-hidden", className)}>
      {/* Soul: Madagascar Flag Homage Glow */}
      {showGlows &&
        (glowPlacement === "centered" ? (
          <>
            <div className="absolute left-[6%] top-1/2 -translate-y-1/2 w-[440px] h-[300px] bg-red-600/[0.07] dark:bg-red-500/[0.12] rounded-full blur-[100px]" />
            <div className="absolute right-[4%] top-1/2 -translate-y-1/2 w-[440px] h-[320px] bg-green-600/[0.07] dark:bg-green-500/[0.12] rounded-full blur-[100px]" />
          </>
        ) : (
          <>
            <div className="absolute top-[0%] left-[5%] w-[45%] h-[45%] bg-red-600/5 dark:bg-red-500/10 rounded-full blur-[140px]" />
            <div className="absolute top-[10%] right-[5%] w-[45%] h-[55%] bg-green-600/5 dark:bg-green-500/10 rounded-full blur-[140px]" />
          </>
        ))}

      {variant === "svg" ? (
        /* ── SVG GRID (current) ── */
        <div
          className="absolute inset-0 w-full h-[150%] bg-border"
          style={{
            maskImage: "url('/grid.svg')",
            maskRepeat: "repeat",
            WebkitMaskImage: "url('/grid.svg')",
            WebkitMaskRepeat: "repeat",
            maskSize: "50px 50px",
            WebkitMaskSize: "50px 50px",
          }}
        />
      ) : (
        /* ── CSS GRID (extracted from CTA) ── */
        <>
          {/* CSS inline grid — no external asset needed, auto-adapts to theme */}
          <style>{`
            .grid-bg-css-light {
              background-image:
                linear-gradient(to right, rgba(120,120,120,0.13) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(120,120,120,0.13) 1px, transparent 1px);
              background-size: 44px 44px;
            }
            .dark .grid-bg-css-light {
              background-image:
                linear-gradient(to right, rgba(200,200,200,0.09) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(200,200,200,0.09) 1px, transparent 1px);
              background-size: 44px 44px;
            }
            /* Bandeau inversé : la toile est inversée, donc la grille aussi.
               En thème clair le bandeau est sombre → trait clair ; en thème
               sombre il est clair → trait sombre. */
            .grid-bg-css-inverted {
              background-image:
                linear-gradient(to right, rgba(250,250,250,0.10) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(250,250,250,0.10) 1px, transparent 1px);
              background-size: 44px 44px;
            }
            .dark .grid-bg-css-inverted {
              background-image:
                linear-gradient(to right, rgba(9,9,11,0.12) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(9,9,11,0.12) 1px, transparent 1px);
              background-size: 44px 44px;
            }
          `}</style>
          <div
            className={
              inverted
                ? "grid-bg-css-inverted absolute inset-0 w-full h-[150%]"
                : "grid-bg-css-light absolute inset-0 w-full h-[150%]"
            }
          />
        </>
      )}

      {/* Subtle fade at the bottom to blend with content below the fold */}
      {showBottomFade && (
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-background via-background/90 to-transparent" />
      )}
    </div>
  );
}
