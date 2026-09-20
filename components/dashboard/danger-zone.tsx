"use client";

import * as React from "react";
import Link from "next/link";
import { TrashIcon } from "@phosphor-icons/react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

// Suppression réelle du compte (§6F) — server action + re-auth au backend.
// Lightweight row: le poids est dans le dialog, pas dans la page.
export function DangerZone({ userEmail }: { userEmail: string }) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1 min-w-0">
          <h2 className="text-[15px] font-extrabold tracking-tight text-foreground">
            Supprimer le compte
          </h2>
          <p className="text-[13px] font-medium text-muted-foreground leading-relaxed">
            Suppression définitive : profil, produits, votes et connexions.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="shrink-0 flex items-center gap-2 rounded-full px-4 py-2.5 text-[14px] font-bold text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
        >
          <TrashIcon weight="bold" className="w-4 h-4" />
          Supprimer
        </button>
      </div>

      <ConfirmDialog
        open={isOpen}
        tone="danger"
        title="Supprimer votre compte ?"
        description={
          <>
            Tout ce qui suit sera définitivement supprimé de nos systèmes,
            conformément à notre{" "}
            <Link
              href="/confidentialite"
              className="font-bold text-foreground underline decoration-border/60 underline-offset-4 hover:decoration-foreground transition-colors"
            >
              politique de confidentialité
            </Link>{" "}
            et nos{" "}
            <Link
              href="/conditions"
              className="font-bold text-foreground underline decoration-border/60 underline-offset-4 hover:decoration-foreground transition-colors"
            >
              conditions d&apos;utilisation
            </Link>
            . Cette action est irréversible.
          </>
        }
        details={[
          "Profil public et avatar",
          "6 produits et leurs fiches",
          "Votes et commentaires",
          "2 clés API connectées",
        ]}
        requireConfirmText={{ expected: userEmail }}
        confirmLabel="Supprimer définitivement"
        onConfirm={() => setIsOpen(false)}
        onCancel={() => setIsOpen(false)}
      />
    </div>
  );
}
