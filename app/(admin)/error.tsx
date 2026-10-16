"use client";

import * as React from "react";
import Link from "next/link";
import { captureError } from "@/lib/monitoring";

/**
 * Garde-fou du panel (segment admin) : SANS ce boundary, une exception
 * levée pendant le stream RSC tue la réponse en plein vol (« the
 * destination stream closed early ») et le routeur réessaie en boucle —
 * skeleton infini, zéro info. AVEC lui : une page d'erreur stable, le
 * retry s'arrête, et l'erreur réelle est journalisée (digest Next +
 * Sentry) au lieu d'être avalée par le stream.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error("[admin] erreur de rendu", error.digest ?? "sans-digest", error.message);
    captureError(error, { op: "admin.render" });
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 sm:px-6 pt-16 md:pt-24 pb-24 flex flex-col items-start gap-5">
      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">
        Admin — incident
      </p>
      <h1 className="text-3xl md:text-4xl font-black tracking-tight text-foreground">
        Le panel n&apos;a pas pu s&apos;ouvrir.
      </h1>
      <p className="text-[15px] font-medium text-muted-foreground leading-relaxed">
        L&apos;erreur est journalisée (référence
        {error.digest ? (
          <>
            {" "}
            <code className="font-mono text-[13px] text-foreground">{error.digest}</code>
          </>
        ) : (
          " ci-dessus"
        )}
        ) — aucun chiffre n&apos;a été inventé pour masquer la panne.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-full bg-foreground px-6 py-2.5 text-[13px] font-bold text-background transition-opacity hover:opacity-90 cursor-pointer"
        >
          Réessayer
        </button>
        <Link
          href="/"
          className="rounded-full border border-border/60 px-6 py-2.5 text-[13px] font-bold text-muted-foreground hover:text-foreground transition-colors"
        >
          Retour à l&apos;accueil
        </Link>
      </div>
    </main>
  );
}
