"use client";

import * as React from "react";
import Image from "next/image";
import {
  GithubLogoIcon,
  CheckCircleIcon,
  EnvelopeIcon,
} from "@phosphor-icons/react";
import { linkProvider, unlinkProvider } from "@/app/actions/auth";
import { Spinner } from "@/components/ui/spinner";

export type ProviderId = "github" | "google" | "email";

// Lignes fournisseurs — lie/délie via Server Actions (pending par ligne,
// promesses awaitées : jamais de clic aveugle).
// Garde : impossible de délier le dernier accès (anti-lockout),
// refusé côté serveur aussi (défense en profondeur).
// Email : lecture seule (le link passe par /signin, code OTP).
export function ProvidersCard({
  connected,
  githubHandle,
}: {
  connected: ProviderId[];
  githubHandle?: string | null;
}) {
  const [pendingId, setPendingId] = React.useState<ProviderId | null>(null);
  const isLast = connected.length <= 1;

  const run = (id: ProviderId, fn: () => Promise<unknown>) => {
    setPendingId(id);
    void (async () => {
      try {
        await fn();
      } finally {
        setPendingId(null);
      }
    })();
  };

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">
        Fournisseurs connectés
      </h2>

      <ProviderRow
        icon={
          <GithubLogoIcon
            weight="fill"
            className="h-6 w-6 text-foreground shrink-0"
          />
        }
        name="GitHub"
        sub={githubHandle ? `@${githubHandle}` : "Compte GitHub lié"}
        connected={connected.includes("github")}
        isLast={isLast}
        pending={pendingId === "github"}
        onConnect={() => run("github", () => linkProvider("github"))}
        onDisconnect={() => run("github", () => unlinkProvider("github"))}
      />

      <ProviderRow
        icon={
          <Image
            src="/logos/google.svg"
            alt="Google"
            width={24}
            height={24}
            className="h-6 w-6 shrink-0"
          />
        }
        name="Google"
        sub={
          connected.includes("google")
            ? "Compte Google lié"
            : "Liez un second fournisseur pour sécuriser l'accès."
        }
        connected={connected.includes("google")}
        isLast={isLast}
        pending={pendingId === "google"}
        onConnect={() => run("google", () => linkProvider("google"))}
        onDisconnect={() => run("google", () => unlinkProvider("google"))}
      />

      <ProviderRow
        icon={
          <EnvelopeIcon
            weight="bold"
            className="h-6 w-6 text-foreground shrink-0"
          />
        }
        name="Email"
        sub="Connexion par code à 6 chiffres, sans mot de passe."
        connected={connected.includes("email")}
        isLast={isLast}
        pending={false}
        readonly
      />
    </div>
  );
}

function ProviderRow({
  icon,
  name,
  sub,
  connected,
  isLast,
  pending,
  readonly,
  onConnect,
  onDisconnect,
}: {
  icon: React.ReactNode;
  name: string;
  sub: string;
  connected: boolean;
  isLast: boolean;
  pending: boolean;
  readonly?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border/40 px-5 py-4">
      {icon}
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-[15px] font-bold text-foreground">{name}</span>
        <span className="text-[13px] font-medium text-muted-foreground">
          {sub}
        </span>
      </div>
      {connected ? (
        isLast ? (
          <span
            title="Dernier accès — ajoutez un autre fournisseur d'abord"
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-600 dark:text-emerald-400 shrink-0 cursor-help"
          >
            <CheckCircleIcon weight="fill" className="w-3.5 h-3.5" />
            Requis
          </span>
        ) : readonly ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-600 dark:text-emerald-400 shrink-0">
            <CheckCircleIcon weight="fill" className="w-3.5 h-3.5" />
            Connecté
          </span>
        ) : (
          <span className="flex items-center gap-2 shrink-0">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-600 dark:text-emerald-400">
              <CheckCircleIcon weight="fill" className="w-3.5 h-3.5" />
              Connecté
            </span>
            <button
              type="button"
              onClick={onDisconnect}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold text-muted-foreground hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer disabled:opacity-50"
            >
              {pending && <Spinner size="xs" />}
              Retirer
            </button>
          </span>
        )
      ) : readonly ? (
        <span className="text-[12px] font-bold text-muted-foreground shrink-0">
          Non connecté
        </span>
      ) : (
        <button
          type="button"
          onClick={onConnect}
          disabled={pending}
          className="shrink-0 inline-flex items-center gap-2 rounded-full border border-border/60 px-5 py-2 text-[13px] font-bold text-foreground hover:border-foreground/30 hover:bg-muted/50 transition-colors cursor-pointer disabled:opacity-50"
        >
          {pending && <Spinner size="xs" />}
          Connecter
        </button>
      )}
    </div>
  );
}
