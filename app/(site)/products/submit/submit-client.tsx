"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  SubmitGuidanceSidebar,
  GuidanceSupportCard,
} from "@/components/submit/submit-guidance-sidebar";
import { MakerGuidanceSidebar } from "@/components/guidance/maker-guidance-sidebar";
import { SubmitBasicsSection } from "@/components/submit/submit-basics-section";
import { SubmitCategoriesSection } from "@/components/submit/submit-categories-section";
import { SubmitMetadataSection } from "@/components/submit/submit-metadata-section";
import { SubmitMarketsSection } from "@/components/submit/submit-markets-section";
import { InlineErrorSummary } from "@/components/submit/inline-error-summary";
import { SubmitMediaSection } from "@/components/submit/submit-media-section";
import { SubmitApkSection, type PendingApk } from "@/components/submit/submit-apk-section";
import { SubmitLinksSection } from "@/components/submit/submit-links-section";
import { SubmitLinksSummary } from "@/components/submit/submit-links-summary";
import { SubmitFormProvider, useSubmitForm } from "@/components/submit/submit-form-context";
import { useSubmitXhr } from "@/components/submit/use-submit-xhr";
import { SubmitProgressOverlay } from "@/components/submit/submit-progress-overlay";
import { loadSubmitDraft, saveSubmitDraft } from "@/components/submit/submit-draft";
import type { DashboardApp } from "@/components/dashboard/dashboard-mock";
import { ActionButton } from "@/components/ui/action-button";
import { toast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

function SubmitForm() {
  const {
    isEditing,
    editApp,
    productType,
    lifecycle,
    audience,
    pricing,
    platforms,
    hasTrack,
    buildNotes,
    setBuildNotes,
  } = useSubmitForm();
  const router = useRouter();
  const hasAndroid = platforms.includes("android");
  // First-upload (D2-UI) : création + Android uniquement (édition = flow
  // Update D4). Le fichier part APRÈS le submit (presign exige productId).
  const [pendingApk, setPendingApk] = React.useState<PendingApk | null>(null);
  const [apkBusy, setApkBusy] = React.useState(false);
  const apkInputRef = React.useRef<HTMLInputElement | null>(null);
  // Bannière anti-oubli (non bloquante) : publish sans APK sur Android.
  const [nudgeOpen, setNudgeOpen] = React.useState(false);
  const skipNudge = React.useRef(false);
  // Cible de sortie du garde anti-perte : null = back navigateur (go(-2)),
  // string = navigation in-app (lien binaire). Même modale, deux sorties.
  const leaveTarget = React.useRef<string | null>(null);
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
    // Garde active si saisie sale OU analyse/envoi APK en cours (D6) :
    // quitter pendant la chaîne post-submit tuerait l'upload R2.
    // returnValue requis (sans lui Chrome n'affiche aucun prompt).
    if (!dirty && !apkBusy) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const onPopState = () => {
      if (confirmedLeave.current) return;
      // Le back a consommé la factice (URL inchangée) : réarmer + demander.
      window.history.pushState({ submitGuard: true }, "");
      leaveTarget.current = null;
      setLeaveOpen(true);
    };
    window.history.pushState({ submitGuard: true }, "");
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("popstate", onPopState);
    };
  }, [dirty, apkBusy]);
  const confirmLeave = () => {
    confirmedLeave.current = true;
    setLeaveOpen(false);
    const target = leaveTarget.current;
    leaveTarget.current = null;
    if (target) router.push(target);
    else window.history.go(-2);
  };
  // Lien binaire (D6) : form propre → direct ; modifs → même modale.
  const goUpdate = (target: string) => {
    if (dirty) {
      leaveTarget.current = target;
      setLeaveOpen(true);
      return;
    }
    router.push(target);
  };
  // Intention d'envoi. `null` = AUCUN bouton cliqué (touche Entrée) :
  // la soumission implicite du navigateur ne doit jamais enregistrer un
  // brouillon en silence (bug vu en QA : Entrée dans un champ URL
  // → brouillon créé). Le bouton de brouillon pose "draft", celui de
  // publication pose "publish" ; sans intention, on ne fait rien.
  const intentRef = React.useRef<"publish" | "draft" | null>(null);
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const formRef = React.useRef<HTMLFormElement | null>(null);
  const { phase, sending, serverMessage, activeIntent, send } = useSubmitXhr(formRef, {
    // Android seul conditionne (plus isEditing : la chaîne décide via
    // intent publish OU édition — le !isEditing ici effaçait le fichier
    // en rattrapage édition, bug perte APK silencieuse).
    pendingApk: hasAndroid ? pendingApk : null,
  });
  const publish = () => {
    // Anti-oubli : Android sans APK → proposer, jamais bloquer.
    if (!isEditing && hasAndroid && !pendingApk && !skipNudge.current) {
      setNudgeOpen(true);
      return;
    }
    intentRef.current = "publish";
    formRef.current?.requestSubmit();
  };
  // Après chaque tentative, l'intention repart à `null` : sans bouton
  // cliqué, il n'y a pas d'intention (Entrée clavier → rien).
  React.useEffect(() => {
    if (phase.name === "idle") intentRef.current = null;
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
              const intent = intentRef.current;
              if (intent === null) {
                // Entrée clavier dans un champ : aucun bouton cliqué →
                // on n'enregistre rien (un brouillon créé par accident
                // est un Brouillon de plus à nettoyer).
                toast(
                  "info",
                  "Rien n’a été enregistré : utilise « Publier le produit » ou « Enregistrer le brouillon ».",
                );
                return;
              }
              send(intent);
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
            {/* First-upload inline ssi Android SANS track (création ou
                rattrapage en édition) ; avec track → lien Update (verrou). */}
            {hasAndroid && !hasTrack && (
              <>
                <div className="w-full h-px bg-border/40" />
                <SubmitApkSection
                  fileInputRef={apkInputRef}
                  pending={pendingApk}
                  onParsed={setPendingApk}
                  onClear={() => setPendingApk(null)}
                  onBusyChange={setApkBusy}
                  notes={buildNotes}
                  onNotesChange={setBuildNotes}
                />
              </>
            )}
            {isEditing && hasAndroid && hasTrack && editApp && (
              <>
                <div className="w-full h-px bg-border/40" />
                <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/40 bg-muted/20 px-5 py-4">
                  <p className="text-[14px] font-medium text-muted-foreground leading-relaxed">
                    <span className="font-bold text-foreground">Binaire Android : </span>
                    les mises à jour se gèrent sur la page dédiée (versions verrouillées).
                  </p>
                  <button
                    type="button"
                    onClick={() => goUpdate(`/dashboard/products/${editApp.id}/update`)}
                    className="shrink-0 text-[14px] font-bold text-foreground underline decoration-border/60 underline-offset-4 hover:decoration-foreground transition-colors cursor-pointer"
                  >
                    Gérer le binaire →
                  </button>
                </div>
              </>
            )}

            {/* Bottom Actions */}
            <SubmitLinksSummary />
            {serverMessage && (
              <p role="alert" className="text-[14px] font-bold text-red-600 dark:text-red-400">
                {serverMessage}
              </p>
            )}
            <InlineErrorSummary />
            <p className="text-right text-[13px] text-muted-foreground">
              Un brouillon s&apos;enregistre avec le seul nom — les champs marqués « Requis » seront
              exigés au moment de publier.
            </p>
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
                onClick={publish}
              >
                {sending
                  ? "Envoi…"
                  : isEditing
                    ? "Enregistrer les modifications"
                    : "Publier le produit"}
              </ActionButton>
            </div>
          </form>

          {/* Sticky Sidebar (30%) : guidance fiche + bloc binaire partagé */}
          <div className="lg:col-span-4 hidden lg:block">
            {/* UN seul sticky (le wrapper) : deux sticky imbriqués se
                chevauchent au scroll (QA : texte sur texte). */}
            <div className="sticky top-28 flex flex-col gap-12">
              <SubmitGuidanceSidebar sticky={false} support={false} />
              {/* Complément binaire sans chrome (pas de 2e hero/support). */}
              <MakerGuidanceSidebar sticky={false} chrome={false} />
              {/* Aide TOUJOURS en dernier (D6). */}
              <GuidanceSupportCard />
            </div>
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
        onCancel={() => {
          leaveTarget.current = null;
          setLeaveOpen(false);
        }}
      />
      {/* Anti-oubli APK (D2-UI) : chaleureux, non bloquant — rattrapage dashboard. */}
      <ConfirmDialog
        open={nudgeOpen}
        tone="default"
        title="Publier sans APK ?"
        description="Votre fiche part en revue, c'est très bien. Avec l'APK, la communauté peut installer et vérifier votre app — et la fiche gagne le badge. Ajout possible à tout moment depuis le dashboard."
        confirmLabel="Publier quand même"
        cancelLabel="Ajouter l'APK"
        onConfirm={() => {
          skipNudge.current = true;
          setNudgeOpen(false);
          intentRef.current = "publish";
          formRef.current?.requestSubmit();
        }}
        onCancel={() => {
          setNudgeOpen(false);
          apkInputRef.current?.click();
        }}
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
  hasTrack,
}: {
  editId: string | null;
  editApp: DashboardApp | null;
  editMedia?: {
    iconUrl: string | null;
    shots: {
      url: string;
      width: number | null;
      height: number | null;
      orientation: "portrait" | "landscape";
    }[];
  } | null;
  hasTrack?: boolean;
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
      hasTrack={hasTrack}
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
