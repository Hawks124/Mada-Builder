"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { createPortal } from "react-dom";
import { XIcon, ArrowSquareOutIcon, CheckCircleIcon } from "@phosphor-icons/react";
import { useMounted } from "@/lib/use-mounted";
import { cn } from "@/lib/utils";
import {
  REVENUE_CONFIG_SPECS,
  REVENUE_PROVIDER_IDS,
  type RevenueProviderId,
} from "@/services/revenue/types";

/**
 * Slide-over « Quel prestataire ? » — les 5 providers au moment de
 * motivation maximale (soumission BÊTA).
 *
 * Les pills du formulaire sélectionnent vite ; le slide-over explique :
 * quelle clé créer, quel champ en plus, et le lien direct vers l'ancre
 * `#creer-la-cle` du guide. Choisir dans le panneau sélectionne aussi
 * (un seul geste, pas deux).
 *
 * Portail body + Escape + scroll-lock : même pattern que `ConfirmDialog`
 * (header en backdrop-blur = contexte d'empilement, un `fixed` non
 * portailé sort rogné).
 */
export function RevenueProviderSheet({
  open,
  selected,
  onSelect,
  onClose,
}: {
  open: boolean;
  selected: RevenueProviderId;
  onSelect: (id: RevenueProviderId) => void;
  onClose: () => void;
}) {
  const mounted = useMounted();
  const closeRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choisir un prestataire de paiement"
        className="absolute inset-x-0 bottom-0 top-auto max-h-[88dvh] overflow-y-auto rounded-t-3xl border-t border-border/80 bg-background p-6 pb-8 flex flex-col gap-5 animate-in slide-in-from-bottom duration-200 sm:inset-y-0 sm:left-auto sm:right-0 sm:top-0 sm:w-full sm:max-w-md sm:rounded-none sm:rounded-l-3xl sm:border-t-0 sm:border-l sm:p-8 sm:animate-in sm:slide-in-from-right"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-xl font-black tracking-tight text-foreground">
              Quel prestataire ?
            </h3>
            <p className="text-[13px] font-medium text-muted-foreground leading-relaxed">
              Celui qui encaisse vos abonnements. Une clé en lecture seule suffit — jamais de clé
              d&apos;écriture.
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-full p-2 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer shrink-0"
          >
            <XIcon weight="bold" className="w-5 h-5" />
          </button>
        </div>

        <ul className="flex flex-col gap-3">
          {REVENUE_PROVIDER_IDS.map((id) => {
            const spec = REVENUE_CONFIG_SPECS[id];
            const isSelected = selected === id;
            return (
              <li
                key={id}
                className={cn(
                  "flex flex-col gap-3 rounded-2xl border p-4 transition-colors",
                  isSelected
                    ? "border-foreground/40 bg-muted/40"
                    : "border-border/60 bg-background",
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="h-10 w-10 rounded-xl bg-background border border-border/40 flex items-center justify-center shrink-0 overflow-hidden">
                    <Image
                      src={spec.logo}
                      alt=""
                      aria-hidden="true"
                      width={32}
                      height={32}
                      className="object-contain w-6 h-6"
                    />
                  </span>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[15px] font-extrabold text-foreground leading-tight">
                      {spec.label}
                    </span>
                    <span className="text-[12px] font-medium text-muted-foreground truncate">
                      Clé : {spec.keyFormat.example}
                      {spec.extraFields.length > 0 &&
                        ` · + ${spec.extraFields.map((f) => f.label.toLowerCase()).join(" + ")}`}
                    </span>
                  </div>
                  {isSelected && (
                    <CheckCircleIcon
                      weight="fill"
                      className="w-5 h-5 text-emerald-600 dark:text-emerald-400 ml-auto shrink-0"
                      aria-label="Sélectionné"
                    />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(id);
                      onClose();
                    }}
                    className={cn(
                      "flex-1 rounded-full px-4 py-2 text-[13px] font-bold transition-colors cursor-pointer border",
                      isSelected
                        ? "bg-foreground text-background border-transparent"
                        : "border-border/60 text-foreground hover:bg-muted/60",
                    )}
                  >
                    {isSelected ? "Sélectionné" : `Choisir ${spec.label}`}
                  </button>
                  <Link
                    href={`/guides/revenus-verifies/${spec.guideSlug}#creer-la-cle`}
                    className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-[13px] font-bold text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Guide
                    <ArrowSquareOutIcon weight="bold" className="w-4 h-4" />
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>

        <p className="text-[12px] font-medium text-muted-foreground leading-relaxed">
          Vérifiée immédiatement, chiffrée (AES-256) dès réception, jamais ré-affichée.
        </p>
      </div>
    </div>,
    document.body,
  );
}
