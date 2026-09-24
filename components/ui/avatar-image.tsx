"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Avatar unifié — src distante ou null + nom. Règles :
 * - src null → initiales (jamais de visage d'emprunt) ;
 * - ÉCHEC de chargement (timeout optimiseur, 403 bucket, domaine mort) →
 *   initiales aussi (c'est le bug QA : `onError` manquait partout, images
 *   pendues/cassées au lieu du fallback) ;
 * - `unoptimized` pour les SVG locaux ? Non : next/image les sert tels
 *   quels, pas d'optimisation tentée.
 */
export function AvatarImage({
  src,
  name,
  size = 40,
  className,
}: {
  src: string | null;
  name: string;
  /** Taille px fixe (affichage + intrinsic — pas de variante responsive). */
  size?: number;
  /** Classes décoratives (filtres, bordures, hover) — pas de dimensions. */
  className?: string;
}) {
  const [failed, setFailed] = React.useState(false);
  // Reset si la source change (nouvel upload → re-tenter l'image).
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFailed(false);
  }, [src]);

  const initials = name
    .split(/[\s_.-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

  if (!src || failed) {
    return (
      <span
        aria-hidden={src ? undefined : "true"}
        role={src ? "img" : undefined}
        aria-label={src ? `${name} (image indisponible)` : undefined}
        style={{ width: size, height: size }}
        className={cn(
          "rounded-full bg-[#EA580C] flex items-center justify-center text-white font-bold shrink-0",
          className,
        )}
      >
        <span style={{ fontSize: Math.max(10, Math.round(size * 0.35)) }}>{initials || "M"}</span>
      </span>
    );
  }

  return (
    <Image
      src={src}
      alt={name}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className={cn("rounded-full object-cover shrink-0", className)}
      style={{ width: size, height: size }}
    />
  );
}
