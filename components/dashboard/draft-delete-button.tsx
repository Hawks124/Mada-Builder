"use client";

import * as React from "react";
import { startTransition } from "react";
import { useRouter } from "next/navigation";
import { TrashIcon } from "@phosphor-icons/react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteMyProductAction } from "@/app/actions/products";

/** Suppression d'un brouillon (RGPD, irréversible, confirmée) + refresh. */
export function DraftDeleteButton({
  productId,
  productName,
}: {
  productId: string;
  productName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const confirmDelete = () => {
    if (deleting) return;
    setDeleting(true);
    setError(null);
    startTransition(async () => {
      const res = await deleteMyProductAction({ productId });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(res.message ?? "Suppression impossible pour le moment.");
      }
      setDeleting(false);
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Supprimer le brouillon ${productName}`}
        title="Supprimer"
        className="shrink-0 flex items-center justify-center h-9 w-9 rounded-full text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
      >
        <TrashIcon weight="bold" className="h-4 w-4" />
      </button>
      <ConfirmDialog
        open={open}
        tone="danger"
        title={`Supprimer le brouillon ${productName} ?`}
        description={
          <>
            Ce brouillon sera définitivement perdu. Cette action est irréversible.
            {error !== null && (
              <span role="alert" className="block mt-2 font-bold text-red-600 dark:text-red-400">
                {error}
              </span>
            )}
          </>
        }
        confirmLabel="Supprimer"
        confirmPending={deleting}
        onConfirm={confirmDelete}
        onCancel={() => {
          setOpen(false);
          setError(null);
        }}
      />
    </>
  );
}
