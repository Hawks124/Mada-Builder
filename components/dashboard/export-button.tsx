"use client";

import * as React from "react";
import { Spinner } from "@/components/ui/spinner";

/**
 * Export RGPD (settings) : téléchargement avec état visible. Un simple
 * lien ne dit rien pendant la génération (ZIP streamé : les premiers
 * octets peuvent mettre des secondes à arriver quand R2 est lent).
 * Ici : spinner + « Préparation… », puis download via blob ; erreur
 * affichée au lieu d'un onglet mort.
 */
export function ExportButton() {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const run = async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/me/export");
      if (res.status === 429) {
        throw new Error("Trop de demandes — réessayez dans une heure.");
      }
      if (!res.ok) {
        throw new Error("Export impossible pour le moment.");
      }
      const blob = await res.blob();
      const name =
        res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ??
        "mada-made-export.zip";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export impossible pour le moment.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 shrink-0">
      <button
        type="button"
        onClick={() => void run()}
        disabled={pending}
        className="flex items-center justify-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-[13px] font-bold text-background hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-wait"
      >
        {pending && <Spinner size="xs" />}
        {pending ? "Préparation…" : "Télécharger l'archive"}
      </button>
      {error && (
        <p role="alert" className="text-[12px] font-bold text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
