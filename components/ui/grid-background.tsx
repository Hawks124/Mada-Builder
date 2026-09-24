import { cn } from "@/lib/utils";

interface GridBackgroundProps {
  className?: string;
  /** "svg" = current grid.svg mask (default) | "css" = pure CSS inline grid */
  variant?: "svg" | "css";
  /** Whether to show the red/green ambient glows (defaults to true) */
  showGlows?: boolean;
  /** Whether to show the fade out to background color at the bottom (defaults to true) */
  showBottomFade?: boolean;
}

export function GridBackground({
  className,
  variant = "svg",
  showGlows = true,
  showBottomFade = true,
}: GridBackgroundProps) {
  return (
    <div className={cn("absolute inset-0 -z-10 pointer-events-none overflow-hidden", className)}>
      {/* Soul: Madagascar Flag Homage Glow */}
      {showGlows && (
        <>
          <div className="absolute top-[0%] left-[5%] w-[45%] h-[45%] bg-red-600/5 dark:bg-red-500/10 rounded-full blur-[140px]" />
          <div className="absolute top-[10%] right-[5%] w-[45%] h-[55%] bg-green-600/5 dark:bg-green-500/10 rounded-full blur-[140px]" />
        </>
      )}

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
          `}</style>
          <div className="grid-bg-css-light absolute inset-0 w-full h-[150%]" />
        </>
      )}

      {/* Subtle fade at the bottom to blend with content below the fold */}
      {showBottomFade && (
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-background via-background/90 to-transparent" />
      )}
    </div>
  );
}
