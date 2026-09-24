"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { GithubLogoIcon, Check, EnvelopeSimpleIcon } from "@phosphor-icons/react";
import { GridBackground } from "@/components/ui/grid-background";
import { InputField } from "@/components/ui/input-field";
import { ActionButton } from "@/components/ui/action-button";
import { ProfileOccupation } from "@/components/dashboard/profile-occupation";
import { TimeZoneField } from "@/components/ui/timezone-field";
import { Spinner } from "@/components/ui/spinner";
import { LogoMark } from "@/components/ui/logo";
import { completeMyProfile, type OnboardingState } from "@/app/actions/onboarding";

/**
 * Page /bienvenue STANDALONE
 * Structure 2 colonnes équilibrée sur desktop :
 * - Aucune dépendance de scroll (tout tient dans le viewport).
 * - Microcopie adaptée au pré-remplissage.
 */
export function BienvenueForm({
  missing,
  initial,
  identity,
  provider,
  next,
}: {
  missing: ("email" | "displayName")[];
  initial: { displayName: string; occupation: string };
  identity: {
    name: string;
    username: string;
    avatarUrl: string | null;
    shortId: string;
  } | null;
  /** Provider de CETTE session (page) — jamais l'historique. */
  provider: string;
  next: string;
}) {
  const [state, action, pending] = React.useActionState(completeMyProfile, {
    ok: false,
    message: null,
  } as OnboardingState);
  const needsEmail = missing.includes("email");
  const providerLabel =
    provider === "github" ? "GitHub" : provider === "google" ? "Google" : "Email";

  return (
    <div className="relative min-h-screen bg-background flex flex-col justify-between p-6 sm:p-10 lg:p-12 max-w-7xl mx-auto overflow-hidden">
      {/* Texture de fond (décoratif seul — même variante que /signin). */}
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none opacity-80">
        <GridBackground variant="css" showBottomFade={false} />
      </div>
      {/* Topbar : Logo + Badge Utilisateur */}
      <header className="relative flex items-center justify-between w-full">
        <LogoMark variant="bare" className="h-10 shrink-0" />
        {identity && (
          <div className="flex items-center gap-2.5 rounded-full border border-border/60 bg-muted/20 pl-1.5 pr-3.5 py-1">
            {identity.avatarUrl ? (
              <Image
                src={identity.avatarUrl}
                alt={identity.name}
                width={24}
                height={24}
                className="h-6 w-6 rounded-full object-cover"
              />
            ) : (
              <span
                aria-hidden="true"
                className="h-6 w-6 rounded-full bg-[#EA580C] flex items-center justify-center text-white font-bold text-[10px]"
              >
                {identity.name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="text-xs font-normal text-muted-foreground">@{identity.shortId}</span>
          </div>
        )}
      </header>

      {/* Main Content : Split Screen 2 Colonnes */}
      <main className="relative my-auto py-6 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-center">
        {/* Colonne Gauche : Titre et Contexte */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground bg-muted/40 px-3 py-1 rounded-full w-fit border border-border/40">
            {provider === "github" ? (
              <GithubLogoIcon weight="fill" className="w-4 h-4 text-foreground" />
            ) : provider === "google" ? (
              <Image
                src="/logos/google.svg"
                alt=""
                width={16}
                height={16}
                className="w-4 h-4 shrink-0"
              />
            ) : (
              <EnvelopeSimpleIcon weight="fill" className="w-4 h-4 text-foreground" />
            )}
            <span>Connecté via {providerLabel}</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-foreground leading-[1.15]">
            On vérifie et <span className="text-muted-foreground">c&apos;est parti. </span>
          </h1>

          <p className="text-base text-muted-foreground leading-relaxed">
            Vos informations ont été importées depuis {providerLabel}. Confirmez votre nom public
            pour entrer dans la communauté.
          </p>
        </div>

        {/* Colonne Droite : Carte Formulaire Compacte */}
        <div className="lg:col-span-7 border rounded-[8.5px] bg-background border-border/60 p-6 sm:p-8 shadow-sm">
          <form action={action} className="flex flex-col gap-5">
            <input type="hidden" name="next" value={next} />
            <TimeZoneField />

            <InputField
              label="Votre nom public"
              subtitle="Ce nom apparaîtra sur votre profil, les classements et vos contributions."
              placeholder="Ex: Kaliana R."
              name="displayName"
              required
              minLength={2}
              maxLength={50}
              autoComplete="name"
              defaultValue={initial.displayName}
            />

            <div className="flex flex-col gap-1.5">
              <ProfileOccupation defaultValue={initial.occupation} />
              <p className="text-[12px] font-medium text-muted-foreground">
                Optionnel : badge affiché sur votre profil public.
              </p>
            </div>

            {needsEmail && (
              <InputField
                label="Votre email"
                subtitle="Nécessaire pour les notifications et la sécurité."
                placeholder="vous@exemple.com"
                name="email"
                type="email"
                required
                maxLength={254}
                autoComplete="email"
              />
            )}

            {!state.ok && state.message && (
              <p
                role="alert"
                className="text-xs font-bold text-red-600 dark:text-red-400 bg-red-500/10 p-3 rounded-xl border border-red-500/20"
              >
                {state.message}
              </p>
            )}

            {/* Actions Bottom Bar — bouton partagé (design-system). */}
            <div className="pt-3 mt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border/40">
              <Link
                href="/confidentialite"
                className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4 decoration-border"
              >
                Vie privée & Données
              </Link>

              <ActionButton
                variant="primary"
                isFullWidthOnMobile
                actionType="submit"
                disabled={pending}
                className="shrink-0"
              >
                {pending ? <Spinner size="sm" /> : <Check weight="bold" className="w-4 h-4" />}
                {pending ? "Enregistrement…" : "Valider et entrer"}
              </ActionButton>
            </div>
          </form>
        </div>
      </main>

      {/* Footer minimaliste */}
      <footer className="text-xs text-muted-foreground/60 text-center sm:text-left">
        Dernière étape d&apos;inscription.
      </footer>
    </div>
  );
}
