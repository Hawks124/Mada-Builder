"use client";

import QRCode from "react-qr-code";
import { DownloadSimpleIcon, SealCheckIcon } from "@phosphor-icons/react";

export type PublicBuildItem = {
  versionCode: number | null;
  versionName: string | null;
  createdAt: string;
  sizeBytes: number;
  whatsnew: string | null;
};

function formatMo(bytes: number): string {
  return `${(bytes / 1048576).toFixed(1)} Mo`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { dateStyle: "medium" });
}

function versionLabel(b: PublicBuildItem): string {
  if (b.versionCode === null && !b.versionName) return "Version initiale";
  return `v${b.versionName ?? "?"} (${b.versionCode ?? "?"})`;
}

/**
 * Section Télécharger (D5, fiche publique) : dernier build approuvé +
 * QR PC→téléphone (URL stable, jamais signée) + historique des versions
 * approuvées avec leurs notes. Rendue uniquement s'il y a ≥1 build
 * approuvé (pending/rejected invisibles au public).
 */
export function ProductBuilds({
  builds,
  downloadPath,
  downloadUrl,
}: {
  builds: PublicBuildItem[];
  /** Chemin relatif stable (bouton Installer). */
  downloadPath: string;
  /** URL absolue stable (QR téléphone). */
  downloadUrl: string;
}) {
  if (builds.length === 0) return null;
  const [latest, ...older] = builds as [PublicBuildItem, ...PublicBuildItem[]];
  return (
    <section className="flex flex-col gap-4" aria-label="Télécharger">
      <h2 className="text-2xl font-extrabold tracking-tight text-foreground">Télécharger</h2>
      <div className="flex flex-col gap-4 rounded-2xl border border-border/40 bg-muted/20 p-5">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[16px] font-bold text-foreground">{versionLabel(latest)}</p>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
              <SealCheckIcon weight="fill" className="w-3 h-3" />
              Vérifié par la revue
            </span>
          </div>
          <p className="text-[13px] font-medium text-muted-foreground">
            {formatMo(latest.sizeBytes)} · publié le {formatDate(latest.createdAt)}
          </p>
          {latest.whatsnew && (
            <p className="text-[14px] font-medium text-foreground/90 leading-relaxed whitespace-pre-line">
              {latest.whatsnew}
            </p>
          )}
        </div>
        <div className="flex items-center gap-4">
          <a
            href={downloadPath}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-foreground h-12 text-[15px] font-bold text-background hover:opacity-85 transition-opacity"
          >
            <DownloadSimpleIcon weight="bold" className="w-4 h-4" />
            Télécharger l&apos;APK
          </a>
          <div
            suppressHydrationWarning
            className="hidden sm:flex items-center justify-center rounded-xl bg-white p-2 shrink-0"
            title="Scanner pour télécharger sur mobile"
          >
            <QRCode value={downloadUrl} size={72} bgColor="#ffffff" fgColor="#09090b" />
          </div>
        </div>
      </div>

      {older.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-[15px] font-bold text-foreground">Versions précédentes</h3>
          <ul className="flex flex-col gap-2">
            {older.map((b, i) => (
              <li
                key={`${b.versionCode ?? "x"}-${i}`}
                className="flex flex-col gap-1 rounded-xl border border-border/40 px-4 py-3"
              >
                <p className="text-[14px] font-bold text-foreground">
                  {versionLabel(b)}{" "}
                  <span className="font-medium text-muted-foreground">
                    · {formatMo(b.sizeBytes)} · {formatDate(b.createdAt)}
                  </span>
                </p>
                {b.whatsnew && (
                  <p className="text-[13px] font-medium text-muted-foreground leading-relaxed whitespace-pre-line">
                    {b.whatsnew}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
