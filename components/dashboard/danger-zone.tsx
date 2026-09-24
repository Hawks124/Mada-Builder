"use client";

import * as React from "react";
import Link from "next/link";
import { TrashIcon } from "@phosphor-icons/react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { deleteMyAccount } from "@/app/actions/profile";

// Suppression réelle du compte (§6F) — server action deleteMyAccount
// (auth.users + storage + ligne DB, garde dernier-admin) + friction de
// confirmation. Le texte à taper est le USERNAME (slug court, connu via
// l'URL maker) — pas l'email (long, parfois jamais vu en OAuth).
// Fallback email si username indisponible (ligne DB absente).
export function DangerZone({
  userEmail,
  username,
}: {
  userEmail: string;
  username: string | null;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = React.useTransition();

  const confirmText = username ?? userEmail;

  const confirmDelete = () => {
    setError(null);
    startTransition(async () => {
      try {
        await deleteMyAccount();
        // Succès = redirect("/") côté serveur (jamais de retour ici).
      } catch (e) {
        // redirect() lève NEXT_REDIRECT : le laisser propager, jamais
        // l'afficher comme une erreur.
        if (
          e instanceof Error &&
          "digest" in e &&
          typeof (e as { digest?: unknown }).digest === "string" &&
          ((e as { digest: string }).digest.startsWith("NEXT_REDIRECT"))
        ) {
          throw e;
        }
        setError(e instanceof Error ? e.message : "Suppression impossible.");
        setIsOpen(false);
      }
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1 min-w-0">
          <h2 className="text-[15px] font-extrabold tracking-tight text-foreground">
            Supprimer le compte
          </h2>
          <p className="text-[13px] font-medium text-muted-foreground leading-relaxed">
            Suppression définitive : profil, produits, votes et connexions.
            {username && (
              <>
                {" "}
                Votre identifiant :{" "}
                <span className="font-bold text-foreground">@{username}</span>
              </>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          disabled={isPending}
          className="shrink-0 flex items-center gap-2 rounded-full px-4 py-2.5 text-[14px] font-bold text-red-600 dark:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer disabled:opacity-50"
        >
          <TrashIcon weight="bold" className="w-4 h-4" />
          {isPending ? "Suppression…" : "Supprimer"}
        </button>
      </div>
      {error && (
        <p
          role="alert"
          className="text-[13px] font-bold text-red-600 dark:text-red-400"
        >
          {error}
        </p>
      )}

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
        requireConfirmText={{ expected: confirmText }}
        confirmLabel="Supprimer définitivement"
        confirmPending={isPending}
        onConfirm={confirmDelete}
        onCancel={() => setIsOpen(false)}
      />
    </div>
  );
}
