"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SubmitApkSection, type PendingApk } from "@/components/submit/submit-apk-section";
import { uploadApkBuild, APK_UPLOAD_STEP_LABEL } from "@/components/submit/apk-upload";
import { ActionButton } from "@/components/ui/action-button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Spinner } from "@/components/ui/spinner";
import { MakerGuidanceSidebar } from "@/components/guidance/maker-guidance-sidebar";
import { BuildPlayTable } from "@/components/builds/build-play-table";
import { toTableInput } from "@/components/builds/build-table-adapter";

export type UpdateHistoryItem = {
  id: string;
  versionCode: number | null;
  versionName: string | null;
  status: string;
  sizeBytes: number;
  createdAt: string;
  whatsnew: string | null;
  rejectionReason: string | null;
  downloadUrl: string | null;
  package: string | null;
  minSdk: number | null;
  targetSdk: number | null;
  permissions: string[];
  certSha256: string | null;
  certSha1: string | null;
  sigScheme: string | null;
  certSubjectCn: string | null;
  certSubjectO: string | null;
  certKeyAlg: string | null;
  certKeyBits: number | null;
  certSigAlg: string | null;
};

function historyVersionLabel(b: UpdateHistoryItem): string {
  if (b.versionCode === null && !b.versionName) return "Build sans version";
  return `v${b.versionName ?? "?"} (${b.versionCode ?? "?"})`;
}

const STATUS_STYLE: Record<string, string> = {
  pending: "border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  approved: "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  rejected: "border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-400",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "En revue",
  approved: "En ligne",
  rejected: "Rejeté",
};

/**
 * Formulaire Update binaire (D4) : APK analysé localement + notes de
 * version (requises si track, ≤1000 signes) + envoi R2/record. Échec =
 * on reste (fichier conservé, réessai) — jamais de fiche touchée.
 */
