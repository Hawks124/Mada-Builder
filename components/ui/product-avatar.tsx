"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Logo produit — source unique.
 *
 * Règle de repli inchangée : logo R2 si fourni, sinon tuile dégradée + initiales.
 * **Jamais de visage d'emprunt**, jamais d'image cassée — si le logo échoue au
 * chargement, on retombe sur les initiales.
 *
 * Le motif existait en six exemplaires (`overview-apps`, `product-header`,
 * `product-sidebar`, `related-products`, `review-queue`,
 * `notifications-list`). Seul celui-ci est extrait : les autres gardent leur
 * copie tant que ce chantier ne les reprend pas.
 *
 * `alt` vide par défaut : le nom du produit est presque toujours écrit à côté
 * de l'image, et une image décorative redoublée en lecture d'écran est bruit.
 * Passez `alt` quand le logo est le seul porteur du nom.
 */
export function ProductAvatar({
  iconUrl,
  initials,
  gradient,
  alt = "",
  className,
}: {
  iconUrl?: string | null;
  initials: string;
  gradient: string;
  alt?: string;
  className?: string;
}) {
  const [failed, setFailed] = React.useState(false);

  if (iconUrl && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={iconUrl}
        alt={alt}
        onError={() => setFailed(true)}
        className="h-full w-full object-cover"
      />
    );
  }

  return (
    <span
      aria-hidden={alt === "" ? true : undefined}
      className={cn(
        "flex h-full w-full items-center justify-center font-black text-white bg-linear-to-br",
        gradient,
        className,
      )}
    >
      {initials}
    </span>
  );
}

/** Carré arrondi prêt à receivevoir : le logo avec sa bordure et sa taille. */
export function ProductAvatarTile({
  iconUrl,
  initials,
  gradient,
  size = 40,
  className,
}: {
  iconUrl?: string | null;
  initials: string;
  gradient: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn("shrink-0 overflow-hidden rounded-xl border border-border/60", className)}
      style={{ width: size, height: size }}
    >
      <ProductAvatar iconUrl={iconUrl} initials={initials} gradient={gradient} />
    </span>
  );
}
