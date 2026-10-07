"use client";

import { ImageSquareIcon, PlusIcon, XIcon } from "@phosphor-icons/react";
import { DeviceMobileIcon, MonitorIcon } from "@phosphor-icons/react/dist/ssr";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { FieldBadge } from "@/components/ui/field-badge";
import { useSubmitForm } from "@/components/submit/submit-form-context";
import { getProductTypeById, type GalleryOrientation } from "@/config/product-types";

const MAX_SHOTS = 6;
const LOGO_MIN_PX = 256;
const SHOT_MIN_PX = 400;

type ShotPreview = {
  file: File;
  url: string;
  name: string;
  width: number;
  height: number;
  /** Bucket mesuré (carré → orientation du moment, jamais rejeté). */
  bucket: GalleryOrientation;
};

/** Dimensions d'un fichier image côté navigateur (le serveur tranche). */
function loadDims(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("illisible"));
    };
    img.src = url;
  });
}

function bucketOf(width: number, height: number, declared: GalleryOrientation): GalleryOrientation {
  const ratio = width / height;
  if (ratio > 1.05) return "landscape";
  if (ratio < 0.95) return "portrait";
  return declared;
}

const orientationFr = (o: GalleryOrientation): string =>
  o === "portrait" ? "portrait" : "paysage";

