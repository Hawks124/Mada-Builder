"use client";

import * as React from "react";
import Link from "next/link";
import { CheckIcon, XIcon, ArrowLeftIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

// Verdict — SEUL endroit où l'approbation existe (anti-clic accidentel).
// Approve = un clic (réversible côté admin). Reject = motif obligatoire.
// Backend : approveProduct / rejectProduct + email maker.
export function ReviewVerdict({ productName }: { productName: string }) {
  const [verdict, setVerdict] = React.useState<"approved" | "rejected" | null>(null);
  const [rejecting, setRejecting] = React.useState(false);
  const [rejectReason, setRejectReason] = React.useState("");

  const confirmReject = () => {
    if (rejectReason.trim() === "") return;
    setVerdict("rejected");
    setRejecting(false);
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
            ? `${productName} publié — le maker est notifié.`
            : `${productName} rejeté — motif envoyé au maker.`}
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
        onClick={() => setVerdict("approved")}
        className="w-full flex items-center justify-center gap-2 rounded-full bg-emerald-600 h-12 text-[15px] font-bold text-white hover:bg-emerald-500 transition-colors cursor-pointer"
      >
        <CheckIcon weight="bold" className="w-4 h-4" />
        Approuver
      </button>
      {!rejecting ? (
        <button
          type="button"
          onClick={() => setRejecting(true)}
          className="w-full flex items-center justify-center gap-2 rounded-full border border-border/60 h-12 text-[15px] font-bold text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors cursor-pointer"
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
              disabled={rejectReason.trim() === ""}
              className="flex-1 rounded-full bg-red-600 px-4 py-2 text-[13px] font-bold text-white hover:bg-red-500 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Confirmer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
