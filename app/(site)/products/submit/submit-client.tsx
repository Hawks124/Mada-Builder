"use client";
import * as React from "react";
import Link from "next/link";
import { SubmitGuidanceSidebar } from "@/components/submit/submit-guidance-sidebar";
import { SubmitBasicsSection } from "@/components/submit/submit-basics-section";
import { SubmitCategoriesSection } from "@/components/submit/submit-categories-section";
import { SubmitMetadataSection } from "@/components/submit/submit-metadata-section";
import { SubmitMarketsSection } from "@/components/submit/submit-markets-section";
import { InlineErrorSummary } from "@/components/submit/inline-error-summary";
import { SubmitMediaSection } from "@/components/submit/submit-media-section";
import { SubmitLinksSection } from "@/components/submit/submit-links-section";
import { SubmitLinksSummary } from "@/components/submit/submit-links-summary";
import { SubmitFormProvider, useSubmitForm } from "@/components/submit/submit-form-context";
import { useSubmitXhr } from "@/components/submit/use-submit-xhr";
import { SubmitProgressOverlay } from "@/components/submit/submit-progress-overlay";
import { loadSubmitDraft, saveSubmitDraft } from "@/components/submit/submit-draft";
import type { DashboardApp } from "@/components/dashboard/dashboard-mock";
import { ActionButton } from "@/components/ui/action-button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

function SubmitForm() {
  const { isEditing, editApp, productType, lifecycle, audience, pricing } = useSubmitForm();
  // Brouillon auto (création) : chaque frappe persiste (debounce 800 ms),
  // restaurée au retour. Jamais en édition (la fiche DB fait foi).
  // Garde anti-perte : le moindre input/clic salit le formulaire.
  // - refresh / fermeture / lien externe : `beforeunload` natif ;
  // - bouton back/forward navigateur (SPA : pas d'unload) : entrée factice
  //   + `popstate` → modale de confirmation. Confirmer = `go(-2)` (le back
  //   n'a consommé que la factice) ; refuser = garde réarmée.
  // Succès = redirect (démontage, pas de reset nécessaire). Limite assumée :
  // les liens in-app Next ne sont pas interceptables (pas d'équivalent
  // beforePopState en App Router) — back navigateur + unload couverts.
  const [dirty, setDirty] = React.useState(false);
  const [leaveOpen, setLeaveOpen] = React.useState(false);
  const confirmedLeave = React.useRef(false);
  React.useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    const onPopState = () => {
      if (confirmedLeave.current) return;
      // Le back a consommé la factice (URL inchangée) : réarmer + demander.
      window.history.pushState({ submitGuard: true }, "");
      setLeaveOpen(true);
    };
    window.history.pushState({ submitGuard: true }, "");
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("popstate", onPopState);
    };
  }, [dirty]);
  const confirmLeave = () => {
    confirmedLeave.current = true;
    setLeaveOpen(false);
    window.history.go(-2);
  };
  const intentRef = React.useRef<"publish" | "draft">("draft");
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = React.useRef<HTMLFormElement | null>(null);
  const { phase, sending, serverMessage, activeIntent, send } = useSubmitXhr(formRef);
  // Entrée clavier = standard HTML (premier bouton = brouillon) : après
  // chaque tentative, l'intention retombe à "draft" (jamais de publish
  // surprise suite à un échec publish précédent).
  React.useEffect(() => {
    if (phase.name === "idle") intentRef.current = "draft";
  }, [phase]);
  React.useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);
  const queueDraftSave = React.useCallback(() => {
    if (isEditing) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (formRef.current) saveSubmitDraft(formRef.current);
    }, 800);
  }, [isEditing]);

  return (
    <main className="min-h-screen bg-background relative selection:bg-foreground selection:text-background">
      <SubmitProgressOverlay phase={phase} intent={activeIntent} />
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="flex flex-col gap-3">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-foreground">
            {isEditing ? "Modifier le produit" : "Soumettre un produit"}
          </h1>
          <p className="text-lg md:text-xl font-medium text-muted-foreground max-w-2xl">
            {isEditing && editApp
              ? `Modifiez la fiche de ${editApp.name}. Les changements sur le nom et les liens repassent en revue.`
              : "Ajoutez votre application pour que la communauté de makers de Madagascar puisse la découvrir et la soutenir."}
          </p>
        </div>
      </div>

      {/* ── 2-Column Layout (70 / 30) ── */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-32">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 items-start">
          {/* Main Form (70%) : onInput (saisie) + onClick (toggles, pills,
              uploads — des boutons, pas des inputs) pour un dirty complet. */}
          <form
            ref={formRef}
            onSubmit={(e) => {
              e.preventDefault();
              send(intentRef.current);
            }}
            onInput={() => {
              setDirty(true);
              queueDraftSave();
            }}
            onClick={() => {
              setDirty(true);
              queueDraftSave();
            }}
            className="lg:col-span-8 flex flex-col gap-24"
          >
            {/* Contexte (type, cycle, audience, pricing) — le serveur valide tout. */}
            <input type="hidden" name="productType" value={productType} />
            <input type="hidden" name="lifecycle" value={lifecycle} />
            <input type="hidden" name="audience" value={audience} />
            <input type="hidden" name="pricing" value={pricing} />
            <SubmitBasicsSection />
            <div className="w-full h-px bg-border/40" />

            <SubmitCategoriesSection />
            <div className="w-full h-px bg-border/40" />

            <SubmitLinksSection />
            <div className="w-full h-px bg-border/40" />

            <SubmitMetadataSection />
            <div className="w-full h-px bg-border/40" />

            <SubmitMarketsSection />
            <div className="w-full h-px bg-border/40" />

            <SubmitMediaSection />

            {/* Bottom Actions */}
            <SubmitLinksSummary />
            {serverMessage && (
              <p role="alert" className="text-[14px] font-bold text-red-600 dark:text-red-400">
                {serverMessage}
              </p>
            )}
            <InlineErrorSummary />
            <div className="flex items-center justify-end gap-4 pt-8">
              <button
                type="submit"
                disabled={sending}
                onClick={() => {
                  intentRef.current = "draft";
                }}
                className="px-6 h-12 bg-muted/30 text-foreground hover:bg-muted/60 rounded-full text-[15px] font-bold tracking-wide transition-colors cursor-pointer disabled:opacity-50"
              >
                {sending ? "Enregistrement…" : "Enregistrer le brouillon"}
              </button>
              <ActionButton
                className="h-12 px-8"
                actionType="button"
                disabled={sending}
                onClick={() => {
                  intentRef.current = "publish";
                  formRef.current?.requestSubmit();
                }}
              >
                {sending
                  ? "Envoi…"
                  : isEditing
                    ? "Enregistrer les modifications"
                    : "Publier le produit"}
              </ActionButton>
            </div>
          </form>

          {/* Sticky Sidebar (30%) */}
          <div className="lg:col-span-4 hidden lg:block">
            <SubmitGuidanceSidebar />
          </div>
        </div>
      </div>
      {/* Garde back navigateur : quitter = perdre la saisie non enregistrée. */}
      <ConfirmDialog
        open={leaveOpen}
        tone="danger"
        title="Quitter sans enregistrer ?"
        description="Vos modifications seront définitivement perdues. Enregistrez un brouillon pour les retrouver plus tard."
        confirmLabel="Quitter sans enregistrer"
        cancelLabel="Rester"
        onConfirm={confirmLeave}
        onCancel={() => setLeaveOpen(false)}
      />
    </main>
  );
}

