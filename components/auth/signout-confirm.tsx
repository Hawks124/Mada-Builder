"use client";

import * as React from "react";
import { signOut } from "@/app/actions/auth";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

/**
 * Confirmation de déconnexion partagée (ton neutre : pas une destruction).
 * Tous les boutons "Se déconnecter" (navbar, sidebar dashboard, mobile)
 * passent par ici — copie unique, méthode unique, pending visible
 * (signOut navigue : sans état, le clic semblerait mort).
 */
export function SignOutConfirm({ open, onCancel }: { open: boolean; onCancel: () => void }) {
  const [isPending, setIsPending] = React.useState(false);
  return (
    <ConfirmDialog
      open={open}
      title="Se déconnecter ?"
      tone="danger"
      description="Votre session se terminera. Vous devrez vous reconnecter pour voter, soumettre un produit et suivre vos produits."
      confirmLabel="Se déconnecter"
      confirmPending={isPending}
      onConfirm={() => {
        // Dialog maintenu ouvert pendant la mutation (spinner visible).
        // Succès = redirect serveur (navigation déjà dispatchée par le
        // runtime — le catch évite juste le rejet non géré, jamais de
        // swallow de navigation). Échec = retour à l'état cliquable.
        setIsPending(true);
        void signOut().catch(() => setIsPending(false));
      }}
      onCancel={onCancel}
    />
  );
}
