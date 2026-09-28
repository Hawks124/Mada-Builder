"use client";

import { useState } from "react";
import { ArrowRightIcon, CheckIcon } from "@phosphor-icons/react";
import { LEGAL_IDENTITY } from "@/lib/legal-content";

/**
 * Champ d'inscription au digest — **n'écrit rien**.
 *
 * Il n'existe aucune table d'abonnés : ni storage, ni service d'envoi en
 * liste. Le champ est donc un point de contact, pas un formulaire qui répond
 * « merci, inscrit » — cette réponse serait fausse, et l'adresse donnée de
 * bonne foi disparaît. À la soumission, on affiche ce qui est vrai et on donne
 * le canal qui marche : l'email de l'éditeur, qui répond à la main.
 *
 * Quand le digest existera, il ne restera qu'à brancher l'action de serveur et
 * à remplacer ce message par une double confirmation.
 */
export function DigestForm() {
  const [sent, setSent] = useState(false);
  const [value, setValue] = useState("");

  if (sent) {
    return (
      <div
        aria-live="polite"
        className="mt-4 rounded-xl border border-border/60 bg-background px-4 py-3.5"
      >
        <p className="flex items-center gap-2 text-[13px] font-bold text-foreground">
          <CheckIcon weight="bold" className="h-3.5 w-3.5 shrink-0" />
          Le digest n&apos;est pas encore ouvert
        </p>
        <p className="mt-1.5 text-[12px] font-medium leading-relaxed text-muted-foreground">
          Rien n&apos;est enregistré. Écrivez-nous à la place et nous vous prévenons personnellement
          du lancement.
        </p>
        <a
          href={`mailto:${LEGAL_IDENTITY.contactEmail}?subject=${encodeURIComponent("Être prévenu du digest")}`}
          className="mt-2.5 inline-flex items-center gap-1.5 text-[12px] font-bold text-foreground underline decoration-border decoration-2 underline-offset-[3px] transition-colors hover:decoration-foreground"
        >
          {LEGAL_IDENTITY.contactEmail}
          <ArrowRightIcon weight="bold" aria-hidden="true" className="h-3 w-3" />
        </a>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setSent(true);
      }}
      className="mt-4 flex flex-col gap-2"
    >
      <label htmlFor="digest-email" className="sr-only">
        Adresse email pour le digest hebdomadaire
      </label>
      <div className="flex items-center gap-2 rounded-full border border-foreground/20 bg-background px-4 py-1.5 transition-colors focus-within:border-foreground/50">
        <input
          id="digest-email"
          type="email"
          required
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="votre@email.com"
          className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-foreground outline-none placeholder:text-muted-foreground/60"
        />
        <button
          type="submit"
          className="shrink-0 rounded-full bg-foreground px-3.5 py-1.5 text-[12px] font-bold text-background transition-opacity hover:opacity-90 cursor-pointer"
        >
          S&apos;inscrire
        </button>
      </div>
    </form>
  );
}
