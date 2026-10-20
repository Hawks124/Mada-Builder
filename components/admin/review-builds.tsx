"use client";

import * as React from "react";
import { startTransition } from "react";
import {
  ArrowSquareOutIcon,
  CaretRightIcon,
  CheckIcon,
  XIcon,
  HourglassIcon,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { ProductAvatar } from "@/components/ui/product-avatar";
import { waitingFr } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import { BuildPlayTable, formatMo } from "@/components/builds/build-play-table";
import { toTableInput } from "@/components/builds/build-table-adapter";
import { approveBuildAction, rejectBuildAction, type BuildListItem } from "@/app/actions/builds";

export type ReviewBuildItem = BuildListItem & {
  downloadUrl: string | null;
  /** Heures d'attente (SLA 24 h) — calculé serveur, jamais au rendu. */
  waitingHours: number;
};

function versionLabel(b: ReviewBuildItem): string {
  if (b.versionCode === null && !b.versionName) return "Build sans version";
  return `v${b.versionName ?? "?"} (${b.versionCode ?? "?"})`;
}

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
}

const PILL: Record<string, string> = {
  pending: "border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  approved: "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  rejected: "border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-400",
};

const PILL_LABEL: Record<string, string> = {
  pending: "En revue",
  approved: "Approuvé",
  rejected: "Rejeté",
};

