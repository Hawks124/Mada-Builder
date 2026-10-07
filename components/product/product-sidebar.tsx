"use client";
import Link from "next/link";
import { AvatarImage } from "@/components/ui/avatar-image";
import {
  SealCheckIcon,
  GlobeIcon,
  AppleLogoIcon,
  CheckCircleIcon,
  XCircleIcon,
  MonitorIcon,
  TerminalIcon,
  ShieldCheckIcon,
  TwitterLogoIcon,
  LinkedinLogoIcon,
  GooglePlayLogoIcon,
} from "@phosphor-icons/react";
import { ProductLinks } from "@/components/product/product-links";
import { ShareDialog } from "@/components/product/share-dialog";
import * as React from "react";
import { cn } from "@/lib/utils";
import { getCategoryById } from "@/config/categories";
import { getProductTypeById } from "@/config/product-types";
import { getRatingById } from "@/config/ratings";
import { PRICING_MODELS } from "@/config/pricing";
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

function IndicatorBadge({ active, label }: { label: string; active: boolean }) {
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

const PLATFORM_ICONS: Record<string, React.ElementType> = {
  web: GlobeIcon,
  ios: AppleLogoIcon,
  macos: AppleLogoIcon,
  android: GooglePlayLogoIcon,
  desktop: MonitorIcon,
  cli: TerminalIcon,
};

export type ProductSidebarData = {
  productId: string;
  slug: string;
  productName: string;
  tagline: string;
  productType: string;
  links: Record<string, string>;
  installCommand?: string | null;
  unverifiedCount: number;
  makerUsername: string;
  makerDisplayName: string;
  makerAvatarUrl: string | null;
  makerWebsiteUrl?: string | null;
  makerSocialLinks?: Record<string, string>;
  categoryId: string;
  lifecycle: "dev" | "beta" | "live";
  tags: string[];
  pricingId: string;
  platforms: string[];
  publishedAt: string;
  version?: string | null;
  changelogUrl?: string | null;
  license?: string | null;
  requirements?: string | null;
  audienceId: string;
  hasAds: boolean;
  hasInAppPurchase: boolean;
  sharesData: boolean;
  targetCountries: string[];
  languagesSupported: string[];
  votes: number;
  initialVoted: boolean;
  iconUrl: string | null;
  initials: string;
  iconGradient: string;
};

function dateFr(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

export function ProductSidebar({ product }: { product: ProductSidebarData }) {
  const [shareOpen, setShareOpen] = React.useState(false);
  const category = getCategoryById(product.categoryId);
  const productType = getProductTypeById(product.productType);
  const rating = getRatingById(product.audienceId);
  const pricingLabel =
    PRICING_MODELS.find((p) => p.id === product.pricingId)?.label ?? product.pricingId;
  const TypeIcon = productType.icon;
  const socials = Object.entries(product.makerSocialLinks ?? {}).filter(
    ([, v]) => typeof v === "string" && v !== "",
  );

  return (
    <div className="flex flex-col gap-6">
      {/* ── PRIMARY ACTION ─────────────────────────────────────────────────
          Blocs liens par type (matrice product-links) — données réelles.
      ─────────────────────────────────────────────────────────────────── */}
      <ProductLinks
        productType={product.productType}
        links={product.links}
        installCommand={product.installCommand ?? null}
        share
        onShare={() => setShareOpen(true)}
        unverifiedCount={product.unverifiedCount}
        productId={product.productId}
        trackOutbound
      />
      <ShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        productName={product.productName}
        productLogo={{
          src: product.iconUrl,
          initials: product.initials,
          gradient: product.iconGradient,
        }}
        makerName={product.makerDisplayName}
        makerVerified
        voteCount={product.votes}
      />

      {/* ── MAKER CARD WITH SOCIALS ───────────────────────────────────────── */}
      <div className="flex flex-col gap-4 p-4 rounded-2xl border border-border/40 bg-muted/10 hover:border-border/60 transition-all">
        <div className="flex items-center gap-3">
          <Link href={`/makers/${product.makerUsername}`} className="shrink-0">
            <AvatarImage
              src={product.makerAvatarUrl}
              name={product.makerDisplayName}
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
                {socials
                  .filter(([k]) => k === "twitter" || k === "x")
                  .map(([k, v]) => (
                    <a
                      key={k}
                      href={v as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-[#1DA1F2] transition-colors"
                      aria-label="Twitter / X du maker"
                    >
                      <TwitterLogoIcon weight="fill" className="w-5 h-5" />
                    </a>
                  ))}
                {socials
                  .filter(([k]) => k === "linkedin")
                  .map(([k, v]) => (
                    <a
                      key={k}
                      href={v as string}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-[#0A66C2] transition-colors"
                      aria-label="LinkedIn du maker"
                    >
                      <LinkedinLogoIcon weight="fill" className="w-5 h-5" />
                    </a>
                  ))}
              </div>
            </div>
            <Link
              href={`/makers/${product.makerUsername}`}
              className="font-bold text-foreground flex items-center gap-1 hover:text-primary transition-colors text-[15px]"
            >
              {product.makerDisplayName}
              <SealCheckIcon weight="fill" className="text-blue-500 w-4 h-4 shrink-0" />
            </Link>
          </div>
        </div>
        <Link
          href={`/makers/${product.makerUsername}`}
          className="flex items-center gap-3 justify-center w-full py-2.5 rounded-full bg-background border border-border/50 text-[12px] font-bold hover:bg-foreground hover:text-background hover:border-foreground transition-all duration-200"
        >
          Voir le profil complet
        </Link>
      </div>

      {/* ── METADATA CARD (tableau fiche technique) ───────────────────────── */}
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
              category ? (
                <Link
                  href={`/categories/${category.id}`}
                  className={cn(
                    "font-bold transition-colors",
                    category.chipClass,
                    category.hoverClass,
                  )}
                >
                  {category.name}
                </Link>
              ) : (
                <span className="text-muted-foreground/70">Non classé</span>
              )
            }
          />
          <MetaRow
            label="Statut"
            value={
              <span className="flex justify-end">
                <LifecyclePill lifecycleId={product.lifecycle} />
              </span>
            }
          />
          {product.tags.length > 0 && (
            <MetaRow
              label="Tags"
              value={
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  {product.tags.map((t) => (
                    <TagPill key={t} label={t} />
                  ))}
                </div>
              }
            />
          )}
          <MetaRow
            label="Type"
            value={
              <span className="text-foreground flex items-center justify-end gap-1">
                <TypeIcon weight="fill" className="w-3.5 h-3.5 text-muted-foreground" />
                {productType.label}
              </span>
            }
          />
          <MetaRow
            label="Modèle"
            value={
              <span className="text-[#B58A43] font-black uppercase tracking-wide text-[10px]">
                {pricingLabel}
              </span>
            }
          />
          {product.platforms.length > 0 && (
            <MetaRow
              label="Plateformes"
              value={
                <div className="flex items-center gap-2 text-foreground justify-end">
                  {product.platforms.map((id) => {
                    const Icon = PLATFORM_ICONS[id] ?? GlobeIcon;
                    return (
                      <span key={id} title={id}>
                        <Icon weight="fill" className="w-4 h-4 cursor-help" />
                      </span>
                    );
                  })}
                </div>
              }
            />
          )}
          <MetaRow
            label="Lancement"
            value={
              <span className="text-foreground font-medium">{dateFr(product.publishedAt)}</span>
            }
          />
          {product.version ? (
            <MetaRow
              label="Version"
              value={
                <span className="text-foreground font-mono text-[11px] font-bold">
                  {product.version}
                </span>
              }
            />
          ) : null}
          {product.changelogUrl ? (
            <MetaRow
              label="Changelog"
              value={
                <Link
                  href={product.changelogUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground font-bold hover:underline"
                >
                  Notes de version
                </Link>
              }
            />
          ) : null}
          {product.requirements ? (
            <MetaRow
              label="Configuration requise"
              value={
                <span className="text-foreground font-medium whitespace-pre-line">
                  {product.requirements}
                </span>
              }
            />
          ) : null}
          {product.license ? (
            <MetaRow
              label="Licence"
              value={
                <span className="flex items-center justify-end gap-1 text-foreground">
                  <ShieldCheckIcon weight="fill" className="w-3.5 h-3.5 text-muted-foreground" />
                  {product.license}
                </span>
              }
            />
          ) : null}
          <MetaRow
            label="Public"
            value={<span className="text-foreground font-medium">{rating.label}</span>}
          />
          <MetaRow label="Âge" value={<AgeBadge value={rating.badge} size="sm" />} />
          {product.targetCountries.length > 0 && (
            <MetaRow
              label="Pays cibles"
              value={
                <span className="text-foreground font-medium">
                  {product.targetCountries.join(", ")}
                </span>
              }
            />
          )}
          {product.languagesSupported.length > 0 && (
            <MetaRow
              label="Langues"
              value={
                <span className="text-foreground font-medium">
                  {product.languagesSupported.join(", ")}
                </span>
              }
            />
          )}
        </div>

        {/* Indicators: Ads, IAP & partage (états réels, jamais inventés) */}
        <div className="flex flex-wrap gap-2 px-5 py-3 border-t border-border/30 bg-muted/10">
          <IndicatorBadge active={product.hasAds} label="Contient des annonces" />
          <IndicatorBadge active={product.hasInAppPurchase} label="Achats in-app" />
          <IndicatorBadge active={product.sharesData} label="Partage de données" />
        </div>
      </div>

      {/* ── PRIVACY / LEGAL ───────────────────────────────────────────────── */}
      <div className="flex flex-row flex-wrap items-center gap-4 px-2">
        {product.links.privacy ? (
          <Link
            href={product.links.privacy}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] font-semibold text-muted-foreground hover:text-foreground transition-colors underline decoration-border/50 underline-offset-4"
          >
            Privacy Policy
          </Link>
        ) : null}
        {product.links.tos ? (
          <Link
            href={product.links.tos}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] font-semibold text-muted-foreground hover:text-foreground transition-colors underline decoration-border/50 underline-offset-4"
          >
            Terms of Use
          </Link>
        ) : null}
        <button className="text-[12px] font-semibold text-muted-foreground hover:text-red-500 transition-colors underline decoration-border/50 hover:decoration-red-500/50 underline-offset-4 ml-auto cursor-pointer">
          Signaler
        </button>
      </div>
    </div>
  );
}
