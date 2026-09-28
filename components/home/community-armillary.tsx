import { FlagMadagascar } from "@/components/ui/flag-madagascar";
import { cn } from "@/lib/utils";

/**
 * Constellation Isométrique (Next-Level 10x Engineering Vibe).
 *
 * - Pur CSS 3D avec un maillage de 5 composants (Hub, UI, API, Trace, Auth).
 * - SVG Isometric Background pour les chemins de données (laser traces).
 * - Animation "Hover Spread" complète pour un effet interactif.
 * - Le style est hébergé dans globals.css pour des perfs optimales.
 */
export function CommunityArmillary({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "group absolute inset-0 flex flex-col items-center justify-center gap-5 cursor-crosshair",
        className,
      )}
    >
      {/* Scène caméra 3D */}
      <div className="iso-scene relative h-[450px] w-[450px] shrink-0">
        {/* Le bloc central pivoté en perspective isométrique */}
        <div className="iso-container absolute inset-0 m-auto h-[400px] w-[400px]">
          {/* ----- OMBRE SOUS LA PILE (Ambient Occlusion) ----- */}
          {/* Correction critique : Remplacement du CSS filter blur par un radial-gradient pour éviter le bug de clipping 3D dans Safari/Chrome */}
          <div
            className="iso-shadow absolute top-[50%] left-[50%] h-[320px] w-[320px] rounded-full bg-[radial-gradient(ellipse,rgba(0,0,0,0.12)_0%,transparent_60%)] dark:bg-[radial-gradient(ellipse,rgba(255,255,255,0.08)_0%,transparent_60%)]"
            style={{ ["--shadow-z" as string]: "-120px" }}
          />

          {/* ----- BACKGROUND SVG: CIRCUIT LINES (STATIQUE) ----- */}
          {/* Fixé sous les cartes. Ne bouge pas au hover, les cartes s'en détachent ! */}
          <div
            className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] opacity-[0.25] dark:opacity-[0.15]"
            style={{ transform: "translateZ(-80px)" }}
          >
            <svg viewBox="0 0 400 400" className="w-full h-full overflow-visible">
              {/* Diagonales Main Backbone */}
              <path
                d="M 200 200 L 40 40"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                strokeDasharray="3 3"
                className="animate-[dash_6s_linear_infinite]"
              />
              <path
                d="M 200 200 L 360 360"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                strokeDasharray="3 3"
                className="animate-[dash_8s_linear_infinite_reverse]"
              />

              {/* Lignes Orthogonales secondaires (Les cercles statiques évitent les bugs d'échelle 3D de animate-ping) */}
              <path
                d="M 200 200 L 200 90 L 370 90"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.5"
              />
              <circle cx="370" cy="90" r="2" fill="currentColor" opacity="0.6" />

              <path
                d="M 200 200 L 80 200 L 80 340"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.5"
              />
              <circle cx="80" cy="340" r="2" fill="currentColor" opacity="0.6" />
            </svg>
          </div>

          {/* ----- 5. CARTE SATELLITE 1 (API TRACE) ----- */}
          <div
            className="iso-card-wrapper iso-wrapper-sat1 max-h-min"
            style={{ ["--w" as string]: "130px", ["--h" as string]: "55px" }}
          >
            <div className="iso-enter iso-enter-sat1 w-full h-full">
              <div
                className="iso-floater"
                style={{
                  ["--dur" as string]: "5s",
                  ["--float-y" as string]: "-8px",
                  ["--float-dir" as string]: "reverse",
                }}
              >
                <div className="h-full w-full overflow-hidden rounded-xl bg-background/50 backdrop-blur-xl shadow-[0_15px_30px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.7)] dark:shadow-[0_15px_30px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.15)] border border-foreground/[0.04] dark:border-foreground/[0.15] p-2 flex flex-col justify-center gap-1">
                  <div className="absolute inset-0 z-0 glass-sheen pointer-events-none opacity-50" />
                  <div className="relative z-10 flex items-center justify-between w-full opacity-80 mb-0.5">
                    <div className="flex gap-1.5 items-center">
                      <div className="w-[3px] h-[3px] rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.8)]" />
                      <span className="text-[5px] font-mono font-bold tracking-widest uppercase text-emerald-600 dark:text-emerald-400">
                        200 OK
                      </span>
                    </div>
                    <span className="text-[4px] font-mono font-bold tracking-widest uppercase opacity-40">
                      API_RES
                    </span>
                  </div>
                  <div className="relative z-10 h-px w-full bg-foreground/15 mb-0.5" />
                  <div className="relative z-10 flex flex-col gap-[3px] opacity-60">
                    <div className="flex gap-1 items-center">
                      <div className="h-px w-4 bg-foreground/50" />
                      <div className="h-px w-10 bg-foreground/20" />
                    </div>
                    <div className="flex gap-1 items-center">
                      <div className="h-px w-6 bg-foreground/30" />
                      <div className="h-px w-8 bg-foreground/20" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ----- 4. CARTE BOTTOM : Micro-Data / JSON Outline ----- */}
          <div
            className="iso-card-wrapper iso-wrapper-bot max-h-min"
            style={{ ["--w" as string]: "150px", ["--h" as string]: "150px" }}
          >
            <div className="iso-enter iso-enter-bot w-full h-full">
              <div
                className="iso-floater"
                style={{ ["--dur" as string]: "6.5s", ["--float-y" as string]: "-5px" }}
              >
                <div className="h-full w-full overflow-hidden rounded-xl bg-background/50 backdrop-blur-md shadow-[0_20px_40px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.7)] dark:shadow-[0_20px_40px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1)] border border-foreground/[0.05] dark:border-foreground/[0.2] p-4 flex flex-col gap-2 relative">
                  <div className="absolute inset-0 z-0 glass-sheen pointer-events-none" />
                  <div className="relative z-10 flex flex-col h-full gap-2 opacity-60">
                    <div className="flex gap-1.5 items-center">
                      <span className="text-[7px] font-mono font-bold tracking-widest text-foreground">
                        SYS.OUT
                      </span>
                      <div className="flex-1 h-px bg-foreground/15" />
                    </div>
                    <div className="mt-1 space-y-[5px]">
                      <div className="flex gap-2 items-center">
                        <div className="h-[2px] w-[2px] bg-foreground" />
                        <div className="h-px w-10 bg-foreground/30" />
                        <div className="h-px w-4 bg-foreground/10" />
                      </div>
                      <div className="flex gap-2 items-center ml-2 border-l border-foreground/15 pl-2">
                        <div className="h-[2px] w-[2px] bg-foreground/50" />
                        <div className="h-px w-6 bg-foreground/20" />
                      </div>
                      <div className="flex gap-2 items-center ml-2 border-l border-foreground/15 pl-2">
                        <div className="h-[2px] w-[2px] bg-foreground/50" />
                        <div className="h-px w-8 bg-foreground/20" />
                        <div className="h-px w-3 bg-foreground/30" />
                      </div>
                      <div className="flex gap-2 items-center">
                        <div className="h-[2px] w-[2px] border border-foreground/50" />
                        <div className="h-px w-12 bg-foreground/30" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ----- 3. CARTE SATELLITE 2 (AUTH JWT) ----- */}
          <div
            className="iso-card-wrapper iso-wrapper-sat2 max-h-min"
            style={{ ["--w" as string]: "75px", ["--h" as string]: "75px" }}
          >
            <div className="iso-enter iso-enter-sat2 w-full h-full">
              <div
                className="iso-floater"
                style={{ ["--dur" as string]: "7.5s", ["--float-y" as string]: "-4px" }}
              >
                <div className="h-full w-full overflow-hidden rounded-xl bg-background/50 backdrop-blur-xl shadow-[0_15px_30px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.7)] dark:shadow-[0_15px_30px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.15)] border border-foreground/[0.04] dark:border-foreground/[0.15] flex flex-col items-center justify-center gap-1.5">
                  <div className="absolute inset-0 z-0 glass-sheen pointer-events-none opacity-50" />
                  <div className="relative z-10 w-5 h-5 rounded-full border border-foreground/30 flex items-center justify-center mb-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-foreground/40" />
                  </div>
                  <div className="relative z-10 flex gap-[2px] opacity-60">
                    <div className="w-[3px] h-[2px] bg-foreground" />
                    <div className="w-4 h-[2px] bg-foreground/40" />
                    <div className="w-[3px] h-[2px] bg-foreground" />
                  </div>
                  <span className="relative z-10 text-[5px] font-mono font-bold uppercase tracking-widest opacity-40 mt-1">
                    SECURE
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ----- 2. CARTE MIDDLE : ÉCUSSON HUB ----- */}
          <div
            className="iso-card-wrapper iso-wrapper-hub max-h-min"
            style={{ ["--w" as string]: "180px", ["--h" as string]: "180px" }}
          >
            <div className="iso-enter iso-enter-hub w-full h-full">
              <div
                className="iso-floater"
                style={{ ["--dur" as string]: "8s", ["--float-y" as string]: "-3px" }}
              >
                <div className="h-full w-full relative rounded-[16px] shadow-[0_30px_60px_rgba(0,0,0,0.12)] p-[1px]">
                  {/* Spinning glow safe clipping using clipPath instead of overflow-hidden */}
                  <div
                    className="absolute inset-0 z-0 pointer-events-none"
                    style={{ clipPath: "inset(0 round 16px)" }}
                  >
                    <div
                      className="absolute left-1/2 top-1/2 h-[200%] w-[200%] -translate-x-1/2 -translate-y-1/2 animate-[spin_4s_linear_infinite] motion-reduce:animate-none opacity-50 dark:opacity-80"
                      style={{
                        background:
                          "conic-gradient(from 0deg at 50% 50%, transparent 0%, rgba(0,0,0,0.6) 45%, transparent 55%)",
                      }}
                    />
                    <div
                      className="absolute left-1/2 top-1/2 h-[200%] w-[200%] -translate-x-1/2 -translate-y-1/2 animate-[spin_4s_linear_infinite] motion-reduce:animate-none opacity-0 dark:opacity-100"
                      style={{
                        background:
                          "conic-gradient(from 0deg at 50% 50%, transparent 0%, rgba(255,255,255,0.7) 45%, transparent 55%)",
                      }}
                    />
                  </div>

                  <div className="relative z-10 flex h-full w-full flex-col items-center justify-center gap-3 rounded-[15px] bg-background/80 backdrop-blur-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] border border-foreground/[0.04] dark:border-foreground/[0.1] relative">
                    <div className="absolute inset-0 z-0 glass-sheen pointer-events-none opacity-70" />

                    <div className="relative z-10 flex flex-col items-center justify-center h-16 w-16 rounded-[4px] bg-background border border-foreground/10 shadow-[0_4px_10px_rgba(0,0,0,0.05)] ring-1 ring-black/5 dark:ring-white/5 mb-1 overflow-hidden">
                      <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(0,0,0,0.04)_1px,transparent_1px)] dark:bg-[radial-gradient(circle,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[length:4px_4px]" />
                      <div className="absolute top-1 right-1 p-0.5 opacity-80 z-20">
                        <div className="w-[3px] h-[3px] rounded-full bg-red-500 shadow-[0_0_5px_rgba(239,68,68,1)]" />
                      </div>
                      <FlagMadagascar className="relative scale-110 z-10 opacity-95 saturate-[0.8]" />
                    </div>

                    <div className="flex flex-col items-center z-10 mt-1">
                      <div className="flex items-center gap-1.5 opacity-40 mb-1">
                        <div className="w-1.5 h-[1px] bg-foreground" />
                        <span className="text-[7px] font-mono font-bold tracking-[0.3em] uppercase">
                          Built_in
                        </span>
                        <div className="w-1.5 h-[1px] bg-foreground" />
                      </div>
                      <span className="text-[12px] font-black tracking-widest text-foreground uppercase opacity-80">
                        Madagascar
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ----- 1. CARTE TOP : Surgical Line-Art Graph ----- */}
          <div
            className="iso-card-wrapper iso-wrapper-top max-h-min"
            style={{ ["--w" as string]: "130px", ["--h" as string]: "130px" }}
          >
            <div className="iso-enter iso-enter-top w-full h-full">
              <div
                className="iso-floater"
                style={{ ["--dur" as string]: "7s", ["--float-y" as string]: "-6px" }}
              >
                <div className="h-full w-full overflow-hidden rounded-xl bg-background/60 backdrop-blur-xl shadow-[0_15px_35px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.7)] dark:shadow-[0_15px_35px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.15)] border border-foreground/[0.04] dark:border-foreground/[0.15] p-3 flex flex-col justify-between relative">
                  <div className="absolute inset-0 z-0 glass-sheen pointer-events-none opacity-80" />

                  <div className="relative z-10 flex items-center justify-between w-full opacity-50 border-b border-foreground/10 pb-1.5">
                    <div className="flex gap-[1px]">
                      <div className="w-1 h-1 bg-foreground/40" />
                      <div className="w-1 h-1 border border-foreground/50" />
                      <div className="w-1 h-1 border border-foreground/50" />
                    </div>
                    <span className="text-[6px] font-mono font-bold tracking-widest uppercase">
                      Metrics
                    </span>
                  </div>

                  <div className="relative z-10 h-full w-full mt-2 flex items-end">
                    <svg viewBox="0 0 100 40" className="w-full h-full overflow-visible opacity-70">
                      {/* Grille cartésienne très fine */}
                      <path
                        d="M0 10 h100 M0 20 h100 M0 30 h100"
                        stroke="currentColor"
                        strokeOpacity="0.1"
                        strokeWidth="0.5"
                        strokeDasharray="1 1"
                      />
                      <path
                        d="M25 0 v40 M50 0 v40 M75 0 v40"
                        stroke="currentColor"
                        strokeOpacity="0.1"
                        strokeWidth="0.5"
                        strokeDasharray="1 1"
                      />

                      <path
                        d="M0 35 L20 25 L40 30 L60 15 L80 18 L100 5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M0 35 L20 25 L40 30 L60 15 L80 18 L100 5 L100 40 L0 40 Z"
                        fill="currentColor"
                        fillOpacity="0.03"
                      />

                      <circle cx="100" cy="5" r="1.5" fill="currentColor" opacity="0.9" />
                      <circle
                        cx="100"
                        cy="5"
                        r="4"
                        fill="currentColor"
                        opacity="0.25"
                        className="animate-ping"
                        style={{ transformOrigin: "100px 5px", animationDuration: "2.5s" }}
                      />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
