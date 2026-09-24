"use client";

import * as React from "react";
import { WarningCircleIcon, XCircleIcon, InfoIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";

type ConfirmDialogTone = "danger" | "default";

/**
 * Shared confirm dialog — Ergonomie renforcée, 0 scroll mobile,
 * hiérarchie visuelle stricte et gestion sémantique du tone.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  details,
  requireConfirmText,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  tone = "default",
  confirmPending = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: React.ReactNode;
  details?: string[];
  requireConfirmText?: { expected: string; placeholder?: string };
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmDialogTone;
  confirmPending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [input, setInput] = React.useState("");

  const handleCancel = () => {
    setInput("");
    onCancel();
  };

  const handleConfirm = () => {
    setInput("");
    onConfirm();
  };

  React.useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleCancel();
    };
    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onCancel]);

  if (!open) return null;

  const isDanger = tone === "danger";
  const matched = !requireConfirmText || input.trim() === requireConfirmText.expected;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleCancel();
      }}
      role="presentation"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md rounded-2xl border border-border/80 bg-background p-6 shadow-xl flex flex-col gap-5 animate-in zoom-in-95 duration-150"
      >
        {/* Header : Icône + Titre en alignement compact */}
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border",
              isDanger
                ? "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400"
                : "bg-muted border-border/60 text-foreground",
            )}
          >
            <WarningCircleIcon weight="fill" className="h-5 w-5" />
          </div>

          <div className="flex flex-col gap-1 min-w-0 pt-0.5">
            <h3 className="text-lg font-bold tracking-tight text-foreground leading-snug">
              {title}
            </h3>
            <div className="text-sm text-muted-foreground leading-relaxed">{description}</div>
          </div>
        </div>

        {/* Details : Adaptés selon le tone (Rouge si danger, Neutre si default) */}
        {details && details.length > 0 && (
          <ul
            className={cn(
              "flex flex-col gap-2 rounded-xl border p-3.5 text-xs font-medium",
              isDanger
                ? "bg-red-500/5 border-red-500/15 text-red-900 dark:text-red-200"
                : "bg-muted/40 border-border/50 text-foreground",
            )}
          >
            {details.map((item) => (
              <li key={item} className="flex items-start gap-2 leading-relaxed">
                {isDanger ? (
                  <XCircleIcon
                    weight="fill"
                    className="w-4 h-4 text-red-500 shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                ) : (
                  <InfoIcon
                    weight="fill"
                    className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                )}
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Input de confirmation explicite */}
        {requireConfirmText && (
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-foreground leading-relaxed">
              Pour confirmer, saisissez{" "}
              <code className="font-mono text-xs bg-muted border border-border/60 rounded px-1.5 py-0.5 text-foreground select-all">
                {requireConfirmText.expected}
              </code>
            </label>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={requireConfirmText.placeholder ?? requireConfirmText.expected}
              autoComplete="off"
              className={cn(
                "w-full bg-background border rounded-xl px-3.5 py-2.5 text-sm font-medium text-foreground outline-none transition-all placeholder:text-muted-foreground/40",
                isDanger
                  ? "border-border/80 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
                  : "border-border/80 focus:border-foreground focus:ring-2 focus:ring-foreground/10",
              )}
            />
          </div>
        )}

        {/* Actions : Responsive (empilés sur mobile, alignés à droite sur desktop) */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-2.5 pt-1">
          <button
            type="button"
            onClick={handleCancel}
            disabled={confirmPending}
            className="rounded-xl border border-border/80 px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-muted/60 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!matched || confirmPending}
            className={cn(
              "rounded-xl px-4 py-2.5 text-xs font-semibold text-white transition-all inline-flex items-center justify-center gap-2 cursor-pointer shadow-sm",
              isDanger
                ? "bg-red-600 hover:bg-red-500 active:bg-red-700 disabled:bg-red-600/50"
                : "bg-foreground text-background hover:opacity-90 active:opacity-100 disabled:opacity-40",
              "disabled:cursor-not-allowed",
            )}
          >
            {confirmPending && <Spinner size="sm" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
