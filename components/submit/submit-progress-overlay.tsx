"use client";

import { cn } from "@/lib/utils";
import type { SendPhase } from "@/components/submit/use-submit-xhr";

/**
 * Overlay d'envoi (bloquant) : vrai % pendant l'upload (XHR), état
 * indéterminé pendant le traitement serveur (sharp + R2, non mesurable —
 * jamais de faux %). Les clics sont interceptés : impossible de quitter
 * la page en cours d'envoi (refresh/fermeture = beforeunload existant).
 */
export function SubmitProgressOverlay({
  phase,
  intent,
}: {
  phase: SendPhase;
  intent: "publish" | "draft" | null;
}) {
  const active = phase.name !== "idle";
  const isDraft = intent !== "publish";
  const percent =
    phase.name === "uploading" && phase.total > 0
      ? Math.min(100, Math.round((phase.loaded / phase.total) * 100))
      : null;
  const mb = (n: number): string =>
    n >= 1024 * 1024
      ? `${(n / 1024 / 1024).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`
      : `${Math.max(1, Math.round(n / 1024))} Ko`;
  const sizes =
    phase.name === "uploading" && (phase.origBytes ?? 0) > 0
      ? ` · ${mb(phase.origBytes ?? 0)} → ${mb(phase.sentBytes ?? 0)}`
      : "";
  return (
    <div
      aria-hidden={!active}
      aria-busy={active}
      className={cn(
        "fixed inset-0 z-[80] flex items-center justify-center bg-background/80 backdrop-blur-sm transition-opacity",
        active ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      <div className="flex flex-col items-center gap-4 rounded-3xl border border-border/40 bg-background px-10 py-8 shadow-2xl">
        <p className="text-[15px] font-black tracking-tight text-foreground">
          {phase.name === "preparing"
            ? "Préparation des images…"
            : phase.name === "uploading"
              ? isDraft
                ? "Enregistrement du brouillon…"
                : "Envoi en cours…"
              : isDraft
                ? "Finalisation du brouillon…"
                : "Finalisation de l'envoi…"}
        </p>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent ?? undefined}
          className="h-2 w-64 overflow-hidden rounded-full bg-muted"
        >
          <div
            className={cn(
              "h-full rounded-full bg-foreground transition-[width]",
              percent === null && "animate-pulse",
            )}
            style={{ width: percent === null ? "100%" : `${percent}%` }}
          />
        </div>
        <p className="text-[12px] font-bold tabular-nums text-muted-foreground">
          {percent === null
            ? "Finalisation côté serveur — ne quittez pas."
            : `${percent} %${sizes} — ne quittez pas cette page.`}
        </p>
      </div>
    </div>
  );
}
