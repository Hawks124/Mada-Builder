"use client";

import * as React from "react";
import Cropper, { type Area } from "react-easy-crop";
import { ImageIcon } from "@phosphor-icons/react";
import { Spinner } from "@/components/ui/spinner";
import { cropImageToFile } from "@/lib/avatar-crop";

/**
 * Dialogue de cadrage avatar (Mode Studio Photo)
 * - Zone de cadrage aspect-square pour maximiser l'espace tactile sur mobile.
 * - Fond sombre immersif pour faire ressortir l'image.
 * - Slider de zoom avec affordance (icônes).
 */
export function AvatarCropDialog({
  imageSrc,
  onCancel,
  onValidate,
}: {
  imageSrc: string;
  onCancel: () => void;
  onValidate: (file: File) => void;
}) {
  const [crop, setCrop] = React.useState({ x: 0, y: 0 });
  const [zoom, setZoom] = React.useState(1);
  const [croppedArea, setCroppedArea] = React.useState<Area | null>(null);
  const [working, setWorking] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const validate = async () => {
    if (!croppedArea || working) return;
    setError(null);
    setWorking(true);
    try {
      const file = await cropImageToFile(imageSrc, croppedArea);
      onValidate(file);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cadrage impossible.");
      setWorking(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-100 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !working) onCancel();
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Cadrer l'avatar"
        className="w-full max-w-md rounded-[10px] sm:rounded-[10px] border border-border/40 bg-background shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
      >
        {/* Header minimaliste */}
        <div className="px-6 py-4 border-b border-border/40 flex items-center justify-center">
          <h2 className="text-sm font-bold text-foreground tracking-wide">Ajuster l&apos;avatar</h2>
        </div>

        {/* Zone crop — ratio 1:1, largeur totale, fond immersif très sombre */}
        <div className="relative w-full aspect-square bg-[#09090B]">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, area) => setCroppedArea(area)}
            style={{
              containerStyle: { background: "transparent" },
            }}
          />
        </div>

        {/* Contrôles du Zoom avec affordance visuelle */}
        <div className="flex items-center gap-4 px-6 pt-6">
          <ImageIcon
            weight="fill"
            className="w-4 h-4 text-muted-foreground shrink-0"
            aria-hidden="true"
          />
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            disabled={working}
            onChange={(e) => setZoom(Number(e.target.value))}
            aria-label="Niveau de zoom"
            className="flex-1 accent-foreground cursor-pointer disabled:opacity-50 h-1.5 bg-muted rounded-lg appearance-none"
          />
          <ImageIcon
            weight="fill"
            className="w-6 h-6 text-foreground shrink-0"
            aria-hidden="true"
          />
        </div>

        {error && (
          <p
            role="alert"
            className="px-6 pt-4 text-xs font-bold text-red-600 dark:text-red-400 text-center"
          >
            {error}
          </p>
        )}

        {/* Actions : Pleine largeur sur mobile, alignées à droite sur desktop */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 p-6">
          <button
            type="button"
            onClick={onCancel}
            disabled={working}
            className="w-full sm:w-auto rounded-full px-6 py-3.5 sm:py-3 text-[14px] font-bold text-foreground bg-muted/50 hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={validate}
            disabled={working || !croppedArea}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 sm:py-3 text-[14px] font-bold text-white bg-foreground hover:opacity-90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {working && <Spinner size="sm" />}
            {working ? "Cadrage…" : "Valider l'avatar"}
          </button>
        </div>
      </div>
    </div>
  );
}
