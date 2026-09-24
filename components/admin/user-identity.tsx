"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import {
  GithubLogoIcon,
  EnvelopeIcon,
  CopyIcon,
  CheckIcon,
} from "@phosphor-icons/react";

/**
 * Identité user côté staff — UNE seule implémentation, utilisée par la
 * ligne user (Tous/Bannis) ET la carte appel. C'est ce qui garantit que
 * les infos user se ressemblent partout : toute retouche ici se
 * répercute aux deux endroits (plus jamais deux rendus divergents).
 *
 * Bloc : nom + badges (slot) / @username · providers · date /
 * email + ID tronqué-copie (lecture admin — jamais en public).
 */
export function ProviderMarks({ providers }: { providers: string[] }) {
  if (providers.length === 0) {
    return (
      <span className="text-muted-foreground/60">Aucun provider</span>
    );
  }
  return (
    <span className="flex items-center gap-2.5">
      {providers.map((p) =>
        p === "google" ? (
          <span
            key={p}
            className="flex items-center gap-1.5 text-muted-foreground"
          >
            <Image
              src="/logos/google.svg"
              alt="Google"
              width={14}
              height={14}
              className="w-3.5 h-3.5 shrink-0"
            />
            Google
          </span>
        ) : p === "github" ? (
          <span
            key={p}
            className="flex items-center gap-1.5 text-muted-foreground"
          >
            <GithubLogoIcon weight="fill" className="w-3.5 h-3.5 shrink-0" />
            GitHub
          </span>
        ) : (
          <span
            key={p}
            className="flex items-center gap-1.5 text-muted-foreground"
          >
            <EnvelopeIcon weight="bold" className="w-3.5 h-3.5 shrink-0" />
            Email
          </span>
        ),
      )}
    </span>
  );
}

export function joinedText(iso: string | null): string {
  if (!iso) return "Date inconnue";
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return "Date inconnue";
  }
}

// ID support : 8 premiers caractères + copie complète (clipboard best-effort).
export function UserIdCopy({ id }: { id: string }) {
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(id);
    } catch {
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      type="button"
      onClick={copy}
      title={`Copier l'ID complet (${id})`}
      className="inline-flex items-center gap-1 shrink-0 font-mono text-[11px] text-muted-foreground/60 hover:text-foreground transition-colors cursor-pointer"
    >
      {id.slice(0, 8)}…
      {copied ? (
        <CheckIcon weight="bold" className="h-3 w-3 text-emerald-500" />
      ) : (
        <CopyIcon className="h-3 w-3" />
      )}
    </button>
  );
}

export function StaffIdentity({
  id,
  username,
  displayName,
  email,
  providers,
  joinedAt,
  badges,
}: {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  providers: string[];
  /** ISO — null = "Date inconnue". */
  joinedAt: string | null;
  /** Pastilles (Banni, Admin, Modo, Appel nºX…) — langage du parent. */
  badges?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-w-0">
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/makers/${username}`}
            className="text-[16px] font-extrabold tracking-tight text-foreground hover:text-primary transition-colors truncate"
          >
            {displayName}
          </Link>
          {badges}
        </div>
        <p className="flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground truncate">
          <span className="truncate">@{username}</span>
          <span aria-hidden="true">·</span>
          <ProviderMarks providers={providers} />
          <span aria-hidden="true">·</span>
          <span className="truncate">{joinedText(joinedAt)}</span>
        </p>
      </div>
      <div className="flex items-center gap-2 min-w-0 mt-3">
        {email && (
          <p className="text-[12px] font-medium text-muted-foreground/70 truncate">
            {email}
          </p>
        )}
        <UserIdCopy id={id} />
      </div>
    </div>
  );
}
