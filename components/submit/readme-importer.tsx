"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { sanitizeImportedMarkdown, type ImportReport } from "@/lib/readme-import";

type Mode = "file" | "paste" | "url";

/**
 * Import README/.md → pré-remplit l'éditeur (jamais direct) : upload,
 * coller, ou URL repo (fetch serveur SSRF-safe). Notice honnête
 * (emojis/badges/images traités, troncation). La validation + preview
 * habituelles s'appliquent ensuite.
 */
export function ReadmeImporter({ onImport }: { onImport: (text: string) => void }) {
  const [mode, setMode] = React.useState<Mode>("file");
  const [paste, setPaste] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [report, setReport] = React.useState<(ImportReport & { chars: number }) | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const apply = (raw: string, base?: string) => {
    const { text, report: r } = sanitizeImportedMarkdown(raw, base ? { base } : undefined);
    if (text.trim().length === 0) {
      setError("Rien d'exploitable après nettoyage.");
      return;
    }
    onImport(text);
    setReport({ ...r, chars: text.length });
    setError(null);
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (!/(\.md|\.markdown|\.txt)$/i.test(f.name) && f.type !== "" && !f.type.startsWith("text/")) {
      setError("Fichier .md ou .txt uniquement.");
      return;
    }
    if (f.size > 500_000) {
      setError("Fichier trop volumineux (500 Ko max).");
      return;
    }
    setError(null);
    setPending(true);
    try {
      const raw = await f.text();
      const { text, report: r } = sanitizeImportedMarkdown(raw);
      if (text.trim().length === 0) {
        setError("Rien d'exploitable après nettoyage.");
        return;
      }
      onImport(text);
      setReport({ ...r, chars: text.length });
      setError(null);
    } catch {
      setError("Lecture impossible.");
    } finally {
      setPending(false);
    }
  };

  const [dragging, setDragging] = React.useState(false);
  const dropFiles = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void onFile(e.dataTransfer.files?.[0]);
  };

  const onFetch = async () => {
    const input = url.trim();
    if (input === "") {
      setError("Collez l'URL du dépôt.");
      return;
    }
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/readme/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: input }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        data?: { markdown?: string; base?: string };
        message?: string;
      } | null;
      if (!res.ok || !json?.ok || typeof json.data?.markdown !== "string") {
        setError(
          typeof json?.message === "string" && json.message !== ""
            ? json.message
            : "Import impossible.",
        );
        return;
      }
      apply(json.data.markdown, json.data.base);
    } catch {
      setError("Connexion interrompue.");
    } finally {
      setPending(false);
    }
  };

  const tabs: { id: Mode; label: string }[] = [
    { id: "file", label: "Fichier" },
    { id: "paste", label: "Coller" },
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
              setError(null);
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
          aria-label="Déposer un fichier .md ou cliquer pour choisir"
          onClick={() => fileRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") fileRef.current?.click();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={dropFiles}
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
            accept=".md,.markdown,.txt,text/plain"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              void onFile(f);
            }}
            className="sr-only"
            aria-label="Choisir un fichier .md"
          />
          <span className="text-[14px] font-bold text-foreground">
            {pending ? "Lecture…" : "Glissez votre README ici"}
          </span>
          <span className="text-[12px] font-medium text-muted-foreground">
            ou <span className="underline underline-offset-2">cliquez pour choisir</span> (.md, .txt
            — 500 Ko max.)
          </span>
        </div>
      )}

      {mode === "paste" && (
        <div className="flex flex-col gap-2">
          <textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            rows={4}
            placeholder="Collez le contenu du README…"
            className="w-full rounded-xl border border-border/60 bg-background px-4 py-3 text-[13px] font-medium text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-foreground/40 resize-y"
          />
          <div>
            <button
              type="button"
              onClick={() => {
                if (paste.trim() === "") {
                  setError("Rien à importer.");
                  return;
                }
                apply(paste);
              }}
              disabled={pending}
              className="rounded-full bg-foreground px-5 py-2 text-[13px] font-bold text-background hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
            >
              Importer ce texte
            </button>
          </div>
        </div>
      )}

      {mode === "url" && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://github.com/user/repo"
              className="flex-1 rounded-xl border border-border/60 bg-background px-4 py-2.5 text-[13px] font-medium text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-foreground/40"
            />
            <button
              type="button"
              onClick={onFetch}
              disabled={pending}
              className="rounded-full bg-foreground px-5 py-2 text-[13px] font-bold text-background hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              {pending ? "Récupération…" : "Récupérer"}
            </button>
          </div>
          <p className="text-[11px] font-medium text-muted-foreground">
            GitHub, GitLab, Bitbucket, Codeberg (ou URL raw directe). Dépôts privés refusés.
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="text-[12px] font-bold text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {report && !error && (
        <p role="status" className="text-[12px] font-medium text-emerald-600 dark:text-emerald-400">
          Importé ({report.chars.toLocaleString("fr-FR")} caractères)
          {report.emojis > 0 && ` · ${report.emojis} emoji${report.emojis > 1 ? "s" : ""} retirés`}
          {report.badges > 0 && ` · ${report.badges} badge${report.badges > 1 ? "s" : ""} retirés`}
          {report.imagesDropped > 0 &&
            ` · ${report.imagesDropped} image${report.imagesDropped > 1 ? "s" : ""} ignorées`}
          {report.truncated && " · tronqué au maximum — complétez dans l'éditeur"}. Relisez et
          ajustez ci-dessous.
        </p>
      )}
    </div>
  );
}
