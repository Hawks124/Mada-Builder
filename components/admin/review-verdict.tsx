"use client";

import * as React from "react";
import { startTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckIcon, XIcon, ArrowLeftIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import { approveProductAction, rejectProductAction } from "@/app/actions/products";

// Verdict — SEUL endroit où l'approbation existe (anti-clic accidentel).
// Approve = un appel (email maker best-effort côté serveur).
// Reject = motif obligatoire (emailé). Erreur serveur = affichée, on reste.
// Après verdict : retour auto à la file (2 s, le temps de lire) — rester
// sur le dossier tranché puis recharger donnait un 404 brut (QA).
export function ReviewVerdict({
  productId,
  productName,
}: {
  productId: string;
  productName: string;
}) {
  const [verdict, setVerdict] = React.useState<"approved" | "rejected" | null>(null);
  const [rejecting, setRejecting] = React.useState(false);
  const [rejectReason, setRejectReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const router = useRouter();

  // Retour file après verdict (le dossier n'existe plus en pending).
  React.useEffect(() => {
    if (!verdict) return;
    const t = setTimeout(() => router.push("/admin/review"), 2000);
    return () => clearTimeout(t);
  }, [verdict, router]);

  const doApprove = () => {
    if (pending) return;
    setPending(true);
    setError(null);
    startTransition(async () => {
      const res = await approveProductAction({ productId });
      if (res.ok) {
        setVerdict("approved");
        toast("ok", `${productName} publié — retour à la file…`);
      } else {
        setError(res.message ?? "Approbation impossible pour le moment.");
      }
      setPending(false);
    });
  };

  const confirmReject = () => {
    if (rejectReason.trim() === "" || pending) return;
    setPending(true);
    setError(null);
    startTransition(async () => {
      const res = await rejectProductAction({ productId, reason: rejectReason.trim() });
      if (res.ok) {
        setVerdict("rejected");
        setRejecting(false);
        toast("ok", `${productName} rejeté — retour à la file…`);
      } else {
        setError(res.message ?? "Rejet impossible pour le moment.");
      }
      setPending(false);
    });
  };

  if (verdict) {
    return (
      <div className="flex flex-col gap-3">
        <div
          className={cn(
            "rounded-2xl border px-5 py-4 text-[14px] font-bold",
            verdict === "approved"
              ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-400",
          )}
        >
          {verdict === "approved"
            ? `${productName} publié — le maker est notifié. Retour à la file…`
            : `${productName} rejeté — motif envoyé au maker. Retour à la file…`}
        </div>
        <Link
          href="/admin/review"
          className="flex items-center gap-2 text-[14px] font-bold text-muted-foreground hover:text-foreground transition-colors w-fit"
        >
          <ArrowLeftIcon weight="bold" className="h-4 w-4" />
          Retour à la file
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={doApprove}
        disabled={pending}
        className="w-full flex items-center justify-center gap-2 rounded-full bg-emerald-600 h-12 text-[15px] font-bold text-white hover:bg-emerald-500 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait"
      >
        <CheckIcon weight="bold" className="w-4 h-4" />
        {pending ? "Publication…" : "Approuver"}
      </button>
      {!rejecting ? (
        <button
          type="button"
          onClick={() => {
            setRejecting(true);
            setError(null);
          }}
          disabled={pending}
          className="w-full flex items-center justify-center gap-2 rounded-full border border-border/60 h-12 text-[15px] font-bold text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors cursor-pointer disabled:opacity-50"
        >
          <XIcon weight="bold" className="w-4 h-4" />
          Rejeter
        </button>
      ) : (
        <div className="flex flex-col gap-2 rounded-2xl border border-border/40 bg-muted/20 p-3">
          <input
            type="text"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Motif du rejet (envoyé au maker)…"
            autoFocus
            className="w-full bg-background border border-border/60 rounded-xl px-4 py-2.5 text-[14px] font-medium placeholder:text-muted-foreground/40 text-foreground outline-none focus:border-red-500/50 transition-colors"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setRejecting(false);
                setRejectReason("");
              }}
              className="flex-1 rounded-full px-4 py-2 text-[13px] font-bold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={confirmReject}
              disabled={rejectReason.trim() === "" || pending}
              className="flex-1 rounded-full bg-red-600 px-4 py-2 text-[13px] font-bold text-white hover:bg-red-500 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pending ? "Envoi…" : "Confirmer"}
            </button>
          </div>
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
