"use client";

import * as React from "react";
import { FileArrowDownIcon } from "@phosphor-icons/react";
import { AvatarImage } from "@/components/ui/avatar-image";
import { StaffIdentity } from "@/components/admin/user-identity";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { reviewAppealAction } from "@/app/actions/appeals";

export type AppealRow = {
  id: string;
  /** User concerné (ID support pour StaffIdentity). */
  userId: string;
  /** Rang de l'appel pour ce user (Appel nºX). */
  seq: number;
  username: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  providers: string[];
  joinedAt: string;
  banReason: string;
  explanation: string;
  evidenceLinks: string[];
  createdAt: string;
};

/**
 * File des appels pending — user, motif, explication, pièces (liens
 * signés 72 h générés serveur), date + décision. Débannir = unban +
 * overturned + email victime ; Maintenir = upheld + email victime.
 */
export function AppealsPanel({ initial }: { initial: AppealRow[] }) {
  const [decidingId, setDecidingId] = React.useState<string | null>(null);
  const [doneIds, setDoneIds] = React.useState<Set<string>>(new Set());
  const [error, setError] = React.useState<string | null>(null);

  const decide = (appeal: AppealRow, decision: "upheld" | "overturned") => {
    setError(null);
    setDecidingId(appeal.id);
    React.startTransition(async () => {
      const result = await reviewAppealAction({
        appealId: appeal.id,
        decision,
      });
      setDecidingId(null);
      if (!result.ok) {
        const message = result.message ?? "Décision impossible.";
        setError(message);
        toast("err", message);
        return;
      }
      toast("ok", result.message ?? "Décision enregistrée.");
      setDoneIds((prev) => new Set(prev).add(appeal.id));
    });
  };

  const pending = initial.filter((a) => !doneIds.has(a.id));

  if (pending.length === 0) {
    return (
      <p className="text-[14px] font-medium text-muted-foreground py-8 text-center">
        Aucun appel en attente — bon travail.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <p
          role="alert"
          className="rounded-2xl border border-red-500/25 bg-red-500/10 px-5 py-3 text-[13px] font-medium text-red-600 dark:text-red-400 leading-relaxed"
        >
          {error}
        </p>
      )}
      {pending.map((appeal) => (
        <div
          key={appeal.id}
          className="rounded-3xl border border-border/40 bg-muted/20 p-6 flex flex-col gap-4"
        >
          {/* Identité — MÊME composant que la ligne user (Tous/Bannis) :
              mêmes infos, mêmes logos providers, même ordre. Seuls les
              badges changent (Banni + Appel nºX, seq figé au dépôt). */}
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <AvatarImage
                src={appeal.avatarUrl}
                name={appeal.displayName}
                className="h-10 w-10 rounded-full shrink-0"
              />
              <StaffIdentity
                id={appeal.userId}
                username={appeal.username}
                displayName={appeal.displayName}
                email={appeal.email}
                providers={appeal.providers}
                joinedAt={appeal.joinedAt}
                badges={
                  <>
                    <span className="rounded-full bg-red-500/10 px-2.5 py-0.5 text-[11px] font-bold text-red-600 dark:text-red-400 shrink-0">
                      Banni
                    </span>
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-bold text-muted-foreground shrink-0">
                      Appel nº{appeal.seq}
                    </span>
                  </>
                }
              />
            </div>
            <span className="text-[12px] font-medium text-muted-foreground shrink-0">
              {new Intl.DateTimeFormat("fr-FR", {
                day: "numeric",
                month: "short",
                year: "numeric",
              }).format(new Date(appeal.createdAt))}
            </span>
          </div>

          <p className="text-[13px] font-medium text-red-600 dark:text-red-400 leading-relaxed">
            Motif du ban : {appeal.banReason}
          </p>
          <p className="text-[14px] font-medium text-foreground leading-relaxed whitespace-pre-wrap">
            {appeal.explanation}
          </p>

          {appeal.evidenceLinks.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {appeal.evidenceLinks.map((link, i) => (
                <a
                  key={link}
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-4 py-2 text-[13px] font-bold text-foreground hover:border-foreground/30 hover:bg-muted/50 transition-colors"
                >
                  <FileArrowDownIcon weight="bold" className="h-4 w-4" />
                  Pièce {i + 1}
                </a>
              ))}
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => decide(appeal, "upheld")}
              disabled={decidingId === appeal.id}
              className="rounded-full border border-border/60 px-5 py-2.5 text-[13px] font-bold text-muted-foreground hover:text-foreground hover:border-border transition-colors cursor-pointer disabled:opacity-50"
            >
              Maintenir
            </button>
            <button
              type="button"
              onClick={() => decide(appeal, "overturned")}
              disabled={decidingId === appeal.id}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-[13px] font-bold text-white hover:bg-emerald-500 transition-colors cursor-pointer disabled:opacity-50"
            >
              {decidingId === appeal.id && <Spinner size="xs" />}
              Débannir
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
