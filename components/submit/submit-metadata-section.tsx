"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { Select } from "@/components/ui/select";
import { InputField } from "@/components/ui/input-field";
import { FieldBadge } from "@/components/ui/field-badge";
import { useSubmitForm } from "@/components/submit/submit-form-context";
import {
  CurrencyCircleDollar,
  Key,
  ShieldCheck,
  ToggleRight,
  ToggleLeft,
} from "@phosphor-icons/react";
import { PLATFORMS } from "@/config/platforms";
import { PRICING_MODELS } from "@/config/pricing";

const OPTION_ICON_CLASS = "w-4 h-4 shrink-0";

// PLATFORMS and PRICING_MODELS are now imported from @/config/platforms and @/config/pricing
// They are mapped inline below with JSX icons at the required size

const DEV_FACING_TYPES = ["cli", "package", "framework", "plugin"];

export function SubmitMetadataSection() {
  const { productType, editApp } = useSubmitForm();
  const isDevFacing = DEV_FACING_TYPES.includes(productType);

  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(editApp?.platforms ?? []);
  const [selectedPricing, setSelectedPricing] = useState(
    PRICING_MODELS.find((o) => o.label === editApp?.pricing)?.id ?? "free",
  );

  // Revenue connection — optional block, engaged via explicit toggle
  const [revenueEnabled, setRevenueEnabled] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<"stripe" | "revenuecat">("stripe");

  // Advanced features
  const [hasAds, setHasAds] = useState(false);
  const [hasThirdParty, setHasThirdParty] = useState(false);

  const togglePlatform = (p: string) => {
    setSelectedPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  };

  const isMonetized = ["freemium", "paid", "subscription"].includes(selectedPricing);

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-black tracking-tight">Détails techniques & modèle</h2>
        <p className="text-[14px] font-medium text-muted-foreground">
          Définissez sur quelles plateformes votre produit fonctionne et comment il est monétisé.
        </p>
      </div>

      {/* ── Platforms ── */}
      <div className="flex flex-col gap-3">
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

      <div className="w-full h-px bg-border/40 my-2" />

      {/* ── Pricing & Tech Metadata ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
        {/* Dropdown Pricing (Shared) */}
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
          <label className="text-[14px] font-bold text-foreground flex items-center gap-2">
            Licence
            <FieldBadge variant="optional" />
          </label>
          <input
            type="text"
            placeholder="ex: MIT, GPL-3.0, Commercial"
            className="w-full bg-muted/30 border-none rounded-2xl px-5 py-4 text-[15px] font-medium placeholder:text-muted-foreground/40 text-foreground outline-none ring-1 ring-inset ring-border/50 focus:ring-2 focus:ring-foreground transition-shadow"
          />
        </div>

        {/* Conditional Revenue Connection */}
        {isMonetized && (
          <div className="md:col-span-2 pt-4 pb-4 flex flex-col gap-6 relative">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-4 mb-1">
                <div className="flex items-center gap-2">
                  <ShieldCheck weight="fill" className="w-5 h-5 text-foreground" />
                  <h3 className="text-sm font-black uppercase tracking-widest text-foreground">
                    Revenus Vérifiés
                  </h3>
                  {revenueEnabled ? (
                    <FieldBadge variant="required" />
                  ) : (
                    <FieldBadge variant="optional" />
                  )}
                </div>
                {/* Explicit toggle — the block is optional, engagement makes the key required */}
                <button
                  type="button"
                  onClick={() => setRevenueEnabled((prev) => !prev)}
                  aria-pressed={revenueEnabled}
                  className={cn(
                    "transition-colors shrink-0",
                    revenueEnabled
                      ? "text-foreground"
                      : "text-muted-foreground/40 hover:text-foreground/60",
                  )}
                >
                  {revenueEnabled ? (
                    <ToggleRight weight="fill" className="w-10 h-10" />
                  ) : (
                    <ToggleLeft weight="duotone" className="w-10 h-10" />
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
                        "object-contain w-8",
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

                {/* API Key Input — required once the block is engaged */}
                <label className="text-[14px] font-bold text-foreground flex items-center gap-2">
                  Clé API en lecture seule
                  <FieldBadge variant="required" />
                </label>
                <div className="relative w-full">
                  <div className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground">
                    <Key weight="bold" className="w-5 h-5" />
                  </div>
                  <input
                    type="password"
                    placeholder={
                      selectedProvider === "stripe"
                        ? "Clé restreinte (ex: rk_live_...)"
                        : "Public API Key (ex: goog_...)"
                    }
                    className="w-full bg-background border-none rounded-2xl pl-12 pr-5 py-4 text-[15px] font-medium placeholder:text-muted-foreground/40 text-foreground outline-none ring-1 ring-inset ring-border/50 focus:ring-2 focus:ring-foreground transition-shadow h-15"
                  />
                </div>

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
          placeholder="ex: npm install malagasy-ui"
          className="font-mono text-[14px]"
        />

        {/* Version */}
        <InputField
          label="Version actuelle"
          isOptional={true}
          defaultValue={editApp?.version ?? ""}
          placeholder="ex: v1.0.4"
        />
      </div>

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
              "text-foreground transition-colors shrink-0",
              hasAds ? "text-foreground" : "text-muted-foreground/40 hover:text-foreground/60",
            )}
          >
            {hasAds ? (
              <ToggleRight weight="fill" className="w-10 h-10" />
            ) : (
              <ToggleLeft weight="duotone" className="w-10 h-10" />
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
              "text-foreground transition-colors shrink-0",
              hasThirdParty
                ? "text-foreground"
                : "text-muted-foreground/40 hover:text-foreground/60",
            )}
          >
            {hasThirdParty ? (
              <ToggleRight weight="fill" className="w-10 h-10" />
            ) : (
              <ToggleLeft weight="duotone" className="w-10 h-10" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
