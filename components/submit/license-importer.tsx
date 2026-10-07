"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { detectSpdx } from "@/lib/spdx";

type Mode = "file" | "url";

/**
 * Import licence (SPDX-only) : fichier ou URL → DÉTECTION de l'identifiant
 * (jamais le texte intégral — le champ fait 60 signes). Même standard
 * visuel que `ReadmeImporter` (segmented, dropzone, états sobres).
 * `onApply(id)` pré-remplit le champ (remount par clé côté parent).
 * Inconnue → message franc, saisie manuelle.
 */
export function LicenseImporter({ onApply }: { onApply: (id: string) => void }) {
  const [mode, setMode] = React.useState<Mode>("file");
  const [url, setUrl] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const [message, setMessage] = React.useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const detect = (raw: string, source: string) => {
    const id = detectSpdx(raw);
    if (!id) {
      setMessage({
        tone: "err",
        text: `Licence non reconnue (${source}) — saisissez à la main (ex : MIT).`,
      });
      return;
    }
    onApply(id);
    setMessage({ tone: "ok", text: `Licence détectée : ${id} (${source}). Vérifiez.` });
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    // PAS de filtre `accept` : les fichiers de licence n'ont souvent aucune
    // extension (LICENSE, COPYING, NOTICE) et le dialogue OS les cacherait.
    if (f.size > 200_000) {
      setMessage({ tone: "err", text: "Fichier trop volumineux (200 Ko max)." });
      return;
    }
    setMessage(null);
    setPending(true);
    try {
      detect(await f.text(), "fichier");
    } catch {
      setMessage({ tone: "err", text: "Lecture impossible." });
    } finally {
      setPending(false);
    }
  };

  const onFetch = async () => {
    const input = url.trim();
    if (input === "") {
      setMessage({ tone: "err", text: "Collez l'URL du fichier LICENSE." });
      return;
    }
    setMessage(null);
    setPending(true);
    try {
      const res = await fetch("/api/readme/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: input, mode: "raw" }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        data?: { text?: string };
        message?: string;
      } | null;
      if (!res.ok || !json?.ok || typeof json.data?.text !== "string") {
        setMessage({
          tone: "err",
          text:
            typeof json?.message === "string" && json.message !== ""
              ? json.message
              : "Récupération impossible.",
        });
        return;
      }
      detect(json.data.text, "URL");
    } catch {
      setMessage({ tone: "err", text: "Connexion interrompue." });
    } finally {
      setPending(false);
    }
  };

  const tabs: { id: Mode; label: string }[] = [
    { id: "file", label: "Fichier" },
    { id: "url", label: "Depuis URL" },
  ];

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-muted/20 px-5 py-4">
      <div className="flex items-center gap-1.5">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setMode(t.id);
              setMessage(null);
            }}
            aria-pressed={mode === t.id}
            className={cn(
              "px-3 py-1.5 rounded-full text-[12px] font-bold transition-colors cursor-pointer",
              mode === t.id
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {mode === "file" && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Déposer un fichier de licence ou cliquer pour choisir"
          onClick={() => fileRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") fileRef.current?.click();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void onFile(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors cursor-pointer",
            dragging
              ? "border-foreground/60 bg-muted/60"
              : "border-border/60 hover:border-foreground/30 hover:bg-muted/20",
            pending && "opacity-50 pointer-events-none",
          )}
        >
          <input
            ref={fileRef}
            type="file"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              void onFile(f);
            }}
            className="sr-only"
            aria-label="Choisir un fichier de licence"
          />
          <span className="text-[14px] font-bold text-foreground">
            {pending ? "Lecture…" : "Glissez votre fichier LICENSE ici"}
          </span>
          <span className="text-[12px] font-medium text-muted-foreground">
            ou <span className="underline underline-offset-2">cliquez pour choisir</span> (LICENSE,
            COPYING, NOTICE, .txt, .md — 200 Ko max.)
          </span>
        </div>
      )}

      {mode === "url" && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://github.com/user/repo/blob/main/LICENSE"
              className="flex-1 rounded-xl border border-border/60 bg-background px-4 py-2.5 text-[13px] font-medium text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-foreground/40"
            />
            <button
              type="button"
              onClick={onFetch}
              disabled={pending}
              className="rounded-full bg-foreground px-5 py-2 text-[13px] font-bold text-background hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              {pending ? "Détection…" : "Détecter"}
            </button>
          </div>
          <p className="text-[11px] font-medium text-muted-foreground">
            URL de la page GitHub/GitLab acceptée (convertie en raw) ou URL raw directe.
          </p>
        </div>
      )}

      {message && (
        <p
          role={message.tone === "err" ? "alert" : "status"}
          className={
            message.tone === "err"
              ? "text-[12px] font-bold text-red-600 dark:text-red-400"
              : "text-[12px] font-medium text-emerald-600 dark:text-emerald-400"
          }
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