export function SubmitMediaSection() {
  const { productType, setMediaSummary, errors, clearError, existingMedia, isEditing, editApp } =
    useSubmitForm();
  const productTypeEntry = getProductTypeById(productType);
  // Pilotage auto : l'orientation suit le type. Le toggle n'est actif que
  // pour les types "both" (web, jeu, bot, autre) — partout ailleurs il affiche
  // la déclaration, verrouillé. Jamais d'effect : dérivé au rendu.
  // Défaut "both" = defaultOrientation du type ; en édition, l'orientation
  // stockée prime (sinon flip + guard au save sans toucher).
  const [manual, setManual] = useState<GalleryOrientation | null>(
    editApp?.galleryOrientation ?? null,
  );
  const orientation: GalleryOrientation =
    productTypeEntry.orientation === "both"
      ? (manual ?? productTypeEntry.defaultOrientation ?? "portrait")
      : productTypeEntry.orientation;
  const locked = productTypeEntry.orientation !== "both";

  const shotsInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [shots, setShots] = useState<ShotPreview[]>([]);
  const [shotsError, setShotsError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  // Seules les captures compatibles partent au serveur : l'invariant
  // « ce qui est à l'écran = ce qui est envoyé » tient même quand le
  // type change après sélection (les intrus sont masqués + notifiés).
  const visibleShots = shots.filter((s) => s.width === 0 || s.bucket === orientation);
  // Notice dérivée au rendu (pas d'état, pas d'effect) : persiste tant
  // que des intrus sont masqués, s'efface dès qu'ils sont retirés — et
  // réapparaît si le type change à nouveau. shotsError reste réservé
  // aux rejets ponctuels (sélection).
  const hiddenCount = shots.length - visibleShots.length;

  const acceptFile = (f: File): string | null => {
    if (!/^image\/(png|jpe?g|webp)$/.test(f.type)) return "PNG, JPG ou WebP uniquement.";
    if (f.size > 10 * 1024 * 1024) return "10 Mo maximum par fichier.";
    return null;
  };

  /** Resynchronise le vrai input (ce qui part au serveur) depuis l'état. */
  const syncInputFiles = (files: File[]): void => {
    const dt = new DataTransfer();
    for (const f of files) dt.items.add(f);
    if (shotsInputRef.current) shotsInputRef.current.files = dt.files;
  };

  // Sync envoi après chaque changement (ajout/retrait/changement de type).
  // Touche le DOM uniquement (jamais de setState) : pas de rendus en cascade.
  useEffect(() => {
    syncInputFiles(visibleShots.map((s) => s.file));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shots, orientation]);

  // Résumé validation (contexte) : nouveaux fichiers d'abord (ils
  // REMPLACENT l'existant côté serveur), existants sinon (conservés).
  const hasLogo = logoUrl !== null || existingMedia?.iconUrl != null;
  const effectiveShots =
    visibleShots.length > 0 ? visibleShots.length : (existingMedia?.shots.length ?? 0);
  useEffect(() => {
    setMediaSummary({ hasLogo, shotCount: effectiveShots });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasLogo, effectiveShots]);

  const onLogo = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const f = e.target.files?.[0];
    setLogoError(null);
    clearError("logo");
    if (!f) return;
    const err = acceptFile(f);
    if (err) {
      setLogoError(err);
      e.target.value = "";
      return;
    }
    try {
      const { width, height } = await loadDims(f);
      if (Math.min(width, height) < LOGO_MIN_PX) {
        setLogoError(`Logo trop petit — ${LOGO_MIN_PX} px minimum.`);
        e.target.value = "";
        return;
      }
    } catch {
      // Illisible côté client : le serveur tranche (magic-bytes + sharp).
    }
    setLogoUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(f);
    });
    // Input conservé (pas de reset) : le fichier part au serveur tel quel.
  };

  const onShots = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const selected = Array.from(e.target.files ?? []).slice(0, MAX_SHOTS - visibleShots.length);
    setShotsError(null);
    clearError("screenshots");
    if (selected.length === 0) return;
    setChecking(true);
    try {
      const next: ShotPreview[] = [];
      for (const f of selected) {
        const err = acceptFile(f);
        if (err) {
          setShotsError(err);
          return;
        }
        let dims: { width: number; height: number } | null = null;
        try {
          dims = await loadDims(f);
        } catch {
          // Illisible côté client : accepté sous réserve, serveur tranche.
        }
        if (dims) {
          if (Math.min(dims.width, dims.height) < SHOT_MIN_PX) {
            setShotsError(`« ${f.name} » trop petite — ${SHOT_MIN_PX} px minimum.`);
            return;
          }
          const bucket = bucketOf(dims.width, dims.height, orientation);
          if (bucket !== orientation) {
            setShotsError(
              `« ${f.name} » : ${orientationFr(bucket)} rejeté — captures ${orientationFr(orientation)} uniquement.`,
            );
            return;
          }
          next.push({
            file: f,
            url: URL.createObjectURL(f),
            name: f.name,
            width: dims.width,
            height: dims.height,
            bucket,
          });
        } else {
          next.push({
            file: f,
            url: URL.createObjectURL(f),
            name: f.name,
            width: 0,
            height: 0,
            bucket: orientation,
          });
        }
      }
      setShots((prev) => [...prev, ...next]);
    } finally {
      setChecking(false);
      // Reset OK : les fichiers vivent dans l'état, l'input est resync via l'effect.
      e.target.value = "";
    }
  };

  const removeShot = (url: string): void => {
    setShots((prev) => {
      const found = prev.find((s) => s.url === url);
      if (found) URL.revokeObjectURL(found.url);
      return prev.filter((s) => s.url !== url);
    });
  };

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-black tracking-tight">Logo &amp; captures d&apos;écran</h2>
        <p className="text-[14px] font-medium text-muted-foreground">
          Téléversez un logo et des aperçus de votre produit en action — jamais recadrés, jamais
          mélangés.
          {!isEditing && (
            <span className="text-foreground font-bold">
              {" "}
              Brouillon : textes seuls — les images choisies ici ne partent qu&apos;à la
              publication.
            </span>
          )}
        </p>
      </div>

      {/* Logo Upload */}
      <div className="flex flex-col gap-3 mt-4">
        <label className="text-[14px] font-bold text-foreground flex items-center gap-2">
          App logo ou icône
          <FieldBadge variant="required" />
        </label>
        <div className="flex items-center gap-6">
          <label className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-transparent border border-dashed border-border/50 flex flex-col items-center justify-center text-muted-foreground shrink-0 overflow-hidden relative group cursor-pointer transition-colors hover:border-foreground/40 hover:bg-muted/10">
            {logoUrl || existingMedia?.iconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl ?? existingMedia?.iconUrl ?? ""}
                alt={logoUrl ? "Aperçu du logo" : "Logo actuel (conservé)"}
                className="absolute inset-0 h-full w-full object-contain"
              />
            ) : (
              <>
                <ImageSquareIcon
                  weight="duotone"
                  className="w-8 h-8 opacity-40 mb-1 group-hover:opacity-70 transition-opacity"
                />
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-40 group-hover:opacity-70 transition-opacity">
                  Logo
                </span>
              </>
            )}
            <input
              type="file"
              id="logo-input"
              ref={logoInputRef}
              name="logo"
              accept="image/png,image/jpeg,image/webp"
              onChange={onLogo}
              className="absolute inset-0 opacity-0 cursor-pointer"
              aria-label="Choisir le logo"
            />
          </label>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              className="self-start px-6 py-2.5 rounded-full bg-foreground text-background text-[13px] font-bold hover:opacity-90 active:scale-[0.98] transition-all cursor-pointer"
            >
              {logoUrl ? "Changer le logo" : "Upload logo"}
            </button>
            {logoError !== null ? (
              <p
                role="alert"
                className="text-[12px] font-bold text-red-600 dark:text-red-400 max-w-50 leading-relaxed"
              >
                {logoError}
              </p>
            ) : errors["logo"] ? (
              <p
                role="alert"
                className="text-[12px] font-bold text-red-600 dark:text-red-400 max-w-50 leading-relaxed"
              >
                {errors["logo"]}
              </p>
            ) : existingMedia?.iconUrl && !logoUrl ? (
              <p className="text-[12px] font-medium text-muted-foreground max-w-50 leading-relaxed">
                Logo actuel conservé — sélectionnez pour remplacer.
              </p>
            ) : (
              <p className="text-[12px] font-medium text-muted-foreground max-w-50 leading-relaxed">
                PNG, JPG, ou WebP — au moins 256x256, max 10 Mo. Jamais recadré (fond transparent).
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="w-full h-px bg-border/40 my-2" />

      {/* Screenshots Upload */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-[14px] font-bold text-foreground flex items-center gap-2">
              Captures d&apos;écran
              <FieldBadge variant="required" />
            </label>
            <p className="text-[12px] font-medium text-muted-foreground leading-relaxed">
              Au moins 1 capture requise, jusqu&apos;à {MAX_SHOTS} — PNG, JPG, ou WebP, max 10 Mo
              chacune,
              {orientation === "portrait" ? " portrait" : " paysage"} uniquement, 400 px minimum.
            </p>
          </div>

          {/* Orientation : pilotée par le type, toggle actif seulement en "both" */}
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center p-1 rounded-full border border-border/40 bg-transparent">
              <button
                type="button"
                onClick={() => setManual("portrait")}
                disabled={locked || checking}
                aria-pressed={orientation === "portrait"}
                title={
                  locked ? `Imposé par le type « ${productTypeEntry.label} »` : "Captures portrait"
                }
                className={cn(
                  "px-5 py-2.5 text-[13px] font-bold rounded-full transition-all flex items-center gap-2",
                  orientation === "portrait"
                    ? "bg-background text-foreground shadow-md ring-1 ring-border/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/30",
                  locked ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                )}
              >
                <DeviceMobileIcon
                  weight={orientation === "portrait" ? "fill" : "regular"}
                  className="w-4.5 h-4.5"
                />
                Portrait
              </button>
              <button
                type="button"
                onClick={() => setManual("landscape")}
                disabled={locked || checking}
                aria-pressed={orientation === "landscape"}
                title={
                  locked ? `Imposé par le type « ${productTypeEntry.label} »` : "Captures paysage"
                }
                className={cn(
                  "px-5 py-2.5 text-[13px] font-bold rounded-full transition-all flex items-center gap-2",
                  orientation === "landscape"
                    ? "bg-background text-foreground shadow-md ring-1 ring-border/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/30",
                  locked ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                )}
              >
                <MonitorIcon
                  weight={orientation === "landscape" ? "fill" : "regular"}
                  className="w-4.5 h-4.5"
                />
                Paysage
              </button>
            </div>
            <p className="text-[11px] font-medium text-muted-foreground">
              {locked
                ? `Piloté par le type « ${productTypeEntry.label} »`
                : "Type ambigu : à vous de choisir"}
            </p>
          </div>
        </div>

        {/* Source unique envoyée au serveur (le toggle n'est qu'un affichage). */}
        <input type="hidden" name="galleryOrientation" value={orientation} />
        {/* Input fichiers TOUJOURS monté (sinon les fichiers sont perdus du
            DOM quand le slot d'ajout disparaît à quota plein). */}
        <input
          ref={shotsInputRef}
          type="file"
          name="screenshots"
          accept="image/png,image/jpeg,image/webp"
          multiple
          onChange={onShots}
          className="sr-only"
          aria-label="Ajouter des captures"
        />

        <div
          className={cn(
            "grid gap-4 mt-2",
            orientation === "portrait"
              ? "grid-cols-2 lg:grid-cols-3"
              : "grid-cols-1 lg:grid-cols-2",
          )}
        >
          {/* Uploader slot — masqué à quota plein (retirez-en une d'abord). */}
          {visibleShots.length < MAX_SHOTS && (
            <button
              type="button"
              onClick={() => shotsInputRef.current?.click()}
              disabled={checking}
              className={cn(
                "w-full rounded-4xl bg-transparent hover:bg-muted/5 border-2 border-dashed border-border/60 flex flex-col items-center justify-center gap-2.5 transition-colors text-muted-foreground group shadow-sm",
                orientation === "portrait" ? "aspect-9/16" : "aspect-video",
                checking ? "opacity-50 cursor-wait" : "cursor-pointer",
              )}
            >
              <PlusIcon
                weight="regular"
                className="w-7 h-7 opacity-70 group-hover:opacity-100 transition-opacity"
              />
              <span className="text-[14px] font-bold opacity-80 group-hover:opacity-100 transition-opacity">
                {checking
                  ? "Vérification…"
                  : `Ajouter (${visibleShots.length > 0 ? visibleShots.length : (existingMedia?.shots.length ?? 0)}/${MAX_SHOTS})`}
              </span>
            </button>
          )}
          {visibleShots.length >= MAX_SHOTS && (
            <p className="text-[12px] font-medium text-muted-foreground col-span-full">
              Galerie complète — retirez une capture pour en ajouter une.
            </p>
          )}

          {/* Aperçus sélectionnés, chacun dans son ratio réel */}
          {visibleShots.map((s) => (
            <div
              key={s.url}
              style={s.width > 0 ? { aspectRatio: `${s.width} / ${s.height}` } : undefined}
              className={cn(
                "relative w-full rounded-4xl overflow-hidden border border-border/60 shadow-sm bg-muted/20",
                s.width === 0 && (orientation === "portrait" ? "aspect-9/16" : "aspect-video"),
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.url}
                alt={s.name}
                className="absolute inset-0 h-full w-full object-contain"
              />
              <button
                type="button"
                onClick={() => removeShot(s.url)}
                aria-label={`Retirer ${s.name}`}
                className="absolute top-2 right-2 flex items-center justify-center w-8 h-8 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors cursor-pointer"
              >
                <XIcon weight="bold" className="w-4 h-4" />
              </button>
            </div>
          ))}
          {/* Captures actuelles (édition) : MÊME grille que les nouvelles
              (même ratio, même taille) + badge — conservées sauf
              remplacement total (ajouter = tout remplacer). */}
          {visibleShots.length === 0 &&
            existingMedia?.shots.map((s) => (
              <div
                key={s.url}
                className={cn(
                  "relative w-full rounded-4xl overflow-hidden border border-border/60 shadow-sm bg-muted/20",
                  orientation === "portrait" ? "aspect-9/16" : "aspect-video",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.url}
                  alt="Capture actuelle (conservée)"
                  className="absolute inset-0 h-full w-full object-contain"
                  loading="lazy"
                />
                <span className="absolute top-2 left-2 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-white">
                  Actuelle
                </span>
              </div>
            ))}
          {visibleShots.length === 0 && (existingMedia?.shots.length ?? 0) > 0 && (
            <p className="text-[12px] font-medium text-muted-foreground col-span-full">
              {existingMedia!.shots.length} capture(s) actuelle(s) conservée(s) — en ajouter
              remplace toute la galerie.
            </p>
          )}
          {(shotsError !== null || hiddenCount > 0 || errors["screenshots"]) && (
            <p role="alert" className="text-[12px] font-bold text-red-600 dark:text-red-400">
              {errors["screenshots"] ??
                shotsError ??
                `${hiddenCount} capture(s) masquée(s) : captures ${orientationFr(orientation)} uniquement pour ce type — retirez-les ou changez de type.`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
