"use client";

import * as React from "react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { Select } from "@/components/ui/select";
import { InputField } from "@/components/ui/input-field";
import { ChangelogField } from "@/components/submit/changelog-field";
import { LicenseImporter } from "@/components/submit/license-importer";
import { FieldBadge } from "@/components/ui/field-badge";
import { useSubmitForm, draftJsonList } from "@/components/submit/submit-form-context";
import {
  CurrencyCircleDollar,
  Key,
  ShieldCheck,
  ToggleRightIcon,
  ToggleLeftIcon,
} from "@phosphor-icons/react";
import { PLATFORMS, PLATFORMS_BY_TYPE } from "@/config/platforms";
import { PRICING_MODELS, isMonetizedPricing } from "@/config/pricing";

const OPTION_ICON_CLASS = "w-4 h-4 shrink-0";

// PLATFORMS and PRICING_MODELS are now imported from @/config/platforms and @/config/pricing
// They are mapped inline below with JSX icons at the required size

const DEV_FACING_TYPES = ["cli", "package", "framework", "plugin"];

export function SubmitMetadataSection() {
  const {
    productType,
    editApp,
    pricing: selectedPricing,
    setPricing: setSelectedPricing,
    errors,
    clearError,
    draft,
  } = useSubmitForm();
  const isDevFacing = DEV_FACING_TYPES.includes(productType);

  // Suggestion par type : dérivée au rendu (pas d'effect) — suit le type
  // tant que l'utilisateur n'a rien coché/décoché (null = suggestion).
  // En édition : valeurs existantes, jamais écrasées par la suggestion.
  const suggestedPlatforms = !editApp ? (PLATFORMS_BY_TYPE[productType] ?? []) : [];
  const [manualPlatforms, setManualPlatforms] = useState<string[] | null>(() => {
    if (editApp) return editApp.platforms ?? [];
    // Brouillon sans plateformes = suggestion par type (pas d'écrasement).
    if (draft && "platforms" in draft) return draftJsonList(draft, "platforms");
    return null;
  });
  // Import licence (SPDX-only) : l'identifiant détecté remonte le champ
  // (remount par clé — InputField uncontrolled).
  const [licenseDraft, setLicenseDraft] = useState<string | null>(null);
  const selectedPlatforms = manualPlatforms ?? suggestedPlatforms;

  const togglePlatform = (p: string) => {
    clearError("platforms");
    setManualPlatforms((prev) => {
      const base = prev ?? suggestedPlatforms;
      return base.includes(p) ? base.filter((x) => x !== p) : [...base, p];
    });
  };

  // Revenue connection — affiché, pas encore collecté (lot MRR) : le
  // champ clé est DÉSACTIVÉ avec mention explicite (jamais de secret
  // collecté sans backend — cf. review phases 1+2, M4).
  const [revenueEnabled, setRevenueEnabled] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<"stripe" | "revenuecat">("stripe");

  // Advanced features
  const [hasAds, setHasAds] = useState(editApp?.hasAds ?? false);
  const [hasThirdParty, setHasThirdParty] = useState(editApp?.hasThirdParty ?? false);

  const isMonetized = isMonetizedPricing(selectedPricing);

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-black tracking-tight">Détails techniques & modèle</h2>
        <p className="text-[14px] font-medium text-muted-foreground">
          Définissez sur quelles plateformes votre produit fonctionne et comment il est monétisé.
        </p>
      </div>

      {/* ── Platforms ── */}
      <div className="flex flex-col gap-3 scroll-mt-24" data-field-anchor="platforms" tabIndex={-1}>
        <label className="text-[14px] font-bold text-foreground flex items-center gap-2">
          Plateformes supportées
          <FieldBadge variant="required" />
        </label>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((platform) => {
            const PlatformIcon = platform.icon;
            const isSelected = selectedPlatforms.includes(platform.id);
            return (
              <button
                key={platform.id}
                type="button"
                onClick={() => togglePlatform(platform.id)}
                className={cn(
                  "px-4 py-2.5 rounded-full text-[13px] font-bold transition-all cursor-pointer flex items-center gap-2",
                  isSelected
                    ? "bg-foreground text-background shadow-md border border-transparent"
                    : "bg-muted/30 text-muted-foreground border border-border/40 hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <PlatformIcon weight="fill" className="w-4 h-4" />
                {platform.label}
              </button>
            );
          })}
        </div>
      </div>
      {errors["platforms"] && (
        <p role="alert" className="text-[12px] font-bold text-red-600 dark:text-red-400">
          {errors["platforms"]}
        </p>
      )}

      <div className="w-full h-px bg-border/40 my-2" />

      {/* ── Pricing & Tech Metadata ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
        {/* Dropdown Pricing (Shared) */}
        <input type="hidden" name="platforms" value={JSON.stringify(selectedPlatforms)} />
        <div className="flex flex-col gap-2 relative z-20">
          <label className="text-[14px] font-bold text-foreground flex items-center gap-2">
            Modèle économique
            <FieldBadge variant="required" />
          </label>
          <Select
            value={selectedPricing}
            onChange={setSelectedPricing}
            options={PRICING_MODELS.map((m) => {
              const Ico = m.icon;
              return {
                id: m.id,
                label: m.label,
                icon: <Ico weight="fill" className={OPTION_ICON_CLASS} />,
              };
            })}
            icon={
              <CurrencyCircleDollar
                weight="fill"
                className="w-5 h-5 text-muted-foreground/60 transition-colors"
              />
            }
          />
        </div>

        {/* License */}
        <div className="flex flex-col gap-2 relative z-10">
          <InputField
            label="Licence"
            isOptional={true}
            key={licenseDraft ?? "license-orig"}
            defaultValue={licenseDraft ?? draft?.license ?? editApp?.license ?? ""}
            placeholder="ex: MIT, GPL-3.0, Commercial"
            name="license"
            maxLength={60}
            showCount
            errorKey="license"
          />
          <LicenseImporter onApply={(id) => setLicenseDraft(id)} />
        </div>

        {/* Conditional Revenue Connection — visible mais non collecté :
            saisie désactivée jusqu'au lot revenus vérifiés (MRR). */}
        {isMonetized && (
          <div className="md:col-span-2 pt-4 pb-4 flex flex-col gap-6 relative">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-4 mb-1">
                <div className="flex items-center gap-2">
                  <ShieldCheck weight="fill" className="w-5 h-5 text-foreground" />
                  <h3 className="text-sm font-black uppercase tracking-widest text-foreground">
                    Revenus Vérifiés
                  </h3>
                  <FieldBadge variant="optional" />
                  <span className="px-2 py-0.5 rounded-md bg-muted text-[11px] font-black tracking-widest text-muted-foreground uppercase">
                    Bientôt
                  </span>
                </div>
                {/* Explicit toggle — the block is optional, engagement makes the key required */}
                <button
                  type="button"
                  onClick={() => setRevenueEnabled((prev) => !prev)}
                  aria-pressed={revenueEnabled}
                  className={cn(
                    "transition-colors shrink-0 cursor-pointer",
                    revenueEnabled
                      ? "text-foreground"
                      : "text-muted-foreground/40 hover:text-foreground/60",
                  )}
                >
                  {revenueEnabled ? (
                    <ToggleRightIcon weight="fill" className="w-10 h-10" />
                  ) : (
                    <ToggleLeftIcon weight="duotone" className="w-10 h-10" />
                  )}
                </button>
              </div>
              <p className="text-[14px] font-medium text-muted-foreground max-w-xl">
                Connectez une clé API en <strong>lecture seule</strong> pour prouver publiquement
                vos revenus et gagner en crédibilité.
              </p>
            </div>

            {revenueEnabled && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedProvider("stripe")}
                    className={cn(
                      "px-5 py-2.5 rounded-full text-[13px] font-bold transition-all cursor-pointer flex items-center gap-2.5",
                      selectedProvider === "stripe"
                        ? "bg-foreground text-background shadow-md border border-transparent"
                        : "bg-background text-foreground border border-border hover:bg-muted/60",
                    )}
                  >
                    <Image
                      src="/logos/stripe.svg"
                      alt="Stripe"
                      width={24}
                      height={12}
                      className={cn(
                        "object-contain w-8 h-auto",
                        selectedProvider === "stripe" && "brightness-0 invert",
                      )}
                    />
                    Stripe
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedProvider("revenuecat")}
                    className={cn(
                      "px-5 py-2.5 rounded-full text-[13px] font-bold transition-all cursor-pointer flex items-center gap-2",
                      selectedProvider === "revenuecat"
                        ? "bg-foreground text-background shadow-md border border-transparent"
                        : "bg-background text-foreground border border-border hover:bg-muted/60",
                    )}
                  >
                    <Image
                      src="/logos/revenuecat.svg"
                      alt="RevenueCat"
                      width={18}
                      height={18}
                      className={cn(
                        "w-5.5 h-5.5 object-contain rounded-full overflow-hidden",
                        selectedProvider === "revenuecat" && "brightness-0 invert",
                      )}
                    />
                    RevenueCat
                  </button>
                </div>

                {/* API Key Input — désactivé jusqu'au lot MRR : aucune clé
                    collectée (ni name ni envoi), mention explicite. */}
                <label className="text-[14px] font-bold text-foreground flex items-center gap-2">
                  Clé API en lecture seule
                  <FieldBadge variant="optional" />
                </label>
                <div className="relative w-full">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <Key weight="bold" className="w-5 h-5" />
                  </div>
                  <input
                    type="password"
                    disabled
                    placeholder="Bientôt disponible — aucune clé collectée pour l'instant"
                    aria-describedby="revenue-coming"
                    className="w-full bg-background border-none rounded-2xl pl-12 pr-5 py-4 text-[15px] font-medium placeholder:text-muted-foreground/40 text-foreground outline-none ring-1 ring-inset ring-border/50 transition-shadow h-15 disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>
                <p
                  id="revenue-coming"
                  className="text-[12px] font-medium text-muted-foreground leading-relaxed"
                >
                  La connexion des revenus arrive avec le lot dédié (clés chiffrées, badge vérifié).
                  Votre clé ne vous sera demandée qu&apos;à ce moment-là.
                </p>

                {/* Security trust block — inline at the moment of entry */}
                <div className="grid grid-cols-2 gap-3 mt-1">
                  {[
                    {
                      icon: <ShieldCheck weight="fill" className="w-4 h-4 text-emerald-600" />,
                      label: "Chiffrement AES-256",
                    },
                    {
                      icon: <Key weight="bold" className="w-4 h-4 text-emerald-600" />,
                      label: "Lecture seule uniquement",
                    },
                    {
                      icon: <ShieldCheck weight="duotone" className="w-4 h-4 text-emerald-600" />,
                      label: "Aucune donnée client",
                    },
                    {
                      icon: <Key weight="duotone" className="w-4 h-4 text-emerald-600" />,
                      label: "Révocable à tout moment",
                    },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      {item.icon}
                      <span className="text-[12px] font-medium text-muted-foreground">
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] font-medium text-muted-foreground/60 leading-relaxed mt-1">
                  Sur Stripe : créez une clé restreinte avec la permission{" "}
                  <span className="font-mono bg-muted/50 px-1 rounded">
                    Lire les charges &amp; abonnements
                  </span>{" "}
                  uniquement. Votre clé est chiffrée dès réception et jamais partagée.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Install Command — required for dev-facing product types */}
        <InputField
          label="Commande d'installation"
          subtitle={
            isDevFacing
              ? "Requise pour ce type de produit : comment l'installer ?"
              : "Pour les packages ou outils CLI."
          }
          isRequired={isDevFacing}
          isOptional={!isDevFacing}
          defaultValue={draft?.installCommand ?? editApp?.installCommand ?? ""}
          placeholder="ex: npm install malagasy-ui"
          className="font-mono text-[14px]"
          name="installCommand"
          maxLength={200}
          showCount
          errorKey="installCommand"
        />

        {/* Version */}
        <InputField
          label="Version actuelle"
          isOptional={true}
          defaultValue={draft?.version ?? editApp?.version ?? ""}
          placeholder="ex: v1.0.4"
          name="version"
          maxLength={20}
          showCount
          errorKey="version"
        />
      </div>

      {/* ── Configuration requise + Changelog (game/desktop/os, optionnel) ── */}
      {(productType === "game" || productType === "app_desktop" || productType === "os") && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          <InputField
            label="Configuration requise"
            subtitle={
              productType === "game"
                ? "Un jeu sans config fait amateur : OS, RAM, stockage."
                : productType === "os"
                  ? "Sur quoi tourne le système : architecture, RAM, stockage."
                  : "Sur quoi tourne le logiciel : OS, RAM, stockage."
            }
            isOptional={true}
            defaultValue={draft?.requirements ?? editApp?.requirements ?? ""}
            placeholder="ex : Windows 10, 8 Go RAM, 500 Mo"
            name="requirements"
            maxLength={500}
            showCount
            errorKey="requirements"
          />
          <ChangelogField defaultValue={draft?.changelogUrl ?? editApp?.changelogUrl ?? ""} />
        </div>
      )}

      {/* ── Advanced Toggles ── */}
      <div className="w-full h-px bg-border/40 mt-4 mb-2" />

      <div className="flex flex-col gap-1 mb-2">
        <h2 className="text-2xl font-black tracking-tight">Transparence & Privacy</h2>
        <p className="text-[14px] font-medium text-muted-foreground">
          Informez vos utilisateurs des éléments tiers inclus dans votre produit.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div
          onClick={() => setHasAds(!hasAds)}
          className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-border/40 bg-background hover:border-foreground/20 hover:shadow-sm transition-all cursor-pointer text-left group"
        >
          <div className="flex flex-col gap-1">
            <span className="text-[14px] font-bold text-foreground">Publicités (Ads)</span>
            <span className="text-[12px] font-medium text-muted-foreground group-hover:text-foreground/70 transition-colors">
              Ce produit affiche des bannières ou vidéos promotionnelles.
            </span>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setHasAds(!hasAds);
            }}
            className={cn(
              "text-foreground transition-colors shrink-0 cursor-pointer",
              hasAds ? "text-foreground" : "text-muted-foreground/40 hover:text-foreground/60",
            )}
          >
            {hasAds ? (
              <ToggleRightIcon weight="fill" className="w-10 h-10 cursor-pointer" />
            ) : (
              <ToggleLeftIcon weight="duotone" className="w-10 h-10" />
            )}
          </button>
        </div>

        <div
          onClick={() => setHasThirdParty(!hasThirdParty)}
          className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-border/40 bg-background hover:border-foreground/20 hover:shadow-sm transition-all cursor-pointer text-left group"
        >
          <div className="flex flex-col gap-1">
            <span className="text-[14px] font-bold text-foreground">Partage de données</span>
            <span className="text-[12px] font-medium text-muted-foreground group-hover:text-foreground/70 transition-colors">
              Ce produit partage des données via des partenaires tiers (Ads, Analytics).
            </span>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setHasThirdParty(!hasThirdParty);
            }}
            className={cn(
              "text-foreground transition-colors shrink-0 cursor-pointer",
              hasThirdParty
                ? "text-foreground"
                : "text-muted-foreground/40 hover:text-foreground/60",
            )}
          >
            {hasThirdParty ? (
              <ToggleRightIcon weight="fill" className="w-10 h-10" />
            ) : (
              <ToggleLeftIcon weight="duotone" className="w-10 h-10" />
            )}
          </button>
        </div>
        <input type="hidden" name="hasAds" value={hasAds ? "true" : "false"} />
        <input type="hidden" name="hasThirdParty" value={hasThirdParty ? "true" : "false"} />
      </div>
    </div>
  );
}
