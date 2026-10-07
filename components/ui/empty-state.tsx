"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";

// Player chargé côté client uniquement (canvas/worker — jamais de HTML
// serveur divergent : pas de conflit d'hydratation). Fallback = espace
// réservé (pas de layout shift à l'apparition).
const DotLottiePlayer = dynamic(
  () => import("@dotlottie/react-player").then((m) => m.DotLottiePlayer),
  {
    ssr: false,
    loading: () => <div aria-hidden="true" className="h-36 w-36 sm:h-44 sm:w-44" />,
  },
);

const ASTRONAUT_SRC = "/lotties/Astronaut%20-%20Light%20Theme.lottie";

/**
 * État vide global — UNE seule langue visuelle pour les parcours
 * (discover, leaderboard, nouveautés, brouillons, file revue).
 * L'animation est rendue telle quelle, sans conteneur (décision : ajuster
 * le dark plus tard sur retour visuel, pas de filtre aveugle).
 * Les vides techniques (galerie, connexions) gardent leurs icônes sobres.
 */
export function EmptyState({
  illustration = "astronaut",
  title,
  description,
  action,
  size = "md",
  className,
}: {
  illustration?: "astronaut" | "none";
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center text-center",
        size === "md" ? "gap-4 px-6 py-16" : "gap-3 px-6 py-10",
        className,
      )}
    >
      {illustration === "astronaut" && (
        <div
          aria-hidden="true"
          className={size === "md" ? "h-36 w-36 sm:h-44 sm:w-44" : "h-28 w-28"}
        >
          <DotLottiePlayer
            src={ASTRONAUT_SRC}
            autoplay
            loop
            style={{ width: "100%", height: "100%" }}
          />
        </div>
      )}
      <div className="flex flex-col gap-1.5 max-w-sm">
        <p className="text-[15px] font-extrabold tracking-tight text-foreground">{title}</p>
        {description != null && (
          <p className="text-[13px] font-medium text-muted-foreground leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
