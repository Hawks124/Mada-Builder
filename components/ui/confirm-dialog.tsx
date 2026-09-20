"use client";

import * as React from "react";
import { WarningCircleIcon, XCircleIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

type ConfirmDialogTone = "danger" | "default";

// Shared confirm dialog — desktop-sized, friction proportionnée :
// confirm simple par défaut, liste d'impact + saisie requise pour
// l'irréversible. Backdrop + Escape to dismiss, scroll locked while open.
export function ConfirmDialog({
  open,
  title,
  description,
  details,
  requireConfirmText,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  tone = "default",
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
  const matched =
    !requireConfirmText || input.trim() === requireConfirmText.expected;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) handleCancel();
      }}
      role="presentation"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md rounded-[28px] border border-border/60 bg-background p-7 md:p-8 shadow-2xl flex flex-col gap-5"
      >
        {/* Icon — top level, not in a row with the copy */}
        <div
          className={cn(
            "h-12 w-12 rounded-full flex items-center justify-center shrink-0",
            isDanger ? "bg-red-500/10" : "bg-muted/60",
          )}
        >
          <WarningCircleIcon
            weight="fill"
            className={cn(
              "h-6 w-6",
              isDanger ? "text-red-500" : "text-muted-foreground",
            )}
          />
        </div>

        <div className="flex flex-col gap-1.5 min-w-0">
          <h3 className="text-xl font-extrabold tracking-tight text-foreground leading-snug">
            {title}
          </h3>
          <div className="text-[14px] font-medium text-muted-foreground leading-relaxed">
            {description}
          </div>
        </div>

        {details && details.length > 0 && (
          <ul className="flex flex-col gap-2 rounded-2xl bg-muted/30 border border-border/40 px-5 py-4">
            {details.map((item) => (
              <li
                key={item}
                className="flex items-center gap-2.5 text-[14px] font-medium text-foreground"
              >
                <XCircleIcon
                  weight="fill"
                  className="w-4 h-4 text-red-500 shrink-0"
                  aria-hidden="true"
                />
                {item}
              </li>
            ))}
          </ul>
        )}

        {requireConfirmText && (
          <div className="flex flex-col gap-2">
            <label className="text-[13px] font-bold text-foreground leading-relaxed">
              Pour confirmer, tapez{" "}
              <code className="font-mono text-[13px] bg-muted border border-border/60 rounded-md px-1.5 py-0.5 text-foreground select-all">
                {requireConfirmText.expected}
              </code>{" "}
              ci-dessous
            </label>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={requireConfirmText.placeholder ?? requireConfirmText.expected}
              autoComplete="off"
              className="w-full bg-background border border-border/60 rounded-2xl px-5 py-3.5 text-[15px] font-medium placeholder:text-muted-foreground/30 text-foreground outline-none focus:border-red-500/50 transition-colors"
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-full border border-border/60 px-6 py-3 text-[14px] font-bold text-muted-foreground hover:text-foreground hover:border-border transition-colors cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!matched}
            className={cn(
              "rounded-full px-6 py-3 text-[14px] font-bold text-white transition-colors",
              isDanger
                ? "bg-red-600 hover:bg-red-500 disabled:hover:bg-red-600"
                : "bg-foreground hover:opacity-90 disabled:hover:opacity-100",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
