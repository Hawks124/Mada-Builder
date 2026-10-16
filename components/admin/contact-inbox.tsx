"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowSquareOutIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { setContactStatusAction } from "@/app/actions/contact";
import { contactSubjectLabel } from "@/lib/contact-subjects";
import type { ContactListItem } from "@/services/contact.service";
import type { ContactStatus } from "@/db/schema";

const STATUS_LABEL: Record<ContactStatus, string> = {
  new: "Nouveau",
  read: "Lu",
  replied: "Répondu",
  archived: "Archivé",
};

/**
 * File contact admin — une ligne par message, transitions de statut
 * (serveur + refresh), réponse via le client mail (mailto pré-rempli :
 * pas de composeur à construire ni à maintenir). Message affiché tel
 * quel (React échappe — jamais de HTML injecté).
 */
export function ContactInbox({ initial }: { initial: ContactListItem[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  const transition = async (id: string, status: ContactStatus) => {
    if (pendingId) return;
    setPendingId(id);
    await setContactStatusAction({ id, status });
    setPendingId(null);
    router.refresh();
  };

  if (initial.length === 0) {
    return (
      <p className="text-[14px] font-medium text-muted-foreground py-8 text-center">
        Rien ici — la file est vide.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {initial.map((m) => (
        <li
          key={m.id}
          className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-background p-5"
        >
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center rounded-md border border-border/60 bg-muted/40 px-1.5 py-0.75 text-[9px] font-black uppercase tracking-[0.14em] leading-none text-muted-foreground">
              {contactSubjectLabel(m.subject)}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.75 text-[9px] font-black uppercase tracking-[0.14em] leading-none",
                m.status === "new"
                  ? "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                  : "border-border/60 bg-muted/40 text-muted-foreground",
              )}
            >
              <span className="h-1 w-1 rounded-full bg-current" aria-hidden="true" />
              {STATUS_LABEL[m.status]}
            </span>
            <span className="ml-auto text-[12px] font-medium text-muted-foreground tabular-nums">
              {new Date(m.createdAt).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <p className="text-[15px] font-extrabold text-foreground">
              {m.name}{" "}
              <Link
                href={`mailto:${m.email}`}
                className="font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                &lt;{m.email}&gt;
              </Link>
            </p>
            {m.productUrl && (
              <Link
                href={m.productUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[13px] font-bold text-muted-foreground hover:text-foreground transition-colors w-fit"
              >
                {m.productUrl.length > 60 ? `${m.productUrl.slice(0, 60)}…` : m.productUrl}
                <ArrowSquareOutIcon weight="bold" className="w-3.5 h-3.5" />
              </Link>
            )}
          </div>

          <p className="text-[14px] leading-relaxed text-foreground whitespace-pre-wrap">
            {m.message}
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Link
              href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: [${contactSubjectLabel(m.subject)}] Mada-Made`)}&body=${encodeURIComponent(`Bonjour ${m.name},\n\n`)}`}
              className="rounded-full bg-foreground px-4 py-2 text-[13px] font-bold text-background transition-opacity hover:opacity-90"
            >
              Répondre
            </Link>
            {m.status === "new" && (
              <StatusButton
                label={pendingId === m.id ? "…" : "Marquer lu"}
                onClick={() => transition(m.id, "read")}
                disabled={pendingId === m.id}
              />
            )}
            {(m.status === "new" || m.status === "read") && (
              <StatusButton
                label={pendingId === m.id ? "…" : "Marqué répondu"}
                onClick={() => transition(m.id, "replied")}
                disabled={pendingId === m.id}
              />
            )}
            {m.status !== "archived" && (
              <StatusButton
                label={pendingId === m.id ? "…" : "Archiver"}
                onClick={() => transition(m.id, "archived")}
                disabled={pendingId === m.id}
              />
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function StatusButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-full border border-border/60 px-4 py-2 text-[13px] font-bold text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors cursor-pointer disabled:opacity-50"
    >
      {label}
    </button>
  );
}
