"use client";

import * as React from "react";
import { ArrowLeftIcon, ArrowRightIcon, ImagesIcon, XIcon } from "@phosphor-icons/react";
import type { GalleryOrientation } from "@/config/product-types";

export type GalleryShot = {
  src: string;
  alt: string;
  /** Orientation mesurée à l'upload (uniforme par fiche — imposée en amont). */
  orientation: GalleryOrientation;
  width?: number | null;
  height?: number | null;
};

/**
 * Galerie captures — défilement snap SANS scrollbar visible : flèches
 * précédent/suivant + compteur (desktop et mobile, le swipe tactile
 * reste natif). Clic = lightbox plein écran (flèches, Échap, fond).
 *
 * Slots uniformes dimensionnés par `galleryOrientation` (jamais de mix
 * sur une fiche), contenu en `object-contain` : zéro recadrage, zéro
 * perte. `<img>` simple (pas next/image) : l'hôte R2 est une variable
 * d'environnement runtime, et la pipeline serveur sort déjà les visuels
 * à la bonne taille en WebP — l'optimiseur Next n'apporterait rien.
 */
export function ProductGallery({
  shots = [],
  galleryOrientation = "landscape",
}: {
  shots?: GalleryShot[];
  galleryOrientation?: GalleryOrientation;
}) {
  const trackRef = React.useRef<HTMLDivElement>(null);
  const [index, setIndex] = React.useState(0);
  const [lightbox, setLightbox] = React.useState<number | null>(null);
  const lightboxOpen = lightbox !== null;

  const scrollTo = (i: number) => {
    if (shots.length === 0) return;
    const track = trackRef.current;
    if (!track) return;
    const clamped = (i + shots.length) % shots.length;
    const child = track.children[clamped] as HTMLElement | undefined;
    child?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    setIndex(clamped);
  };

  const onScroll = () => {
    const track = trackRef.current;
    if (!track) return;
    const center = track.scrollLeft + track.clientWidth / 2;
    let best = 0;
    let bestDist = Number.POSITIVE_INFINITY;
    Array.from(track.children).forEach((child, i) => {
      const el = child as HTMLElement;
      const dist = Math.abs(el.offsetLeft + el.clientWidth / 2 - center);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    setIndex(best);
  };

  React.useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
      else if (e.key === "ArrowRight")
        setLightbox((v) => (v === null ? v : (v + 1) % shots.length));
      else if (e.key === "ArrowLeft")
        setLightbox((v) => (v === null ? v : (v - 1 + shots.length) % shots.length));
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "unset";
    };
  }, [lightboxOpen, shots.length]);

  if (shots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2.5 rounded-[5px] border border-dashed border-border/50 bg-muted/20 py-14 text-center">
        <ImagesIcon weight="duotone" className="h-9 w-9 text-muted-foreground/50" />
        <p className="text-[13px] font-bold text-muted-foreground">Aucune capture pour le moment</p>
        <p className="text-[12px] font-medium text-muted-foreground/70 max-w-60 leading-relaxed">
          Le maker n&apos;a pas encore ajouté d&apos;aperçus de ce produit en action.
        </p>
      </div>
    );
  }

  const portrait = galleryOrientation === "portrait";

  return (
    <div className="flex flex-col gap-4 pt-4">
      <div className="relative">
        <div
          ref={trackRef}
          onScroll={onScroll}
          className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 -mx-4 px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {shots.map((shot, i) => (
            <button
              key={shot.src}
              type="button"
              onClick={() => setLightbox(i)}
              aria-label={`Agrandir la capture ${i + 1}`}
              className={
                portrait
                  ? "shrink-0 w-[46%] sm:w-[32%] lg:w-[24%] aspect-9/16 rounded-[5px] bg-muted/30 border border-border/40 overflow-hidden snap-center relative cursor-zoom-in group"
                  : "shrink-0 w-[85%] md:w-[65%] aspect-video rounded-[5px] bg-muted/30 border border-border/40 overflow-hidden snap-center relative cursor-zoom-in group"
              }
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={shot.src}
                alt={shot.alt}
                width={shot.width ?? undefined}
                height={shot.height ?? undefined}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.02]"
              />
              <div className="absolute inset-0 ring-1 ring-inset ring-black/5 dark:ring-white/5 rounded-[5px] pointer-events-none" />
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between mt-1">
          <span className="text-[12px] font-bold text-muted-foreground tabular-nums">
            {index + 1} / {shots.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => scrollTo(index - 1)}
              aria-label="Capture précédente"
              className="flex items-center justify-center h-9 w-9 rounded-full border border-border/40 text-muted-foreground hover:text-foreground hover:border-border/80 hover:bg-muted/50 transition-colors cursor-pointer"
            >
              <ArrowLeftIcon weight="bold" className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollTo(index + 1)}
              aria-label="Capture suivante"
              className="flex items-center justify-center h-9 w-9 rounded-full border border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
            >
              <ArrowRightIcon weight="bold" className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {lightbox !== null && shots[lightbox] && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Capture ${lightbox + 1} sur ${shots.length}`}
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-100 bg-black/95"
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label="Fermer"
            className="absolute top-4 right-4 z-10 flex items-center justify-center h-11 w-11 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <XIcon weight="bold" className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setLightbox((lightbox - 1 + shots.length) % shots.length);
            }}
            aria-label="Capture précédente"
            className="absolute left-2 sm:left-5 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center h-11 w-11 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <ArrowLeftIcon weight="bold" className="h-5 w-5" />
          </button>
          <div className="absolute inset-0" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={shots[lightbox].src}
              src={shots[lightbox].src}
              alt={shots[lightbox].alt}
              className="absolute inset-0 h-full w-full object-contain"
            />
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setLightbox((lightbox + 1) % shots.length);
            }}
            aria-label="Capture suivante"
            className="absolute right-2 sm:right-5 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center h-11 w-11 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <ArrowRightIcon weight="bold" className="h-5 w-5" />
          </button>
          <span className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10 text-[12px] font-bold text-white/60 tabular-nums">
            {lightbox + 1} / {shots.length}
          </span>
        </div>
      )}
    </div>
  );
}
