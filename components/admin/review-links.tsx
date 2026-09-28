"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowSquareOutIcon, ArrowClockwiseIcon } from "@phosphor-icons/react";
import { StoreLogo } from "@/components/ui/store-logo";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { PRODUCT_LINK_FIELDS, linkIdsForType, type LinkFieldDef } from "@/config/product-links";
import {
  classifyForSubmit,
  verdictMessage,
  type UrlPolicy,
  type UrlVerdict,
} from "@/lib/url-verdict";
import type { UrlCheckResult } from "@/services/url-check.service";

/**
 * Liens d'une fiche soumise (cockpit admin) — piloté par la matrice
 * (socle + bloc du type, jamais de slots en dur) : logo store, URL
 * cliquable, pastille de vérification RECALCULÉE au chargement (bulk
 * serveur, cache-first) + bouton "revérifier" manuel (force, pour le cas
 * "c'était down il y a 10 minutes"). Champs vides = "Non fourni" (le
 * reviewer voit ce qui manque, comme avant).
 */
export function ReviewLinks({
  productType,
  linkValues,
  initialVerdicts,
  only,
}: {
  productType: string;
  linkValues: Record<string, string>;
  initialVerdicts: Record<string, UrlCheckResult>;
  /** Restreint aux field-ids listés (défaut : matrice du type). */
  only?: string[];
}) {
  const ids = only ?? linkIdsForType(productType);
  const fields = ids
    .map((id) => PRODUCT_LINK_FIELDS[id])
    .filter((f): f is LinkFieldDef => Boolean(f));

  return (
    <div className="flex flex-col">
      {fields.map((field) => (
        <ReviewLinkRow
          key={field.id}
          field={field}
          url={(linkValues[field.id] ?? "").trim() || null}
          initial={initialVerdicts[field.id] ?? null}
        />
      ))}
    </div>
  );
}

const TONE: Record<UrlPolicy, string> = {
  ok: "text-emerald-600 dark:text-emerald-400",
  warn: "text-amber-600 dark:text-amber-400",
  block: "text-red-600 dark:text-red-400",
};

function ReviewLinkRow({
  field,
  url,
  initial,
}: {
  field: LinkFieldDef;
  url: string | null;
  initial: UrlCheckResult | null;
}) {
  const [verdict, setVerdict] = React.useState<UrlVerdict | null>(initial?.verdict ?? null);
  const [checking, setChecking] = React.useState(false);

  if (url === null) {
    return (
      <div className="flex items-center gap-3 rounded-2xl px-4 py-3 -mx-4 opacity-60">
        <span className="h-9 w-9 rounded-xl bg-muted/40 border border-border/40 flex items-center justify-center shrink-0 text-muted-foreground/50">
          <StoreLogo icon={field.icon} className="w-4 h-4" />
        </span>
        <span className="flex flex-col min-w-0 flex-1">
          <span className="text-[14px] font-bold text-muted-foreground">{field.label}</span>
          <span className="text-[12px] font-medium text-muted-foreground/60">Non fourni</span>
        </span>
      </div>
    );
  }

  const policy: UrlPolicy | null = verdict ? classifyForSubmit(verdict) : null;

  const recheck = async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/v1/urls/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, force: true }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok: boolean;
        data?: { verdict?: UrlVerdict };
      } | null;
      if (json?.ok && json.data?.verdict) setVerdict(json.data.verdict);
    } catch {
      // Silence : la pastille précédente reste (pas de régression visuelle).
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="group flex items-center gap-3 rounded-2xl px-4 py-3 -mx-4 hover:bg-muted/50 transition-colors">
      <span className="h-9 w-9 rounded-xl bg-muted/40 border border-border/40 flex items-center justify-center shrink-0 text-muted-foreground group-hover:text-foreground transition-colors">
        <StoreLogo icon={field.icon} className="w-4 h-4" />
      </span>
      <span className="flex flex-col min-w-0 flex-1">
        <span className="flex items-center gap-2 flex-wrap">
          <Link
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[14px] font-bold text-foreground hover:underline truncate"
          >
            {field.label}
          </Link>
          {checking ? (
            <Spinner size="xs" />
          ) : (
            policy && (
              <span className={cn("text-[11px] font-bold", TONE[policy])}>
                {policy === "ok"
                  ? "Joignable"
                  : policy === "warn"
                    ? `À examiner — ${verdictMessage(verdict!)}`
                    : verdictMessage(verdict!)}
              </span>
            )
          )}
        </span>
        <span className="text-[12px] font-medium text-muted-foreground truncate">{url}</span>
      </span>
      <button
        type="button"
        onClick={recheck}
        disabled={checking}
        title="Revérifier ce lien (force, ignore le cache)"
        aria-label={`Revérifier ${field.label}`}
        className="flex items-center justify-center h-8 w-8 rounded-full text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-50 shrink-0"
      >
        <ArrowClockwiseIcon weight="bold" className="w-4 h-4" />
      </button>
      <Link
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Ouvrir ${field.label}`}
        className="text-muted-foreground/60 group-hover:text-foreground transition-colors shrink-0"
      >
        <ArrowSquareOutIcon weight="bold" className="w-4 h-4" />
      </Link>
    </div>
  );
}
