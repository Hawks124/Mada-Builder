"use client";

import * as React from "react";
import Image from "next/image";
import { ArrowLeftIcon, ArrowRightIcon, XIcon } from "@phosphor-icons/react";

const SHOTS = [1, 2, 3].map((i) => ({
  src: `https://picsum.photos/seed/tarsi${i}/800/450`,
  alt: `Screenshot ${i}`,
}));

/**
 * Galerie captures — défilement snap SANS scrollbar visible : flèches
 * précédent/suivant + compteur (desktop et mobile, le swipe tactile
 * reste natif). Clic = lightbox plein écran (flèches, Échap, fond).
 * Prototype : images picsum (médias réels au milestone listings).
 */
export function ProductGallery() {
  const trackRef = React.useRef<HTMLDivElement>(null);
  const [index, setIndex] = React.useState(0);
  const [lightbox, setLightbox] = React.useState<number | null>(null);
  const lightboxOpen = lightbox !== null;

  const scrollTo = (i: number) => {
    const track = trackRef.current;
    if (!track) return;
    const clamped = (i + SHOTS.length) % SHOTS.length;
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
        setLightbox((v) => (v === null ? v : (v + 1) % SHOTS.length));
      else if (e.key === "ArrowLeft")
        setLightbox((v) => (v === null ? v : (v - 1 + SHOTS.length) % SHOTS.length));
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "unset";
    };
  }, [lightboxOpen]);

  return (
    <div className="flex flex-col gap-4 pt-4">
      <div className="relative">
        <div
          ref={trackRef}
          onScroll={onScroll}
          className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 -mx-4 px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {SHOTS.map((shot, i) => (
            <button
              key={shot.src}
              type="button"
              onClick={() => setLightbox(i)}
              aria-label={`Agrandir la capture ${i + 1}`}
              className="shrink-0 w-[85%] md:w-[65%] aspect-video rounded-[5px] bg-muted/30 border border-border/40 overflow-hidden snap-center relative cursor-zoom-in group"
            >
              <Image
                src={shot.src}
                alt={shot.alt}
                fill
                sizes="(max-width: 768px) 85vw, 65vw"
                className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              />
              <div className="absolute inset-0 ring-1 ring-inset ring-black/5 dark:ring-white/5 rounded-[5px] pointer-events-none" />
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between mt-1">
          <span className="text-[12px] font-bold text-muted-foreground tabular-nums">
            {index + 1} / {SHOTS.length}
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
              className="flex items-center justify-center h-9 w-9 rounded-full border border-border/40 text-muted-foreground hover:text-foreground hover:border-border/80 hover:bg-muted/50 transition-colors cursor-pointer"
            >
              <ArrowRightIcon weight="bold" className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {lightbox !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Capture ${lightbox + 1} sur ${SHOTS.length}`}
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
              setLightbox((lightbox - 1 + SHOTS.length) % SHOTS.length);
            }}
            aria-label="Capture précédente"
            className="absolute left-2 sm:left-5 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center h-11 w-11 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <ArrowLeftIcon weight="bold" className="h-5 w-5" />
          </button>
          <div className="absolute inset-0" onClick={(e) => e.stopPropagation()}>
            <Image
              key={SHOTS[lightbox].src}
              src={SHOTS[lightbox].src}
              alt={SHOTS[lightbox].alt}
              fill
              sizes="100vw"
              className="object-contain"
              priority
            />
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setLightbox((lightbox + 1) % SHOTS.length);
            }}
            aria-label="Capture suivante"
            className="absolute right-2 sm:right-5 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center h-11 w-11 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <ArrowRightIcon weight="bold" className="h-5 w-5" />
          </button>
          <span className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10 text-[12px] font-bold text-white/60 tabular-nums">
            {lightbox + 1} / {SHOTS.length}
          </span>
        </div>
      )}
    </div>
  );
}