/**
 * Îlot client : `editId` inconnu ou autrui → état honnête (jamais de
 * formulaire vide qui écraserait une fiche au submit).
 */
export function SubmitClient({
  editId,
  editApp,
  editMedia,
}: {
  editId: string | null;
  editApp: DashboardApp | null;
  editMedia?: {
    iconUrl: string | null;
    shots: { url: string; width: number | null; height: number | null }[];
  } | null;
}) {
  // Hook AVANT tout return (règles des hooks) — inactif en édition.
  const initialDraft = useInitialDraft(editId);
  // Remontage à la restauration : 1er rendu IDENTIQUE serveur/client
  // (pas de draft), puis le brouillon remonte tout le formulaire.
  const [restored, setRestored] = React.useState(false);
  React.useEffect(() => {
    // Remontage post-hydratation uniquement (brouillon local) : le 1er
    // rendu reste SSR-identique, pas de cascade (une fois par montage).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (initialDraft) setRestored(true);
  }, [initialDraft]);
  if (editId && !editApp) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <p className="text-xl font-extrabold tracking-tight text-foreground">Fiche introuvable</p>
          <p className="text-[14px] font-medium text-muted-foreground leading-relaxed">
            Cette fiche n&apos;existe pas ou ne vous appartient pas.
          </p>
          <Link
            href="/dashboard/drafts"
            className="text-[14px] font-bold text-foreground underline decoration-border/60 underline-offset-4 hover:decoration-foreground transition-colors"
          >
            Retour aux brouillons
          </Link>
        </div>
      </main>
    );
  }
  return (
    <SubmitFormProvider
      editApp={editApp}
      initialDraft={initialDraft}
      existingMedia={editMedia}
      key={`${editId ?? "new"}:${restored ? "restored" : "fresh"}`}
    >
      <SubmitForm />
    </SubmitFormProvider>
  );
}

function useInitialDraft(editId: string | null): Record<string, string> | null {
  // Premier rendu : null des DEUX côtés (SSR-identique). Le brouillon
  // local ne se lit qu'après montage (jamais pendant le rendu — sinon
  // le HTML client diverge du serveur).
  const [draft, setDraft] = React.useState<Record<string, string> | null>(null);
  React.useEffect(() => {
    // Lecture locale post-hydratation uniquement (une fois par montage).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!editId) setDraft(loadSubmitDraft());
  }, [editId]);
  return draft;
}