function BuildVerdictButtons({ buildId, version }: { buildId: string; version: string }) {
  const [done, setDone] = React.useState<"approved" | "rejected" | null>(null);
  const [rejecting, setRejecting] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const doApprove = () => {
    if (pending) return;
    setPending(true);
    setError(null);
    startTransition(async () => {
      const res = await approveBuildAction({ buildId });
      if (res.ok) {
        setDone("approved");
        toast("ok", `Build ${version} approuvé — téléchargeable.`);
      } else {
        setError(res.message ?? "Approbation impossible pour le moment.");
      }
      setPending(false);
    });
  };

  const confirmReject = () => {
    if (reason.trim() === "" || pending) return;
    setPending(true);
    setError(null);
    startTransition(async () => {
      const res = await rejectBuildAction({ buildId, reason: reason.trim() });
      if (res.ok) {
        setDone("rejected");
        setRejecting(false);
        toast("ok", `Build ${version} rejeté — motif envoyé.`);
      } else {
        setError(res.message ?? "Rejet impossible pour le moment.");
      }
      setPending(false);
    });
  };

  // Pas de redirect ici (contraire fiche) : la revue fiche continue.
  if (done) {
    return (
      <p
        className={cn(
          "rounded-xl border px-4 py-2.5 text-[13px] font-bold",
          done === "approved"
            ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            : "border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-400",
        )}
      >
        {done === "approved" ? `Build ${version} approuvé.` : `Build ${version} rejeté.`}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={doApprove}
          disabled={pending}
          className="flex-1 flex items-center justify-center gap-2 rounded-full bg-emerald-600 h-10 text-[14px] font-bold text-white hover:bg-emerald-500 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait"
        >
          <CheckIcon weight="bold" className="w-4 h-4" />
          {pending ? "…" : "Approuver"}
        </button>
        {!rejecting ? (
          <button
            type="button"
            onClick={() => {
              setRejecting(true);
              setError(null);
            }}
            disabled={pending}
            className="flex-1 flex items-center justify-center gap-2 rounded-full border border-border/60 h-10 text-[14px] font-bold text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors cursor-pointer disabled:opacity-50"
          >
            <XIcon weight="bold" className="w-4 h-4" />
            Rejeter
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setRejecting(false);
              setReason("");
            }}
            className="flex-1 rounded-full px-4 h-10 text-[13px] font-bold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Annuler
          </button>
        )}
      </div>
      {rejecting && !done && (
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motif du rejet (envoyé au maker)…"
            autoFocus
            className="w-full bg-background border border-border/60 rounded-xl px-4 py-2.5 text-[14px] font-medium placeholder:text-muted-foreground/40 text-foreground outline-none focus:border-red-500/50 transition-colors"
          />
          <button
            type="button"
            onClick={confirmReject}
            disabled={reason.trim() === "" || pending}
            className="rounded-full bg-red-600 px-4 py-2 text-[13px] font-bold text-white hover:bg-red-500 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pending ? "Envoi…" : "Confirmer le rejet"}
          </button>
        </div>
      )}
      {error !== null && (
        <p role="alert" className="text-[13px] font-bold text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Panneau « Binaire Android » (D2-UI) : MÊME pattern que la file fiches
 * (`ReviewQueue`) — logo, version+pastilles, package, meta, SLA. AUCUNE
 * approval inline hors cockpit… ce panneau EST le cockpit : les verdicts
 * par build vivent ici et seulement ici (même règle que `ReviewVerdict`
 * pour la fiche). Vide = état honnête (fiche Android sans APK).
 */
export function ReviewBuilds({
  builds,
  productIconUrl,
  productInitials,
}: {
  builds: ReviewBuildItem[];
  /** Logo fiche en repli (D6) : l'icône APK n'est pas stockée en base. */
  productIconUrl?: string | null;
  /** Repli initiales (calculé serveur, comme la file fiches). */
  productInitials?: string;
}) {
  if (builds.length === 0) {
    return (
      <p className="text-[13px] font-medium text-muted-foreground">
        Aucun binaire — fiche seule (liens externes uniquement).
      </p>
    );
  }
  return (
    <div className="flex flex-col">
      {builds.map((b) => {
        const table = toTableInput(b);
        // Pinning souple (D4) : cert différent du dernier approuvé plus
        // ancien → rotation possible, la revue tranche (pas d'auto-rejet).
        const previousApproved = builds
          .filter(
            (o) =>
              o.id !== b.id &&
              o.status === "approved" &&
              new Date(o.createdAt).getTime() < new Date(b.createdAt).getTime(),
          )
          .sort((x, y) => new Date(y.createdAt).getTime() - new Date(x.createdAt).getTime())[0];
        const rotated =
          previousApproved?.certSha256 &&
          b.certSha256 &&
          previousApproved.certSha256 !== b.certSha256;
        const exceeded = b.status === "pending" && b.waitingHours > 24;
        return (
          <div key={b.id}>
            <div className="group flex gap-4 py-5 px-3 rounded-2xl hover:bg-muted/40 transition-colors">
              {/* Logo fiche (même repli que partout), sinon initiales */}
              <span className="w-12 h-12 rounded-2xl shrink-0 overflow-hidden shadow-sm">
                <ProductAvatar iconUrl={productIconUrl} initials={productInitials ?? "?"} />
              </span>

              {/* Body */}
              <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-[16px] font-extrabold tracking-tight text-foreground">
                    {versionLabel(b)}
                  </span>
                  <span
                    className={cn(
                      "inline-flex items-center rounded border px-1.5 py-px text-[9px] font-black uppercase tracking-[0.14em] leading-none shrink-0",
                      PILL[b.status] ?? PILL.pending,
                    )}
                  >
                    {PILL_LABEL[b.status] ?? b.status}
                  </span>
                  {rotated && (
                    <span
                      title="Certificat différent du dernier build approuvé — rotation de clé ? Vérifier l'authenticité avant d'approuver."
                      className="inline-flex items-center rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-px text-[9px] font-black uppercase tracking-[0.14em] leading-none shrink-0 text-amber-600 dark:text-amber-400"
                    >
                      Clé différente
                    </span>
                  )}
                </div>

                <p className="font-mono text-[12px] font-medium text-muted-foreground truncate">
                  {b.package ?? "package inconnu"}
                </p>

                {/* Note de version (update) : le reviewer la lit AVANT de
                    trancher — même contenu que la fiche publique. */}
                {b.whatsnew ? (
                  <p className="text-[13px] font-medium text-foreground/90 leading-relaxed whitespace-pre-line">
                    {b.whatsnew}
                  </p>
                ) : (
                  <p className="text-[12px] font-medium text-muted-foreground/70">
                    Sans note de version.
                  </p>
                )}

                <div className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground flex-wrap">
                  <span className="tabular-nums">{formatMo(b.sizeBytes)}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">SHA-256 : {b.sha256File.slice(0, 16)}…</span>
                  <span aria-hidden="true">·</span>
                  <span>{formatDate(b.createdAt)}</span>
                </div>

                {b.status === "pending" && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="flex items-center gap-1.5 text-[12px] font-bold text-amber-600 dark:text-amber-400">
                      <HourglassIcon weight="fill" className="w-3.5 h-3.5" />
                      {waitingFr(b.createdAt)}
                    </span>
                    {exceeded && (
                      <span className="inline-flex items-center rounded-md border border-red-500/25 bg-red-500/10 px-1.5 py-0.75 text-[9px] font-black uppercase tracking-[0.14em] leading-none text-red-600 dark:text-red-400 shrink-0">
                        Dépassé
                      </span>
                    )}
                  </div>
                )}
                {b.status === "rejected" && b.rejectionReason && (
                  <p className="text-[12px] font-medium text-red-600 dark:text-red-400 leading-snug line-clamp-1">
                    Motif : {b.rejectionReason}
                  </p>
                )}

                <details className="group/details">
                  <summary className="text-[12px] font-bold text-muted-foreground hover:text-foreground transition-colors cursor-pointer w-fit list-none flex items-center gap-1.5 [&::-webkit-details-marker]:hidden">
                    <CaretRightIcon
                      weight="bold"
                      className="w-3.5 h-3.5 transition-transform group-open/details:rotate-90"
                    />
                    Détails techniques
                  </summary>
                  <div className="flex flex-col gap-3 pt-3">
                    {table ? (
                      <BuildPlayTable
                        manifest={table.manifest}
                        certs={[table.cert]}
                        fileName={versionLabel(b)}
                        sizeBytes={b.sizeBytes}
                        reviewed={b.status === "approved"}
                        iconUrl={productIconUrl}
                      />
                    ) : (
                      <p className="font-mono text-[12px] text-muted-foreground break-all">
                        Métadonnées non extraites (upload D1).
                      </p>
                    )}
                    {b.downloadUrl ? (
                      <a
                        href={b.downloadUrl}
                        download
                        className="inline-flex w-fit items-center gap-2 rounded-full border border-border/60 px-4 py-2 text-[13px] font-bold text-foreground hover:border-foreground transition-colors"
                      >
                        <ArrowSquareOutIcon weight="bold" className="w-4 h-4" />
                        Télécharger l&apos;APK (tester)
                      </a>
                    ) : (
                      <p className="text-[13px] font-medium text-muted-foreground">
                        Lien de téléchargement expiré — rechargez la page.
                      </p>
                    )}
                  </div>
                </details>
              </div>
            </div>

            {/* Verdict : ICI et seulement ici (page détail, comme la fiche). */}
            {b.status === "pending" && (
              <div className="pl-16 pr-3 pb-5">
                <BuildVerdictButtons buildId={b.id} version={versionLabel(b)} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
