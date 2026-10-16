"use client";

import * as React from "react";
import { CheckCircle } from "@phosphor-icons/react";
import { Select } from "@/components/ui/select";
import { InputField } from "@/components/ui/input-field";
import { FieldBadge } from "@/components/ui/field-badge";
import { submitContactAction } from "@/app/actions/contact";
import { CONTACT_SUBJECTS } from "@/lib/contact-subjects";
import type { ContactSubject } from "@/db/schema";
import { cn } from "@/lib/utils";

const MAX_MESSAGE = 2000;

/**
 * Formulaire `/contact` — public, SANS auth (sponsors et partenaires ne
 * sont pas forcément membres). Motif via `Select` partagé, honeypot
 * invisible `company` (bot → succès silencieux côté service).
 * Succès honnête : « bien reçu, réponse sous 5 jours ouvrés » — pas de
 * ticket bidon, pas d'id interne exposé.
 */
export function ContactForm() {
  const [subject, setSubject] = React.useState<ContactSubject>("sponsoring");
  const [message, setMessage] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);

  if (sent) {
    return (
      <div
        aria-live="polite"
        className="flex flex-col items-start gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-6 py-8"
      >
        <p className="flex items-center gap-2 text-[16px] font-black text-foreground">
          <CheckCircle weight="fill" className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          Message bien reçu.
        </p>
        <p className="text-[14px] font-medium text-muted-foreground leading-relaxed max-w-xl">
          L&apos;équipe répond sous 5 jours ouvrés, directement à votre adresse. Inutile de renvoyer
          — votre message est dans la file.
        </p>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={async (e) => {
        e.preventDefault();
        if (pending) return;
        setPending(true);
        setError(null);
        const data = new FormData(e.currentTarget);
        const res = await submitContactAction({
          name: String(data.get("name") ?? ""),
          email: String(data.get("email") ?? ""),
          subject,
          message,
          productUrl: String(data.get("productUrl") ?? ""),
          company: String(data.get("company") ?? ""),
        });
        setPending(false);
        if (res.ok) setSent(true);
        else setError(res.message);
      }}
    >
      <div className="flex flex-col gap-2">
        <span className="text-[14px] font-bold text-foreground flex items-center gap-2">
          Motif
          <FieldBadge variant="required" />
        </span>
        <Select
          value={subject}
          onChange={(v) => setSubject(v as ContactSubject)}
          options={CONTACT_SUBJECTS.map((s) => ({ id: s.id, label: s.label }))}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <InputField
          label="Votre nom"
          name="name"
          isRequired
          placeholder="ex : Aina R."
          maxLength={80}
          autoComplete="name"
        />
        <InputField
          label="Votre email"
          name="email"
          type="email"
          isRequired
          placeholder="vous@exemple.mg"
          maxLength={254}
          autoComplete="email"
          subtitle="C'est à cette adresse que l'équipe répond."
        />
      </div>

      <InputField
        label="Lien concerné"
        name="productUrl"
        type="url"
        isOptional
        placeholder="https://… (produit, dossier, article)"
        maxLength={500}
        autoComplete="off"
        subtitle="Optionnel : le produit ou la page dont vous parlez."
      />

      <div className="flex flex-col gap-2">
        <label
          htmlFor="contact-message"
          className="text-[14px] font-bold text-foreground flex items-center justify-between"
        >
          <span className="flex items-center gap-2">
            Message
            <FieldBadge variant="required" />
          </span>
          <span
            className={cn(
              "text-[11px] font-bold tabular-nums",
              message.length >= Math.floor(MAX_MESSAGE * 0.9)
                ? "text-red-600 dark:text-red-400"
                : "text-muted-foreground/70",
            )}
          >
            {message.length} / {MAX_MESSAGE}
          </span>
        </label>
        <textarea
          id="contact-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={6}
          maxLength={MAX_MESSAGE}
          minLength={20}
          required
          placeholder="Expliquez votre demande en quelques phrases (20 signes minimum)…"
          className="w-full rounded-2xl bg-background border border-border/60 px-5 py-4 text-[15px] font-medium placeholder:text-muted-foreground/30 text-foreground outline-none focus:border-foreground/40 hover:border-foreground/20 transition-colors resize-y"
        />
      </div>

      {/* Honeypot anti-bot : invisible humain, jamais rempli à la main. */}
      <div aria-hidden="true" className="absolute h-px w-px overflow-hidden opacity-0">
        <label>
          Société
          <input type="text" name="company" tabIndex={-1} autoComplete="off" defaultValue="" />
        </label>
      </div>

      {error && (
        <p role="alert" className="text-[13px] font-bold text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-fit items-center gap-2 rounded-full bg-foreground px-8 py-3 text-[14px] font-bold text-background transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        {pending ? "Envoi…" : "Envoyer le message"}
      </button>
    </form>
  );
}
