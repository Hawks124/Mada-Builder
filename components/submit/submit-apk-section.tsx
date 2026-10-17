"use client";

import * as React from "react";

import Link from "next/link";
import {
  ApkParseError,
  blobReader,
  extractApkCerts,
  extractApkManifest,
  type ApkCert,
  type ApkManifest,
} from "@/lib/apk";
import { BuildPlayTable, formatMo } from "@/components/builds/build-play-table";
import { MAX_APK_BYTES } from "@/lib/apk-limits";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Spinner } from "@/components/ui/spinner";
import { CheckCircleIcon, FileArrowUpIcon, TrashIcon } from "@phosphor-icons/react";

/** APK analysé, prêt à partir avec la fiche (envoi chaîné post-submit). */
export type PendingApk = {
  file: File;
  sha256: string;
  manifest: ApkManifest;
  certs: ApkCert[];
};

function hexOf(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Étapes visibles de l'analyse (D6) : le maker voit où ça en est.
 */
export type ApkStage = "lecture" | "manifest" | "signature" | "empreinte";

const STAGES: Array<{ id: ApkStage; label: string }> = [
  { id: "lecture", label: "Lecture du fichier" },
  { id: "manifest", label: "Manifest (package, version, permissions)" },
  { id: "signature", label: "Signature (certificats)" },
  { id: "empreinte", label: "Empreinte SHA-256 locale" },
];

/**
 * Analyse un APK côté client (D2) : manifest + certificats + SHA-256.
 * Erreurs franches en français (jamais de jargon) ; debug refusé comme Play.
 */
async function analyzeApk(file: File, onStage?: (stage: ApkStage) => void): Promise<PendingApk> {
  onStage?.("lecture");
  if (!/\.apk$/i.test(file.name)) {
    throw new Error("Seuls les fichiers .apk sont acceptés.");
  }
  if (file.size > MAX_APK_BYTES) {
    throw new Error("APK trop lourd (300 Mo maximum).");
  }
  // Watchdog permanent (D6) : un parse qui pend (stream exotique) devient
  // une erreur franche au lieu d'un spinner infini.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const watchdog = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new Error(
            "L'analyse dépasse 90 secondes — ce fichier bloque l'analyseur. Réessayez ou signalez-le à la revue.",
          ),
        ),
      90000,
    );
  });
  try {
    return await Promise.race([analyzeApkInner(file, onStage), watchdog]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

async function analyzeApkInner(
  file: File,
  onStage?: (stage: ApkStage) => void,
): Promise<PendingApk> {
  let manifest: ApkManifest;
  onStage?.("manifest");
  try {
    manifest = await extractApkManifest(file);
  } catch (e) {
    throw new Error(
      e instanceof ApkParseError
        ? e.message
        : "Manifest illisible — réessayez avec un autre fichier.",
    );
  }
  let certs: ApkCert[];
  onStage?.("signature");
  try {
    certs = await extractApkCerts(blobReader(file));
  } catch (e) {
    throw new Error(
      e instanceof ApkParseError
        ? e.message
        : "Signature illisible — réessayez avec un autre fichier.",
    );
  }
  if (certs.some((c) => c.debug) || manifest.debuggable) {
    throw new Error("APK de debug refusé — envoyez une build release, comme sur Play.");
  }
  onStage?.("empreinte");
  const sha256 = hexOf(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()));
  return { file, sha256, manifest, certs };
}

/**
 * Bloc first-upload (D2-UI) : visible si Android est coché (création).
 * Facultatif, jamais bloquant (skip → bannière anti-oubli au publish, rattrapage
 * dashboard). L'envoi R2 + record partent APRÈS le submit (le presign exige le
 * productId).
 */
export function SubmitApkSection({
  fileInputRef,
  pending,
  onParsed,
  onClear,
  onBusyChange,
  actionsLocked,
}: {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  pending: PendingApk | null;
  onParsed: (p: PendingApk) => void;
  onClear: () => void;
  /** Remonte l'état occupé (analyse) pour la garde anti-perte du parent. */
  onBusyChange?: (busy: boolean) => void;
  /** Envoi en cours côté parent : Retirer verrouillé (le File part en PUT). */
  actionsLocked?: boolean;
}) {
  const [parsing, setParsing] = React.useState(false);
  const [stage, setStage] = React.useState<ApkStage | null>(null);
  const [dragActive, setDragActive] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [oversize, setOversize] = React.useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = React.useState(false);
  const runId = React.useRef(0);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    const id = ++runId.current;
    // Contrôle de taille avant l'analyse : celle-ci lit tout le fichier, on ne
    // fait pas faire 300 Mo de lecture au navigateur pour rien.
    if (file.size > MAX_APK_BYTES) {
      onClear();
      setError(null);
      setOversize(`Ce fichier fait ${formatMo(file.size)}. La limite est de 300 Mo.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setOversize(null);
    setParsing(true);
    setStage(null);
    onBusyChange?.(true);
    setError(null);
    try {
      const parsed = await analyzeApk(file, (s) => {
        if (runId.current === id) setStage(s);
      });
      if (runId.current === id) onParsed(parsed);
    } catch (e) {
      if (runId.current === id) {
        onClear();
        setError(e instanceof Error ? e.message : "Analyse impossible — réessayez.");
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    } finally {
      if (runId.current === id) {
        setParsing(false);
        setStage(null);
        onBusyChange?.(false);
      }
    }
  };

  const stageIndex = stage === null ? -1 : STAGES.findIndex((s) => s.id === stage);

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground/60">
          Facultatif
        </p>
        <h2 className="text-2xl font-black tracking-tight">Binaire Android (APK)</h2>
        <p className="text-[14px] font-medium leading-relaxed text-muted-foreground">
          C&apos;est la seule preuve automatique qu&apos;une fiche n&apos;est pas vide, et vos
          visiteurs pourront installer le binaire depuis la page. L&apos;analyse se fait dans votre
          navigateur : nous lisons le package, la version, les permissions et la signature, et nous
          refusons les builds de debug, comme sur le Play Store. Rien n&apos;est envoyé pour être
          analysé.
        </p>
        <p className="text-[14px] font-medium leading-relaxed text-muted-foreground">
          Une fois la fiche approuvée par un humain, le binaire devient téléchargeable depuis la
          page — sur un bucket privé, derrière un lien valable 5 minutes, jamais une URL directe. Le
          téléphone vérifie l&apos;empreinte SHA-256 après le téléchargement.
        </p>
        <p className="text-[14px] font-medium leading-relaxed text-muted-foreground">
          <strong className="font-black text-foreground">APK de debug&nbsp;: refusés.</strong> Les
          signatures v1+v2+v3 sont recommandées, quel que soit votre outil de build. Les APK signés
          uniquement en v2/v3 sont acceptés si leurs certificats sont lisibles. Les téléphones sous
          Android&nbsp;6 et moins (API &lt; 24) ne savent vérifier que la v1. Avec Gradle,
          configurez les trois schémas dans{" "}
          <code className="font-mono text-[12px]">app/build.gradle</code> (Groovy) ou{" "}
          <code className="font-mono text-[12px]">app/build.gradle.kts</code> (Kotlin DSL), sous{" "}
          <code className="font-mono text-[12px]">android/app/</code> pour Flutter, React Native et
          Capacitor. Exemple Kotlin DSL :
        </p>
        <pre className="overflow-x-auto rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-[12px] font-mono leading-relaxed text-foreground">
          {`signingConfigs {
    create("release") {
        // … vos keyAlias / storeFile existants …
        enableV1Signing = true
        enableV2Signing = true
        enableV3Signing = true
    }
}`}
        </pre>
        <p className="text-[13px] font-medium text-muted-foreground">
          Pas-à-pas complet (keystore inclus, tous frameworks) :{" "}
          <Link
            href="/guides/signature-apk"
            className="font-bold text-foreground underline underline-offset-2"
          >
            Signer son APK release
          </Link>
          .
        </p>
      </div>

      {!pending && !parsing && (
        <div className="flex flex-col gap-4">
          {(error || oversize) && (
            <div role="alert" className="flex flex-col gap-3">
              <p className="text-[14px] font-bold text-red-600 dark:text-red-400">
                {error ?? oversize}
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex h-10 w-fit items-center rounded-full bg-foreground px-5 text-[13px] font-bold text-background transition-opacity hover:opacity-90"
              >
                Choisir un autre fichier
              </button>
            </div>
          )}

          {!error && !oversize && (
            <>
              <label
                onDragEnter={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  void pick(e.dataTransfer.files?.[0]);
                }}
                className={`flex min-h-[15rem] cursor-pointer flex-col items-center justify-center gap-3 rounded-4xl border-2 border-dashed px-6 text-center transition-colors ${
                  dragActive
                    ? "border-foreground bg-muted/60"
                    : "border-border/60 bg-transparent hover:bg-muted/5"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".apk,application/vnd.android.package-archive"
                  className="sr-only"
                  onChange={(e) => {
                    void pick(e.target.files?.[0]);
                  }}
                />
                <FileArrowUpIcon
                  weight={dragActive ? "fill" : "regular"}
                  className="w-10 h-10 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="text-[15px] font-bold text-foreground">
                  {dragActive
                    ? "Déposez le fichier ici"
                    : "Glissez-déposez votre .apk ici, ou cliquez pour parcourir"}
                </span>
              </label>

              <p className="text-[13px] font-medium leading-relaxed text-muted-foreground">
                <strong className="font-black text-foreground">Avant de déposer :</strong> un APK
                universel, pas de fichier par ABI — si votre build Gradle produit des splits, prenez
                le fichier <code className="font-mono text-[12px]">universalApk</code>. Release
                uniquement, 300 Mo maximum.
              </p>

              <p className="text-[13px] font-medium text-muted-foreground/70">
                Sans APK, la fiche reste publiable — ajout possible depuis le dashboard.
              </p>
            </>
          )}
        </div>
      )}

      {parsing && (
        <div className="flex min-h-[15rem] flex-col items-center justify-center gap-4 rounded-4xl border border-border/60 bg-muted/20 px-6 py-10 text-center">
          <FileArrowUpIcon className="w-10 h-10 text-muted-foreground" aria-hidden="true" />
          <p className="text-[15px] font-bold text-foreground">Analyse de votre fichier…</p>
          {/* Une seule zone live : annoncer les quatre lignes à chaque étape
              ferait relire toute la liste par le lecteur d'écran. */}
          <p className="sr-only" aria-live="polite">
            {stageIndex >= 0 ? STAGES[stageIndex]?.label : "Préparation"}
          </p>
          <ol className="flex flex-col items-start gap-2 text-left">
            {STAGES.map((s, i) => (
              <li
                key={s.id}
                aria-current={i === stageIndex ? "step" : undefined}
                className="flex items-center gap-2 text-[13px] font-medium"
              >
                {i < stageIndex ? (
                  <CheckCircleIcon weight="fill" className="w-4 h-4 text-emerald-500" />
                ) : i === stageIndex ? (
                  <Spinner size="xs" label="" />
                ) : (
                  <span className="w-4 h-4 rounded-full border border-border/60" />
                )}
                <span className={i <= stageIndex ? "text-foreground" : "text-muted-foreground"}>
                  {s.label}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {pending && (
        <div className="flex flex-col gap-5 rounded-[5px] border border-border/60 bg-muted/20 p-6 shadow-sm shadow-border/50">
          <div className="flex items-center gap-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15"
              aria-hidden="true"
            >
              <CheckCircleIcon weight="fill" className="h-5 w-5 text-emerald-500" />
            </span>
            <div className="flex flex-col gap-0.5">
              <p className="text-[15px] font-black text-foreground">
                Analyse terminée, votre fichier est prêt
              </p>
              <p className="text-[13px] font-medium text-muted-foreground">
                Envoyé avec la fiche, et revu avec elle avant publication.
              </p>
            </div>
          </div>

          <BuildPlayTable
            manifest={pending.manifest}
            certs={pending.certs}
            fileName={pending.file.name}
            sizeBytes={pending.file.size}
          />

          <div className="flex items-center justify-between gap-4">
            <p className="text-[13px] font-medium text-muted-foreground">
              Il remplacera le précédent si vous en déposez un nouveau.
            </p>
            <button
              type="button"
              onClick={() => setConfirmRemove(true)}
              disabled={actionsLocked}
              aria-label="Retirer ce fichier APK"
              title={actionsLocked ? "Envoi en cours — retrait verrouillé" : undefined}
              className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-full border border-border/60 px-5 text-[13px] font-bold text-muted-foreground transition-colors hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border/60 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
            >
              <TrashIcon weight="bold" className="h-3.5 w-3.5" />
              Retirer
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmRemove}
        tone="danger"
        title="Retirer ce fichier APK ?"
        description="Le fichier sera effacé. Si la fiche est déjà publiée, elle ne le sera plus."
        confirmLabel="Retirer"
        onConfirm={() => {
          onClear();
          setError(null);
          setOversize(null);
          setConfirmRemove(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
        }}
        onCancel={() => setConfirmRemove(false)}
      />
    </section>
  );
}
