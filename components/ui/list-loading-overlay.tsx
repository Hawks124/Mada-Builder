"use client";

import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";

/**
 * Voile de chargement des listes (discover, leaderboard) : fade +
 * flou léger pendant les navigations filtres/tri/recherche/page.
 * Contenu toujours lisible en dessous (pas de layout shift, pas de
 * flash) ; interactif bloqué le temps du rendu serveur.
 */
export function ListLoadingOverlay({
  active,
  label = "Chargement…",
}: {
  active: boolean;
  label?: string;
}) {
  return (
    <div
      aria-hidden={!active}
      aria-busy={active}
      className={cn(
        "absolute inset-0 z-10 flex items-start justify-center pt-16 transition-opacity duration-200",
        // Bloque les clics en double pendant le rendu serveur, puis s'efface.
        active ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] rounded-[inherit]" />
      <div
        role="status"
        className="relative flex items-center gap-2.5 rounded-full border border-border/60 bg-background px-5 py-2.5 shadow-lg"
      >
        <Spinner size="sm" />
        <span className="text-[13px] font-bold text-foreground">{label}</span>
      </div>
    </div>
  );
}
