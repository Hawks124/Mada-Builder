"use client";
import Link from "next/link";
import { AvatarImage } from "@/components/ui/avatar-image";
import {
  SealCheckIcon,
  GlobeIcon,
  AppleLogoIcon,
  CheckCircleIcon,
  XCircleIcon,
  DeviceMobileIcon,
  ShieldCheckIcon,
  TwitterLogoIcon,
  LinkedinLogoIcon,
  GooglePlayLogoIcon,
} from "@phosphor-icons/react";
import { ProductLinks, MOCK_TARSI_LINKS } from "@/components/product/product-links";
import { ShareDialog } from "@/components/product/share-dialog";
import * as React from "react";
import { cn } from "@/lib/utils";
import { getCategoryById } from "@/config/categories";
import { AgeBadge } from "@/components/ui/age-badge";
import { TagPill } from "@/components/ui/tag-pill";
import { LifecyclePill } from "@/components/ui/lifecycle-pill";

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5 border-b border-border/30 last:border-0">
      <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest shrink-0">
        {label}
      </span>
      <div className="text-[12px] text-right font-semibold">{value}</div>
    </div>
  );
}

function IndicatorBadge({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={cn(
        "flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full",
        active
          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
          : "bg-muted/60 text-muted-foreground",
      )}
    >
      {active ? (
        <CheckCircleIcon weight="fill" className="w-3.5 h-3.5" />
      ) : (
        <XCircleIcon weight="fill" className="w-3.5 h-3.5 opacity-40" />
      )}
      {label}
    </span>
  );
}

