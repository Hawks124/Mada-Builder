"use client";

import * as React from "react";
import { CheckIcon, CopyIcon } from "@phosphor-icons/react";
import type { ApkCert, ApkManifest } from "@/lib/apk";

function formatMo(bytes: number): string {
  return `${(bytes / 1048576).toFixed(1)} Mo`;
}

export { formatMo };

/**
 * Icône APK validée (D6) : data-URL dont les magic bytes prouvent un
 * format affichable (PNG/JPEG/WebP). La lib déclare toujours
 * `image/png` même pour du WebP — on ne croit que les octets.
 * Adaptive-XML ou absent → null (tuile initiales, jamais d'image cassée).
 */
function validIconSrc(src: string | null): string | null {
  if (!src) return null;
  const comma = src.indexOf(",");
  const b64 = comma >= 0 ? src.slice(comma + 1) : src;
  try {
    const bin = atob(b64.slice(0, 24));
    const bytes = Array.from(bin.slice(0, 12), (c) => c.charCodeAt(0));
    const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const webp =
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50;
    return png || jpeg || webp ? src : null;
  } catch {
    return null;
  }
}

function initialsOf(fileName: string): string {
  const base = fileName.replace(/\.apk$/i, "").trim();
  return (base[0] ?? "A").toUpperCase();
}

function CopySha({ sha }: { sha: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard
          ?.writeText(sha)
          .then(() => setCopied(true))
          .catch(() => setCopied(false));
        setTimeout(() => setCopied(false), 2000);
      }}
      aria-label={copied ? "Empreinte copiée" : "Copier l'empreinte complète"}
      title={copied ? "Copié" : "Copier l'empreinte complète"}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-full border transition-all duration-200 cursor-pointer ${
        copied
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "border-border/60 text-muted-foreground hover:border-border hover:bg-muted/50 hover:text-foreground"
      }`}
    >
      {copied ? (
        <CheckIcon weight="bold" className="h-3.5 w-3.5" />
      ) : (
        <CopyIcon className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

/**
 * Tableau façon store (D6) : icône + version + développeur d'abord
 * (l'info de confiance, comme Play), technique replié. Toutes les
 * données restent disponibles (la revue en a besoin), l'ordre change.
 * Présentationnel pur — submit, revue admin, update.
 */
export function BuildPlayTable({
  manifest,
  certs,
  fileName,
  sizeBytes,
  reviewed = false,
  iconUrl,
}: {
  manifest: ApkManifest;
  certs: ApkCert[];
  fileName: string;
  sizeBytes: number;
  /**
   * Le build a été **approuvé par un humain**. Défaut `false` : au dépôt de la
   * fiche le certificat a seulement été lu côté navigateur, rien n'a encore été
   * confronté à quoi que ce soit — annoncer « vérifiée » serait faux.
   */
  reviewed?: boolean;
  /**
   * Logo fiche en repli (D6) : l'icône extraite de l'APK n'est pas stockée
   * en base (anti-bloat) — le logo fiche est le même visuel en pratique.
   */
  iconUrl?: string | null;
}) {
  const main = certs[0]!;
  const icon = validIconSrc(manifest.iconBase64);
  const developer =
    [main.subjectCn, main.subjectO].filter(Boolean).join(" · ") || "Émetteur inconnu";
  return (
    <div className="flex flex-col gap-5">
      {/* Header store : icône + identité + confiance */}
      <div className="flex items-center gap-4">
        {icon || iconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={icon ?? iconUrl ?? ""} alt="" className="w-16 h-16 " />
        ) : (
          <div
            aria-hidden="true"
            className="w-16 h-16 rounded-2xl shrink-0 flex items-center justify-center bg-muted text-foreground font-extrabold text-2xl"
          >
            {initialsOf(fileName)}
          </div>
        )}
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <p className="text-[16px] font-extrabold tracking-tight text-foreground break-all leading-tight">
            {fileName}
          </p>
          <p className="text-[13px] font-medium text-muted-foreground">
            v{manifest.versionName} ({manifest.versionCode}) · {formatMo(sizeBytes)}
          </p>
          <p className="text-[14px] font-bold text-foreground truncate">{developer}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span
          title={
            reviewed
              ? "Signature et contenu contrôlés par un humain avant publication"
              : "Signature lue dans le fichier. Elle sera contrôlée par un humain avant publication."
          }
          className={
            reviewed
              ? "inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[12px] font-bold text-emerald-600 dark:text-emerald-400"
              : "inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/60 px-3 py-1 text-[12px] font-bold text-muted-foreground"
          }
        >
          {reviewed ? <CheckIcon weight="bold" className="w-3.5 h-3.5" /> : null}
          {reviewed ? "Signature vérifiée" : "Signature lue"}
        </span>
        <span className="inline-flex items-center rounded-full bg-muted/60 px-3 py-1 text-[12px] font-bold text-foreground">
          Schéma {main.scheme}
        </span>
        <span className="inline-flex items-center rounded-full bg-muted/60 px-3 py-1 text-[12px] font-bold text-foreground">
          {main.keyAlg}
          {main.keyBits ? ` ${main.keyBits}` : ""}
        </span>
        {main.debug && (
          <span className="inline-flex items-center rounded-full bg-red-500/15 px-3 py-1 text-[12px] font-bold text-red-600 dark:text-red-400">
            Debug — refusé
          </span>
        )}
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[14px]">
        <dt className="font-medium text-muted-foreground">Android min.</dt>
        <dd className="font-bold text-foreground">
          {manifest.minSdk === null ? "—" : `API ${manifest.minSdk}+`}
        </dd>
        <dt className="font-medium text-muted-foreground">Permissions</dt>
        <dd className="font-bold text-foreground">{manifest.permissions.length}</dd>
      </dl>

      {manifest.permissions.length > 0 && (
        <details className="text-[13px]">
          <summary className="cursor-pointer font-bold text-foreground hover:underline underline-offset-4">
            Voir les permissions
          </summary>
          <ul className="mt-2 flex flex-col gap-1 font-mono text-muted-foreground break-all">
            {manifest.permissions.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </details>
      )}

      <details className="text-[13px] border-t border-border/40 pt-4">
        <summary className="cursor-pointer font-bold text-foreground hover:underline underline-offset-4">
          Détails techniques
        </summary>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[14px]">
          <dt className="font-medium text-muted-foreground">Package</dt>
          <dd className="font-mono font-bold text-foreground break-all">{manifest.package}</dd>
          <dt className="font-medium text-muted-foreground">SHA-256</dt>
          <dd className="flex flex-col gap-2">
            <span className="font-mono text-[12px] text-muted-foreground break-all">
              {main.sha256}
            </span>
            <span>
              <CopySha sha={main.sha256} />
            </span>
          </dd>
          <dt className="font-medium text-muted-foreground">Signature</dt>
          <dd className="font-bold text-foreground">
            {main.sigAlg}
            {main.serial && main.serial !== "—" ? ` · série ${main.serial.slice(0, 20)}…` : ""}
          </dd>
        </dl>
      </details>
    </div>
  );
}