export function UpdateClient({
  productId,
  productName,
  productIconUrl,
  hasTrack,
  latestVersionCode,
  latestVersionName,
  history,
}: {
  productId: string;
  productName: string;
  productIconUrl: string | null;
  hasTrack: boolean;
  latestVersionCode: number | null;
  latestVersionName: string | null;
  history: UpdateHistoryItem[];
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState<PendingApk | null>(null);
  const [notes, setNotes] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [apkBusy, setApkBusy] = React.useState(false);
  const [progress, setProgress] = React.useState<string | null>(null);
  const [progressPct, setProgressPct] = React.useState<number | null>(null);
  type UploadPhase = "idle" | "sending" | "retrying" | "offline" | "done";
  const [phase, setPhase] = React.useState<UploadPhase>("idle");
  const [retryLabel, setRetryLabel] = React.useState<string | null>(null);
  const [serverMessage, setServerMessage] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Garde anti-perte (D6) : analyse ou envoi en cours → on ne quitte pas
  // sans prévenir (refresh/fermeture ; la nav in-app n'est pas
  // interceptable en App Router — même limite que le submit).
  const busy = apkBusy || sending;
  React.useEffect(() => {
    if (!busy) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      // Sans returnValue, Chrome n'affiche aucun prompt.
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [busy]);

  // Garde back navigateur (D6) : travail à perdre (APK analysé ou notes)
  // → modale, jamais de back silencieux. Même pattern que le submit.
  const hasWork = pending !== null || notes.trim() !== "" || sending;
  const [leaveOpen, setLeaveOpen] = React.useState(false);
  const confirmedLeave = React.useRef(false);
  React.useEffect(() => {
    if (!hasWork) return;
    const onPopState = () => {
      if (confirmedLeave.current) return;
      window.history.pushState({ updateGuard: true }, "");
      setLeaveOpen(true);
    };
    window.history.pushState({ updateGuard: true }, "");
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [hasWork]);
  const confirmLeave = () => {
    confirmedLeave.current = true;
    setLeaveOpen(false);
    window.history.go(-2);
  };

  // Garde version cliente (le serveur re-tranche) : strictement supérieur.
  const versionBlocked =
    pending !== null &&
    hasTrack &&
    latestVersionCode !== null &&
    pending.manifest.versionCode <= latestVersionCode;
  const notesRequired = hasTrack;
  const notesEmpty = notes.trim() === "";
  // Un seul pending à la fois (garde serveur miroir) : tant qu'une
  // version est en revue, pas de nouvel envoi (le serveur refuse aussi).
  const hasPendingBuild = history.some((b) => b.status === "pending");
  const pendingVersion = history.find((b) => b.status === "pending");
  const canSend =
    !sending &&
    pending !== null &&
    !versionBlocked &&
    !hasPendingBuild &&
    (!notesRequired || !notesEmpty);

  const send = async () => {
    if (!canSend || !pending) return;
    setSending(true);
    setServerMessage(null);
    setPhase("sending");
    setRetryLabel(null);
    setProgress("Envoi…");
    setProgressPct(0);
    try {
      await uploadApkBuild({
        productId,
        pending,
        whatsnew: notes.trim() === "" ? null : notes.trim(),
        onProgress: (loaded, total) => {
          const pct = Math.round((loaded / Math.max(1, total)) * 100);
          setPhase("sending");
          setProgressPct(pct);
          setProgress(`Envoi… ${pct} %`);
        },
        onStep: (step) => {
          setProgress(APK_UPLOAD_STEP_LABEL[step]);
          if (step !== "transfert") setProgressPct(null);
        },
        onRetry: (info) => {
          if (info.waitingForNetwork) {
            setPhase("offline");
            const resumed =
              info.totalBytes > 0
                ? ` (repris à ${Math.round((info.sentBytes / Math.max(1, info.totalBytes)) * 100)} %)`
                : "";
            setRetryLabel(`Connexion perdue — en pause${resumed}. Reprise automatique…`);
            setProgress("En pause — attente du réseau…");
          } else {
            setPhase("retrying");
            setRetryLabel(`Connexion instable — tentative ${info.attempt}/${info.max}…`);
            setProgress(`Nouvelle tentative ${info.attempt}/${info.max}…`);
          }
        },
      });
      // Succès visible avant redirect (D6) : jamais de bascule brutale.
      setPhase("done");
      setRetryLabel(null);
      setProgress("APK envoyé — redirection…");
      setProgressPct(100);
      await new Promise((r) => setTimeout(r, 900));
      router.push(
        `/dashboard?toast=ok:${encodeURIComponent("Mise à jour envoyée — binaire en revue.")}`,
      );
    } catch (e) {
      setServerMessage(e instanceof Error ? e.message : "Envoi impossible pour le moment.");
      setSending(false);
      setPhase("idle");
      setRetryLabel(null);
      setProgress(null);
      setProgressPct(null);
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="w-full px-6 lg:px-12 pt-10 lg:pt-14 pb-24 flex flex-col gap-10">
        <div className="flex flex-col gap-3 max-w-3xl">
          <Link
            href="/dashboard/products"
            className="text-[14px] font-bold text-muted-foreground hover:text-foreground transition-colors w-fit"
          >
            ← Mes produits
          </Link>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-foreground">
            {hasTrack ? "Mettre à jour" : "Ajouter le binaire"}
          </h1>
          <p className="text-lg md:text-xl font-medium text-muted-foreground max-w-2xl">
            {hasTrack
              ? `Nouvelle version de ${productName}${
                  latestVersionCode !== null
                    ? ` (actuelle : v${latestVersionName ?? "?"} — code ${latestVersionCode})`
                    : ""
                }. Le code de version doit être strictement supérieur.`
              : `Premier binaire de ${productName} : APK universel release, analysé puis revu avec la fiche.`}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 items-start">
          <div className="lg:col-span-8 flex flex-col gap-10 max-w-3xl">
            <SubmitApkSection
              fileInputRef={fileInputRef}
              pending={pending}
              onParsed={setPending}
              onClear={() => setPending(null)}
              onBusyChange={setApkBusy}
              actionsLocked={sending}
              notes={notes}
              onNotesChange={setNotes}
              notesRequired={notesRequired}
            />

            {versionBlocked && (
              <p role="alert" className="text-[14px] font-bold text-red-600 dark:text-red-400">
                Code de version {pending.manifest.versionCode} refusé — il doit être supérieur à{" "}
                {latestVersionCode} (le code du build en ligne).
              </p>
            )}

            {hasPendingBuild && (
              <div
                role="status"
                className="flex flex-col gap-1 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-5 py-4"
              >
                <p className="text-[14px] font-bold text-amber-600 dark:text-amber-400">
                  {pendingVersion
                    ? `Version ${pendingVersion.versionName ?? "?"} (code ${pendingVersion.versionCode ?? "?"}) en revue —`
                    : "Une version est en revue —"}{" "}
                  attendez le verdict avant d&apos;envoyer la suivante.
                </p>
                <p className="text-[13px] font-medium text-muted-foreground">
                  L&apos;envoi est verrouillé tant que la revue n&apos;a pas tranché (voir
                  l&apos;historique ci-dessous).
                </p>
              </div>
            )}

            {serverMessage && (
              <p role="alert" className="text-[14px] font-bold text-red-600 dark:text-red-400">
                {serverMessage}
              </p>
            )}

            <div className="flex flex-col gap-3">
              {(sending || phase === "done") && (
                <div className="flex flex-col gap-2" role="status" aria-live="polite">
                  <div className="flex items-center justify-between gap-4">
                    <p
                      className={
                        phase === "done"
                          ? "text-[14px] font-bold text-emerald-600 dark:text-emerald-400"
                          : "text-[14px] font-bold text-muted-foreground tabular-nums"
                      }
                    >
                      {progress}
                    </p>
                    {progressPct !== null && phase !== "done" && (
                      <span className="text-[14px] font-bold text-muted-foreground tabular-nums">
                        {progressPct} %
                      </span>
                    )}
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    {progressPct === null ? (
                      <div className="h-full w-full bg-foreground/40 animate-pulse" />
                    ) : (
                      <div
                        className="h-full rounded-full bg-foreground transition-[width] duration-300"
                        style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
                      />
                    )}
                  </div>
                  {(phase === "retrying" || phase === "offline") && retryLabel && (
                    <p
                      role="alert"
                      className="flex items-center gap-2 text-[13px] font-bold text-amber-600 dark:text-amber-400"
                    >
                      <Spinner size="xs" />
                      {retryLabel}
                    </p>
                  )}
                </div>
              )}
              <div className="flex items-center justify-end gap-4">
                <ActionButton actionType="button" disabled={!canSend} onClick={() => void send()}>
                  {sending && <Spinner size="xs" />}
                  {sending
                    ? phase === "offline"
                      ? "En pause…"
                      : "Envoi…"
                    : serverMessage
                      ? "Réessayer l'envoi"
                      : hasTrack
                        ? "Envoyer la mise à jour"
                        : "Envoyer le binaire"}
                </ActionButton>
              </div>
            </div>

            {history.length > 0 &&
              (() => {
                // Dernier build en tableau complet (référence pour préparer
                // l'update), anciens en compact. Tri date décroissante.
                const sorted = [...history].sort(
                  (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
                );
                const [latest, ...older] = sorted as [UpdateHistoryItem, ...UpdateHistoryItem[]];
                const latestTable = toTableInput(latest);
                return (
                  <div className="flex flex-col gap-4">
                    <h2 className="text-2xl font-black tracking-tight text-foreground">
                      Historique des builds
                    </h2>
                    {latestTable && (
                      <div className="flex flex-col gap-3 rounded-2xl border border-border/40 bg-muted/20 p-5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">
                            Dernier build — {historyVersionLabel(latest)}
                          </p>
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${STATUS_STYLE[latest.status] ?? STATUS_STYLE.pending}`}
                          >
                            {STATUS_LABEL[latest.status] ?? latest.status}
                          </span>
                        </div>
                        <BuildPlayTable
                          manifest={latestTable.manifest}
                          certs={[latestTable.cert]}
                          fileName={`${productName} ${historyVersionLabel(latest)}`}
                          sizeBytes={latest.sizeBytes}
                          iconUrl={productIconUrl}
                        />
                      </div>
                    )}
                    {older.length > 0 && (
                      <ul className="flex flex-col gap-3">
                        {older.map((b) => (
                          <li
                            key={b.id}
                            className="flex flex-col gap-2 rounded-2xl border border-border/40 bg-muted/20 p-4"
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`inline-flex items-center rounded-full border px-3 py-1 text-[12px] font-bold ${STATUS_STYLE[b.status] ?? STATUS_STYLE.pending}`}
                              >
                                {STATUS_LABEL[b.status] ?? b.status}
                              </span>
                              <span className="text-[14px] font-bold text-foreground">
                                {historyVersionLabel(b)}
                              </span>
                              <span className="text-[12px] font-medium text-muted-foreground tabular-nums">
                                {(b.sizeBytes / 1048576).toFixed(1)} Mo ·{" "}
                                {new Date(b.createdAt).toLocaleDateString("fr-FR", {
                                  dateStyle: "medium",
                                })}
                              </span>
                            </div>
                            {b.whatsnew && (
                              <p className="text-[13px] font-medium text-foreground/90 leading-relaxed whitespace-pre-line">
                                {b.whatsnew}
                              </p>
                            )}
                            {b.status === "rejected" && b.rejectionReason && (
                              <p className="text-[13px] font-medium text-red-600 dark:text-red-400">
                                Motif : {b.rejectionReason}
                              </p>
                            )}
                            {b.downloadUrl && (
                              <a
                                href={b.downloadUrl}
                                download
                                className="text-[13px] font-bold text-foreground underline decoration-border/60 underline-offset-4 hover:decoration-foreground transition-colors w-fit"
                              >
                                Télécharger pour tester
                              </a>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })()}
          </div>

          {/* Guidance partagée (D6) : même pattern que le submit. */}
          <aside className="lg:col-span-4 hidden lg:block">
            <div className="sticky top-28">
              <MakerGuidanceSidebar sticky={false} />
            </div>
          </aside>
        </div>
      </div>
      {/* Garde back navigateur : quitter avec un APK analysé ou des notes = perdre le travail. */}
      <ConfirmDialog
        open={leaveOpen}
        tone="default"
        title="Quitter sans envoyer ?"
        description="Votre APK analysé et vos notes seront perdus. L'envoi prend quelques secondes une fois le fichier choisi."
        confirmLabel="Quitter sans envoyer"
        cancelLabel="Rester"
        onConfirm={confirmLeave}
        onCancel={() => setLeaveOpen(false)}
      />
    </main>
  );
}