export function ProductSidebar() {
  const [shareOpen, setShareOpen] = React.useState(false);
  return (
    <div className="flex flex-col gap-6">
      {/* ── PRIMARY ACTION ─────────────────────────────────────────────────
          Blocs liens par type (matrice product-links) — mock Tarsi en
          attendant la DB (milestone listings) : même forme que le submit.
      ─────────────────────────────────────────────────────────────────── */}
      <ProductLinks
        productType="app_mobile"
        links={MOCK_TARSI_LINKS}
        installCommand={null}
        share
        onShare={() => setShareOpen(true)}
        unverifiedCount={1}
      />
      <ShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        productName="Tarsi"
        productLogo={{ initials: "TA", gradient: "from-blue-600 to-indigo-700" }}
        makerName="Bryl Lim"
        makerVerified
        voteCount={311}
      />

      {/* ── MAKER CARD WITH SOCIALS ───────────────────────────────────────── */}
      <div className="flex flex-col gap-4 p-4 rounded-2xl border border-border/40 bg-muted/10 hover:border-border/60 transition-all">
        <div className="flex items-center gap-3">
          <Link href="/makers/bryl" className="shrink-0">
            <AvatarImage
              src="https://i.pravatar.cc/150?u=bryl"
              name="Maker"
              size={44}
              className="hover:scale-105 transition-transform"
            />
          </Link>
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                Créé par
              </span>
              <div className="flex items-center gap-1">
                <a
                  href="https://twitter.com"
                  className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-[#1DA1F2] transition-colors"
                >
                  <TwitterLogoIcon weight="fill" className="w-5 h-5" />
                </a>
                <a
                  href="https://linkedin.com"
                  className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-[#0A66C2] transition-colors"
                >
                  <LinkedinLogoIcon weight="fill" className="w-5 h-5" />
                </a>
              </div>
            </div>
            <Link
              href="/makers/bryl"
              className="font-bold text-foreground flex items-center gap-1 hover:text-primary transition-colors text-[15px]"
            >
              Bryl Lim
              <SealCheckIcon weight="fill" className="text-blue-500 w-4 h-4 shrink-0" />
            </Link>
          </div>
        </div>
        <Link
          href="/makers/bryl"
          className="flex items-center gap-3 justify-center w-full py-2.5 rounded-full bg-background border border-border/50 text-[12px] font-bold hover:bg-foreground hover:text-background hover:border-foreground transition-all duration-200"
        >
          Voir le profil complet
        </Link>
      </div>

      {/* ── METADATA CARD ───────────────────────────────────────────────── */}
      <div className="flex flex-col rounded-2xl border border-border/40 bg-muted/10 overflow-hidden">
        <div className="px-5 py-3 border-b border-border/30">
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            Fiche technique
          </span>
        </div>
        <div className="flex flex-col px-5 py-2">
          <MetaRow
            label="Catégorie"
            value={
              <Link
                href={`/categories/${getCategoryById("finance")!.id}`}
                className={cn(
                  "font-bold transition-colors",
                  getCategoryById("finance")!.chipClass,
                  getCategoryById("finance")!.hoverClass,
                )}
              >
                {getCategoryById("finance")!.name}
              </Link>
            }
          />
          <MetaRow
            label="Statut"
            value={
              <span className="flex justify-end">
                <LifecyclePill lifecycleId="live" />
              </span>
            }
          />
          <MetaRow
            label="Tags"
            value={
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                {["budget", "MGA", "offline"].map((t) => (
                  <TagPill key={t} label={t} />
                ))}
              </div>
            }
          />
          <MetaRow
            label="Type"
            value={
              <span className="text-foreground flex items-center justify-end gap-1">
                <DeviceMobileIcon weight="fill" className="w-3.5 h-3.5 text-muted-foreground" />
                App Mobile
              </span>
            }
          />
          <MetaRow
            label="Modèle"
            value={
              <span className="text-[#B58A43] font-black uppercase tracking-wide text-[10px]">
                Freemium
              </span>
            }
          />
          <MetaRow
            label="Plateformes"
            value={
              <div className="flex items-center gap-2 text-foreground">
                <span title="iOS">
                  <AppleLogoIcon weight="fill" className="w-4 h-4 cursor-help" />
                </span>
                <span title="Google Play">
                  <GooglePlayLogoIcon weight="fill" className="w-4 h-4 cursor-help" />
                </span>
                <span title="Web">
                  <GlobeIcon weight="bold" className="w-4 h-4 cursor-help" />
                </span>
              </div>
            }
          />
          <MetaRow
            label="Lancement"
            value={<span className="text-foreground font-medium">17 Mars 2026</span>}
          />
          <MetaRow
            label="Version"
            value={<span className="text-foreground font-mono text-[11px] font-bold">2.4.1</span>}
          />
          <MetaRow
            label="Changelog"
            value={
              <Link
                href="https://example.com/changelog"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground font-bold hover:underline"
              >
                Notes de version
              </Link>
            }
          />
          <MetaRow
            label="Licence"
            value={
              <span className="flex items-center justify-end gap-1 text-foreground">
                <ShieldCheckIcon weight="fill" className="w-3.5 h-3.5 text-muted-foreground" />
                Propriétaire
              </span>
            }
          />
          <MetaRow
            label="Public"
            value={<span className="text-foreground font-medium">Particuliers (B2C)</span>}
          />
          <MetaRow label="âge" value={<AgeBadge value="4+" size="sm" />} />
        </div>

        {/* Indicators: Ads & IAP */}
        <div className="flex flex-wrap gap-2 px-5 py-3 border-t border-border/30 bg-muted/10">
          <IndicatorBadge active={true} label="Contient des annonces" />
          <IndicatorBadge active={true} label="Achats in-app" />
        </div>
      </div>

      {/* ── PRIVACY / LEGAL ───────────────────────────────────────────────── */}
      <div className="flex flex-row flex-wrap items-center gap-4 px-2">
        <Link
          href="/privacy"
          className="text-[12px] font-semibold text-muted-foreground hover:text-foreground transition-colors underline decoration-border/50 underline-offset-4"
        >
          Privacy Policy
        </Link>
        <Link
          href="/terms"
          className="text-[12px] font-semibold text-muted-foreground hover:text-foreground transition-colors underline decoration-border/50 underline-offset-4"
        >
          Terms of Use
        </Link>
        <button className="text-[12px] font-semibold text-muted-foreground hover:text-red-500 transition-colors underline decoration-border/50 hover:decoration-red-500/50 underline-offset-4 ml-auto cursor-pointer">
          Signaler
        </button>
      </div>
    </div>
  );
}
