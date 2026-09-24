"use client";

import * as React from "react";
import {
  XIcon,
  WarningCircleIcon,
  UploadSimpleIcon,
  FilePdfIcon,
  ImageIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { toast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import {
  getAppealEligibilityAction,
  submitAppealAction,
  type AppealActionState,
} from "@/app/actions/appeals";

const ACCEPT = "image/png,image/jpeg,image/webp,application/pdf";
const MAX_FILES = 3;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 Mo

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export function AppealDialog({
  open,
  banReason,
  onClose,
}: {
  open: boolean;
  banReason: string | null;
  onClose: () => void;
}) {
  const [state, action, pending] = React.useActionState(submitAppealAction, {
    ok: false,
    message: null,
  } as AppealActionState);

  const [explanation, setExplanation] = React.useState("");
  const [selectedFiles, setSelectedFiles] = React.useState<File[]>([]);
  const [fileError, setFileError] = React.useState<string | null>(null);
  // Éligibilité (rate limit) connue AVANT le clic : bouton et form suivent.
  const [eligibility, setEligibility] = React.useState<
    { ok: true } | { ok: false; message: string } | null
  >(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  // Succès détecté par TRANSITION false→true (pas par égalité de message :
  // deux succès identiques ne doivent pas s'annuler). Reset garanti à
  // l'ouverture (formulaire toujours frais) comme au succès.
  const wasOk = React.useRef(false);

  const resetForm = () => {
    setExplanation("");
    setSelectedFiles([]);
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  React.useEffect(() => {
    if (!open) return;
    // Reset à l'ouverture (formulaire toujours frais) — pattern maison
    // (cf. signin-form) : setState d'initialisation dans l'effet mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExplanation("");
    setSelectedFiles([]);
    setFileError(null);
    setEligibility(null);
    wasOk.current = false;
    if (fileInputRef.current) fileInputRef.current.value = "";
    let cancelled = false;
    void (async () => {
      try {
        const result = await getAppealEligibilityAction();
        if (!cancelled) setEligibility(result);
      } catch {
        if (!cancelled) {
          setEligibility({ ok: false, message: "Vérification impossible." });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Synchronise l'état local des fichiers avec le vrai <input type="file" name="evidence">
  const syncFileInput = (files: File[]) => {
    if (!fileInputRef.current) return;
    const dt = new DataTransfer();
    files.forEach((f) => dt.items.add(f));
    fileInputRef.current.files = dt.files;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    if (!e.target.files) return;

    const incoming = Array.from(e.target.files);
    const totalCount = selectedFiles.length + incoming.length;

    if (totalCount > MAX_FILES) {
      setFileError(`Vous ne pouvez pas joindre plus de ${MAX_FILES} fichiers.`);
      return;
    }

    const invalidSize = incoming.find((f) => f.size > MAX_FILE_SIZE);
    if (invalidSize) {
      setFileError(
        `Le fichier "${invalidSize.name}" dépasse la limite de 10 Mo.`,
      );
      return;
    }

    const updated = [...selectedFiles, ...incoming];
    setSelectedFiles(updated);
    syncFileInput(updated);
  };

  const removeFile = (index: number) => {
    setFileError(null);
    const updated = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(updated);
    syncFileInput(updated);
  };

  React.useEffect(() => {
    if (state.ok && !wasOk.current) {
      wasOk.current = true;
      toast("ok", state.message ?? "Appel envoyé.");
      resetForm();
      onClose();
    }
    if (!state.ok) {
      wasOk.current = false;
    }
  }, [state, onClose]);

  React.useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose, pending]);

  if (!open) return null;

  const charCount = explanation.trim().length;
  const isTooShort = charCount < 10;
  const isTooLong = charCount > 2000;
  const isValid = !isTooShort && !isTooLong && !fileError;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Contester la suspension"
        className="w-full max-w-lg rounded-[28px] border border-border/80 bg-background shadow-2xl flex flex-col max-h-[85vh] sm:max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200"
      >
        {/* 1. Header Fixe (Jamais rogné) */}
        <div className="px-6 py-5 border-b border-border/50 flex items-start justify-between gap-4 shrink-0 bg-background">
          <div className="flex flex-col gap-1 min-w-0">
            <h3 className="text-xl font-black tracking-tight text-foreground">
              Contester la suspension
            </h3>
            <p className="text-xs font-medium text-muted-foreground leading-relaxed">
              Expliquez la situation. L&apos;équipe examinera votre dossier sous
              quelques jours.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            aria-label="Fermer"
            className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0 cursor-pointer disabled:opacity-50"
          >
            <XIcon weight="bold" className="w-5 h-5" />
          </button>
        </div>

        {/* 2. Corps de la modale (Scrollable uniquement si nécessaire) */}
        <form
          id="appeal-form"
          action={action}
          className="flex flex-col flex-1 overflow-y-auto"
        >
          <div className="p-6 flex flex-col gap-6">
            {/* Banner motif du ban */}
            <div className=" p-4 flex items-start gap-3.5">
              <div className="p-2 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 shrink-0">
                <WarningCircleIcon weight="fill" className="w-5 h-5" />
              </div>
              <div className="flex flex-col gap-1 min-w-0">
                <span className="text-[11px] font-black uppercase tracking-wider text-red-600 dark:text-red-400">
                  Motif de la suspension
                </span>
                <p className="text-sm font-medium text-foreground leading-relaxed break-words">
                  {banReason ?? "Aucun motif spécifié."}
                </p>
              </div>
            </div>

            {/* Champ explication */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="appeal-explanation"
                  className="text-xs font-bold text-foreground uppercase tracking-wider"
                >
                  Votre explication <span className="text-red-500">*</span>
                </label>
                <span
                  className={cn(
                    "text-xs font-semibold",
                    isTooLong
                      ? "text-red-600 dark:text-red-400"
                      : isTooShort
                        ? "text-muted-foreground"
                        : "text-emerald-600 dark:text-emerald-400",
                  )}
                >
                  {charCount} / 2000
                </span>
              </div>

              <textarea
                id="appeal-explanation"
                name="explanation"
                rows={4}
                required
                minLength={10}
                maxLength={2000}
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                placeholder="Exposez les faits, le contexte ou pourquoi vous pensez qu'il s'agit d'une erreur…"
                disabled={pending}
                className={cn(
                  "w-full bg-background border rounded-2xl p-4 text-sm font-medium text-foreground outline-none resize-none leading-relaxed transition-all placeholder:text-muted-foreground/40",
                  isTooLong
                    ? "border-red-500 focus:ring-2 focus:ring-red-500/20"
                    : "border-border/80 focus:border-foreground focus:ring-2 focus:ring-foreground/10",
                )}
              />
              {isTooShort && charCount > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Encore au moins {10 - charCount} caractère(s) requis.
                </p>
              )}
            </div>

            {/* Pièces jointes sur-mesure */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Pièces jointes{" "}
                  <span className="font-normal text-muted-foreground">
                    (optionnel)
                  </span>
                </label>
                <span className="text-xs font-semibold text-muted-foreground">
                  {selectedFiles.length} / {MAX_FILES} max
                </span>
              </div>

              {/* Native Input caché pour le form submission */}
              <input
                ref={fileInputRef}
                id="appeal-evidence"
                name="evidence"
                type="file"
                accept={ACCEPT}
                multiple
                onChange={handleFileChange}
                className="hidden"
                disabled={pending}
              />

              {/* Zone de bouton upload custom */}
              {selectedFiles.length < MAX_FILES && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-border/80 hover:border-foreground/40 rounded-2xl p-4 flex items-center justify-center gap-3 bg-muted/20 hover:bg-muted/40 transition-all cursor-pointer text-muted-foreground hover:text-foreground group"
                >
                  <UploadSimpleIcon
                    weight="bold"
                    className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors"
                  />
                  <span className="text-xs font-bold">
                    Ajouter un fichier{" "}
                    <span className="font-normal text-muted-foreground">
                      (PDF, PNG, JPG ≤ 10 Mo)
                    </span>
                  </span>
                </button>
              )}

              {/* Liste des fichiers sélectionnés */}
              {selectedFiles.length > 0 && (
                <ul className="flex flex-col gap-2">
                  {selectedFiles.map((file, idx) => {
                    const isPdf = file.type === "application/pdf";
                    return (
                      <li
                        key={`${file.name}-${idx}`}
                        className="flex items-center justify-between gap-3 bg-muted/40 border border-border/60 rounded-xl px-3.5 py-2.5 text-xs font-medium"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {isPdf ? (
                            <FilePdfIcon
                              weight="fill"
                              className="w-5 h-5 text-red-500 shrink-0"
                            />
                          ) : (
                            <ImageIcon
                              weight="fill"
                              className="w-5 h-5 text-blue-500 shrink-0"
                            />
                          )}
                          <span className="truncate text-foreground font-semibold">
                            {file.name}
                          </span>
                          <span className="text-muted-foreground shrink-0 text-[11px]">
                            ({formatFileSize(file.size)})
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(idx)}
                          disabled={pending}
                          className="text-muted-foreground hover:text-red-500 p-1 transition-colors cursor-pointer"
                          aria-label={`Supprimer ${file.name}`}
                        >
                          <TrashIcon weight="bold" className="w-4 h-4" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {(fileError || (!state.ok && state.message)) && (
                <p
                  role="alert"
                  className="text-xs font-bold text-red-600 dark:text-red-400 bg-red-500/10 p-3 rounded-xl border border-red-500/20"
                >
                  {fileError || state.message}
                </p>
              )}
              {/* Rate limit connu avant le clic : message + submit verrouillé. */}
              {eligibility && !eligibility.ok && (
                <p
                  role="status"
                  className="text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 p-3 rounded-xl border border-amber-500/20"
                >
                  {eligibility.message}
                </p>
              )}
            </div>
          </div>
        </form>

        {/* 3. Footer Fixe (Boutons ancrés en bas) */}
        <div className="px-6 py-4 border-t border-border/50 flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-2.5 bg-background shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-full border border-border/80 px-5 py-2.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
          >
            Annuler
          </button>
            <button
              form="appeal-form"
              type="submit"
              disabled={pending || !isValid || (eligibility !== null && !eligibility.ok)}
            className="rounded-full bg-foreground text-background px-6 py-2.5 text-xs font-bold hover:opacity-90 active:scale-[0.98] transition-all inline-flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {pending && <Spinner size="sm" />}
            {pending ? "Envoi en cours…" : "Envoyer l'appel"}
          </button>
        </div>
      </div>
    </div>
  );
}
