"use client";

import { useState } from "react";
import { QuestionIcon } from "@phosphor-icons/react";
import { RevenueVerificationSheet } from "./how-it-work";

/**
 * « Comment ça marche ? » — porte seul l'état du panneau, pour que la section
 * de la home puisse rester un composant serveur (elle lit le catalogue).
 */
export function RevenueMethodology() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-haspopup="dialog"
        className="flex cursor-pointer items-center gap-1.5 text-[13px] font-bold text-muted-foreground transition-colors hover:text-foreground"
      >
        <QuestionIcon weight="bold" className="w-4 h-4" />
        Comment ça marche ?
      </button>
      <RevenueVerificationSheet isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
