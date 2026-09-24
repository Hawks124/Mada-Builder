"use client";

import * as React from "react";
import Link from "next/link";
import {
  SignOutIcon,
  TrashIcon,
  ArrowRightIcon,
  ShieldWarningIcon,
  CaretDownIcon,
  LockKeyIcon,
} from "@phosphor-icons/react";
import { SignOutConfirm } from "@/components/auth/signout-confirm";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { LogoMark } from "@/components/ui/logo";
import { AppealDialog } from "@/components/dashboard/appeal-dialog";
import { deleteMyAccount } from "@/app/actions/profile";
import { getDaypartGreeting } from "@/lib/greeting";
import { GridBackground } from "../ui/grid-background";

export function SuspendedScreen({
  displayName,
  banReason,
  username,
}: {
  displayName: string;
  banReason: string | null;
  username: string;
}) {
  const [signoutOpen, setSignoutOpen] = React.useState(false);
  const [appealOpen, setAppealOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [deleting, startDeleting] = React.useTransition();

  const confirmDelete = () => {
    setDeleteError(null);
    startDeleting(async () => {
      try {
        await deleteMyAccount();
      } catch (e) {
        if (
          e instanceof Error &&
          "digest" in e &&
          typeof (e as { digest?: unknown }).digest === "string" &&
          (e as { digest: string }).digest.startsWith("NEXT_REDIRECT")
        ) {
          throw e;
        }
        setDeleteError(e instanceof Error ? e.message : "Suppression impossible.");
        setDeleteOpen(false);
      }
    });
  };

  return (
    <div className="relative min-h-screen w-full bg-background text-foreground flex flex-col font-sans selection:bg-foreground selection:text-background">
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none opacity-80">
        <GridBackground variant="css" showBottomFade={false} />
      </div>
      {/* HEADER */}
      <header className="sticky top-0 z-30 w-full px-6 py-5 sm:px-12 flex items-center justify-between shrink-0 bg-background/30 backdrop-blur-xl border-b border-transparent">
        <Link
          href="/"
          aria-label="Retour à l'accueil"
          className="hover:opacity-70 transition-opacity"
        >
          <LogoMark className="h-10 w-10" variant="bare" />
        </Link>

        <button
          type="button"
          onClick={() => setSignoutOpen(true)}
          className="group flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <span className="hidden sm:inline">Se déconnecter</span>
          <SignOutIcon
            weight="bold"
            className="h-4 w-4 transition-transform group-hover:translate-x-1"
          />
        </button>
      </header>

      {/* CORPS DE LA PAGE */}
      <main className="flex-1 w-full max-w-3xl mx-auto px-6 sm:px-10 py-16 pb-52">
        <div className="inline-flex items-center gap-2.5 text-red-600 text-xs font-extrabold uppercase tracking-widest mb-8">
          <ShieldWarningIcon weight="fill" className="w-4 h-4 animate-pulse" />
          <span>Accès refusé</span>
        </div>

        <h1 className="text-5xl sm:text-7xl font-black tracking-tighter text-red-400 mb-8 leading-[0.95]">
          Compte
          <br />
          Suspendu.
        </h1>

        {/* Description sans amalgame du droit à l'oubli */}
        <div className="text-base sm:text-lg font-medium text-muted-foreground leading-relaxed mb-12">
          <p className="mb-2">
            {getDaypartGreeting()}{" "}
            <span className="text-foreground font-bold "> {displayName}</span> 👋,
          </p>
          <p>
            Votre compte a été restreint par notre équipe de modération. Vos contenus publics
            restent visibles, mais votre accès en écriture et vos actions sont verrouillés : plus de
            vote, de soumission, ni de modification de profil, jusqu&apos;à nouvel ordre.
          </p>
        </div>

        {/* MÉTADONNÉES PUREMENT INFORMATIVES (Style neutre) */}
        <div className="flex flex-col border-t border-border/30">
          <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/30">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Compte restreint
            </span>
            <span className="text-sm font-medium font-mono text-muted-foreground">@{username}</span>
          </div>

          <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/30">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Statut des droits
            </span>
            <span className="inline-flex items-center gap-1.5 text-sm font-bold text-red-600 dark:text-red-500">
              <LockKeyIcon weight="bold" className="w-4 h-4" />
              Lecture seule uniquement
            </span>
          </div>
        </div>

        {/* MOTIF DE LA DÉCISION (Mise en valeur épurée) */}
        <div className="mt-10 mb-12">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-3">
            Motif officiel de la décision
          </span>
          <div className="p-5 rounded-xl bg-muted/40 border border-border/40 text-foreground font-semibold text-base sm:text-lg leading-relaxed wrap-break-word">
            {banReason ? banReason : "Aucun motif spécifique indiqué."}
          </div>
        </div>

        {/* SECTION DROIT À L'OUBLI & SUPPRESSION (Regroupés correctement) */}
        <div className="border-t border-border/30 pt-8 pb-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Droit à l&apos;oubli (RGPD)
            </span>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-xl">
              Conformément à la réglementation sur la protection des données, votre droit à
              l&apos;oubli reste entier. Vous pouvez demander à tout moment la suppression
              définitive de votre compte et de l&apos;ensemble de vos données personnelles de nos
              serveurs.
            </p>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              disabled={deleting}
              className="inline-flex items-center gap-2 text-sm font-semibold text-red-600 hover:text-red-700 dark:text-red-500 dark:hover:text-red-400 transition-colors cursor-pointer disabled:opacity-50"
            >
              <TrashIcon weight="bold" className="w-4 h-4" />
              <span>
                {deleting ? "Suppression en cours…" : "Supprimer définitivement ce compte"}
              </span>
            </button>
          </div>

          {deleteError && (
            <p
              role="alert"
              className="text-xs font-semibold text-red-600 bg-red-500/10 px-3 py-2 rounded-md w-fit"
            >
              {deleteError}
            </p>
          )}
        </div>

        {/* CLAUSE JURIDIQUE & LIENS PRIVACY / TERMS */}
        <div className="border-t border-border/30 pt-6 text-xs text-muted-foreground leading-relaxed">
          Pour toute précision sur nos règles de modération, vos droits et la gestion de vos
          données, veuillez consulter nos{" "}
          <Link
            href="/terms"
            className="underline underline-offset-2 hover:text-foreground transition-colors font-medium"
          >
            Conditions Générales d&apos;Utilisation
          </Link>{" "}
          ainsi que notre{" "}
          <Link
            href="/privacy"
            className="underline underline-offset-2 hover:text-foreground transition-colors font-medium"
          >
            Politique de Confidentialité
          </Link>
          .
        </div>
      </main>

      {/* DOCK FIXE EN BAS */}
      <aside className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-xl border-t border-border/20 px-6 py-4 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <div className="hidden md:flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <CaretDownIcon weight="bold" className="w-4 h-4 animate-bounce text-foreground" />
            <span>Faites défiler pour consulter le motif &amp; les options de compte</span>
          </div>

          <div className="w-full md:w-auto flex items-center justify-end">
            <button
              type="button"
              onClick={() => setAppealOpen(true)}
              className="group w-full rounded-full md:w-auto inline-flex items-center justify-center gap-3 bg-foreground text-background hover:bg-foreground/90 active:scale-[0.98] font-bold text-sm px-8 py-3.5 transition-all cursor-pointer shrink-0"
            >
              <span>Faire appel de la décision</span>
              <ArrowRightIcon
                weight="bold"
                className="w-4 h-4 transition-transform group-hover:translate-x-1"
              />
            </button>
          </div>
        </div>
      </aside>

      {/* MODALES */}
      <SignOutConfirm open={signoutOpen} onCancel={() => setSignoutOpen(false)} />
      <ConfirmDialog
        open={deleteOpen}
        tone="danger"
        title="Droit à l'oubli"
        description="Cette action est irréversible. Toutes vos données seront définitivement effacées."
        requireConfirmText={{ expected: username }}
        confirmLabel="Effacer mes données"
        confirmPending={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteOpen(false)}
      />
      <AppealDialog open={appealOpen} banReason={banReason} onClose={() => setAppealOpen(false)} />
    </div>
  );
}
