"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { isRemoteImageAllowed } from "@/lib/remote-images";

/**
 * Avatar unifié — src distante ou null + nom. Règles :
 * - src null → initiales (jamais de visage d'emprunt) ;
 * - host non allowlisté → initiales SANS passer par next/image (rapide) ;
 * - host allowlisté mais échec (404, 403, timeout optimiseur) → initiales
 *   via onError (le bug QA : images pendues/cassées) ;
 * - host inattendu en prod (domaine custom R2 non listé côté client) →
 *   boundary attrape le throw next/image (« hostname not configured »)
 *   et rend des initiales : UNE image ne crashe plus jamais une page.
 */
class AvatarBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

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

  const fallback = (
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

  if (!src || failed || !isRemoteImageAllowed(src)) return fallback;

  return (
    <AvatarBoundary fallback={fallback}>
      <Image
        src={src}
        alt={name}
        width={size}
        height={size}
        onError={() => setFailed(true)}
        className={cn("rounded-full object-cover shrink-0", className)}
        style={{ width: size, height: size }}
      />
    </AvatarBoundary>
  );
}
