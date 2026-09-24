import type { Metadata } from "next";
import Link from "next/link";
import { AvatarImage } from "@/components/ui/avatar-image";
import { notFound } from "next/navigation";
import {
  GlobeIcon,
  AppleLogoIcon,
  GooglePlayLogoIcon,
  GithubLogoIcon,
  ShieldCheckIcon,
  FileTextIcon,
  HourglassIcon,
  CheckIcon,
  MinusIcon,
  ImageSquareIcon,
  ArrowSquareOutIcon,
  SealCheckIcon,
  MonitorIcon,
  TerminalIcon,
} from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";
import { getCategoryById } from "@/config/categories";
import { getRatingById } from "@/config/ratings";
import { getProductTypeById } from "@/config/product-types";
import { LifecyclePill } from "@/components/ui/lifecycle-pill";
import { AgeBadge } from "@/components/ui/age-badge";
import { TagPill } from "@/components/ui/tag-pill";
import { ReviewVerdict } from "@/components/admin/review-verdict";
import { MOCK_REVIEW_QUEUE } from "@/components/admin/admin-mock";
import { formatCompactAr } from "@/components/dashboard/dashboard-mock";

// noindex strict — jamais indexé, même au backend.
export const metadata: Metadata = {
  title: "Admin — Vérifier",
  robots: { index: false, follow: false },
};

const LINK_ICONS = {
  globe: GlobeIcon,
  apple: AppleLogoIcon,
  play: GooglePlayLogoIcon,
  github: GithubLogoIcon,
  shield: ShieldCheckIcon,
  file: FileTextIcon,
} as const;

/** Les 6 slots du form — toujours rendus (fourni vs Non fourni). */
const LINK_SLOTS = [
  { icon: "globe", label: "Site web officiel" },
  { icon: "apple", label: "Apple App Store" },
  { icon: "play", label: "Google Play Store" },
  { icon: "github", label: "GitHub (Open Source)" },
  { icon: "shield", label: "Politique de confidentialité" },
  { icon: "file", label: "Conditions d'utilisation (ToS)" },
] as const;

const SLA_HOURS = 24;

// Cockpit de verdict (§9) — SEUL endroit où l'approbation existe.
// Preuves à gauche, checklist auto + verdict sticky à droite.
// Gate staff au layout (admin). Reste (milestone listings) :
// approveProduct/rejectProduct + email.
export default async function AdminReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = MOCK_REVIEW_QUEUE.find((q) => q.id === id);
  if (!item) notFound();

  const categories = item.categoryIds
    .map((id) => getCategoryById(id))
    .filter((c) => c !== undefined);
  const rating = getRatingById(item.audienceId);
  const productType = getProductTypeById(item.productTypeId);
  const exceeded = item.waitingHours > SLA_HOURS;

  const requiredFields = [
    "Nom",
    "Tagline",
    "Type",
    "Avancement",
    "Audience",
    "Description",
    "Catégorie",
    "Site web",
    "Plateformes",
    "Modèle",
    "Logo",
  ];
  const optionalFields: { label: string; filled: boolean }[] = [
    { label: "Version", filled: !!item.version },
    {
      label: `Captures d'écran (${item.screenshots})`,
      filled: item.screenshots > 0,
    },
    { label: "Revenus vérifiés", filled: !!item.revenue },
    { label: "Licence", filled: !!item.license },
    { label: "Commande d'installation", filled: !!item.installCommand },
  ];

  return (
    <div className="w-full px-6 lg:px-12 pt-10 lg:pt-14 pb-24 flex flex-col gap-10">
      {/* Header identité */}
      <div className="flex items-start gap-5">
        <div
          className={cn(
            "w-20 h-20 rounded-3xl shrink-0 flex items-center justify-center text-white font-black text-2xl bg-linear-to-br shadow-md",
            item.iconGradient,
          )}
        >
          {item.initials}
        </div>
        <div className="flex flex-col gap-2 min-w-0">
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-foreground leading-none">
            {item.productName}
          </h1>
          <p className="text-[15px] font-medium text-muted-foreground">
            par{" "}
            <Link
              href={`/makers/${item.makerUsername}`}
              className="font-bold text-foreground/80 hover:text-foreground transition-colors"
            >
              {item.makerName}
            </Link>
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/categories/${category.id}`}
                className={cn(
                  "inline-flex items-center rounded border px-1.5 py-px text-[9px] font-black uppercase tracking-[0.14em] leading-none transition-colors",
                  category.chipClass,
                  category.hoverClass,
                )}
              >
                {category.name}
              </Link>
            ))}
            <LifecyclePill lifecycleId={item.lifecycle} />
            <AgeBadge value={rating.badge} size="xs" />
            <span className="flex items-center gap-1.5 text-[12px] font-bold text-muted-foreground">
              <HourglassIcon
                weight="fill"
                className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400"
              />
              {item.waitingText}
            </span>
            {exceeded && (
              <span className="inline-flex items-center rounded-md border border-red-500/25 bg-red-500/10 px-1.5 py-[3px] text-[9px] font-black uppercase tracking-[0.14em] leading-none text-red-600 dark:text-red-400 shrink-0">
                Dépassé
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Colonne preuve */}
        <div className="lg:col-span-8 flex flex-col gap-10 min-w-0">
          <ProofSection title="Liens — tous cliquables">
            <div className="flex flex-col">
              {LINK_SLOTS.map((slot) => {
                const Icon = LINK_ICONS[slot.icon];
                const link = item.links.find((l) => l.icon === slot.icon);
                if (!link) {
                  return (
                    <div
                      key={slot.icon}
                      className="flex items-center gap-3 rounded-2xl px-4 py-3 -mx-4 opacity-60"
                    >
                      <span className="h-9 w-9 rounded-xl bg-muted/40 border border-border/40 flex items-center justify-center shrink-0 text-muted-foreground/50">
                        <Icon weight="fill" className="w-4 h-4" />
                      </span>
                      <span className="flex flex-col min-w-0 flex-1">
                        <span className="text-[14px] font-bold text-muted-foreground">
                          {slot.label}
                        </span>
                        <span className="text-[12px] font-medium text-muted-foreground/60">
                          Non fourni
                        </span>
                      </span>
                    </div>
                  );
                }
                return (
                  <Link
                    key={slot.icon}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-3 rounded-2xl px-4 py-3 -mx-4 hover:bg-muted/50 transition-colors"
                  >
                    <span className="h-9 w-9 rounded-xl bg-muted/40 border border-border/40 flex items-center justify-center shrink-0 text-muted-foreground group-hover:text-foreground transition-colors">
                      <Icon weight="fill" className="w-4 h-4" />
                    </span>
                    <span className="flex flex-col min-w-0 flex-1">
                      <span className="text-[14px] font-bold text-foreground">{slot.label}</span>
                      <span className="text-[12px] font-medium text-muted-foreground truncate">
                        {link.href}
                      </span>
                    </span>
                    <ArrowSquareOutIcon
                      weight="bold"
                      className="w-4 h-4 text-muted-foreground/60 group-hover:text-foreground transition-colors shrink-0"
                    />
                  </Link>
                );
              })}
              {/* URL sécu enfants — requise si audience kids */}
              {item.audienceId === "kids" && (
                <div className="flex flex-col gap-1 rounded-2xl px-4 py-3 -mx-4">
                  {item.kidsPolicyUrl ? (
                    <Link
                      href={item.kidsPolicyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-3"
                    >
                      <span className="h-9 w-9 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center shrink-0 text-amber-600 dark:text-amber-400">
                        <ShieldCheckIcon weight="fill" className="w-4 h-4" />
                      </span>
                      <span className="flex flex-col min-w-0 flex-1">
                        <span className="text-[14px] font-bold text-foreground">
                          Politique de sécurité enfants{" "}
                          <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
                            requis
                          </span>
                        </span>
                        <span className="text-[12px] font-medium text-muted-foreground truncate">
                          {item.kidsPolicyUrl}
                        </span>
                      </span>
                      <ArrowSquareOutIcon
                        weight="bold"
                        className="w-4 h-4 text-muted-foreground/60 group-hover:text-foreground transition-colors shrink-0"
                      />
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="h-9 w-9 rounded-xl bg-red-500/10 border border-red-500/25 flex items-center justify-center shrink-0 text-red-500">
                        <ShieldCheckIcon weight="fill" className="w-4 h-4" />
                      </span>
                      <span className="flex flex-col min-w-0 flex-1">
                        <span className="text-[14px] font-bold text-red-600 dark:text-red-400">
                          Politique de sécurité enfants — manquante
                        </span>
                        <span className="text-[12px] font-medium text-muted-foreground/70">
                          Requise pour l&apos;audience -13 ans (store compliance)
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </ProofSection>

          <ProofSection title="Fiche">
            <p className="text-[15px] font-medium text-foreground leading-relaxed">
              {item.tagline}
            </p>
            <p className="text-[14px] font-medium text-muted-foreground leading-relaxed">
              {item.description}
            </p>
            <div className="flex items-center gap-1.5 flex-wrap">
              {item.tags.map((t) => (
                <TagPill key={t} label={t} />
              ))}
            </div>
            <div className="flex items-center gap-x-5 gap-y-2 flex-wrap text-[13px] font-semibold text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <productType.icon weight="fill" className="w-4 h-4" aria-hidden="true" />
                {productType.label}
              </span>
              <span>{item.pricing}</span>
              {item.version && <span className="font-mono text-[12px]">{item.version}</span>}
              <span className="flex items-center gap-1.5">
                {item.platforms.map((p) => (
                  <PlatformIcon key={p} id={p} />
                ))}
              </span>
            </div>
          </ProofSection>

          <ProofSection title="Détails techniques">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
              <TechRow
                label="Licence"
                value={item.license ?? "Non fournie"}
                muted={!item.license}
              />
              <TechRow
                label="Commande d'installation"
                value={item.installCommand ?? "Non fournie"}
                muted={!item.installCommand}
                mono
              />
              <TechRow
                label="Publicités"
                value={item.hasAds ? "Oui — bannières/vidéos" : "Non"}
                muted={!item.hasAds}
              />
              <TechRow
                label="Partage de données"
                value={item.sharesData ? "Oui — tiers (Ads, Analytics)" : "Non"}
                muted={!item.sharesData}
              />
            </div>
          </ProofSection>

          <ProofSection title="Médias">
            {item.screenshots > 0 ? (
              <div className="grid grid-cols-3 gap-3">
                {Array.from({ length: item.screenshots }).map((_, i) => (
                  <div
                    key={i}
                    className="aspect-video rounded-2xl bg-muted/40 border border-border/40 flex flex-col items-center justify-center gap-1.5 text-muted-foreground"
                  >
                    <ImageSquareIcon weight="duotone" className="w-6 h-6" aria-hidden="true" />
                    <span className="text-[11px] font-bold">Capture {i + 1}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-border/40 px-5 py-8 text-center text-[13px] font-medium text-muted-foreground">
                Aucune capture fournie
              </div>
            )}
          </ProofSection>

          <ProofSection title="Remplissage">
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground mb-2">
                  Requis — toujours complets
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {requiredFields.map((f) => (
                    <span
                      key={f}
                      className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400"
                    >
                      <CheckIcon weight="bold" className="w-3 h-3" />
                      {f}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground mb-2">
                  Optionnels — au cas par cas
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {optionalFields.map((f) =>
                    f.filled ? (
                      <span
                        key={f.label}
                        className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400"
                      >
                        <CheckIcon weight="bold" className="w-3 h-3" />
                        {f.label}
                      </span>
                    ) : (
                      <span
                        key={f.label}
                        className="inline-flex items-center gap-1 rounded-full bg-muted/40 border border-border/40 px-2.5 py-1 text-[11px] font-bold text-muted-foreground"
                      >
                        <MinusIcon weight="bold" className="w-3 h-3" />
                        {f.label}
                      </span>
                    ),
                  )}
                </div>
              </div>
            </div>
          </ProofSection>

          {item.revenue && (
            <ProofSection title="Revenus">
              <div className="flex items-center gap-3">
                <SealCheckIcon weight="fill" className="w-5 h-5 text-emerald-500 shrink-0" />
                <p className="text-[14px] font-medium text-muted-foreground">
                  Clé connectée —{" "}
                  <span className="font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {formatCompactAr(item.revenue.mrrAr)}
                  </span>{" "}
                  via {item.revenue.provider === "stripe" ? "Stripe" : "RevenueCat"}
                </p>
              </div>
            </ProofSection>
          )}
        </div>

        {/* Rail sticky — mini maker + checklist + verdict */}
        <div className="lg:col-span-4 flex flex-col gap-6 lg:sticky lg:top-8">
          <div className="flex items-center gap-3 rounded-2xl border border-border/40 bg-muted/20 px-4 py-3">
            <AvatarImage src={item.makerAvatar} name={item.makerName} size={40} />
            <div className="flex flex-col min-w-0 flex-1">
              <Link
                href={`/makers/${item.makerUsername}`}
                className="text-[14px] font-bold text-foreground hover:text-primary transition-colors truncate w-fit"
              >
                {item.makerName}
              </Link>
              <span className="text-[12px] font-medium text-muted-foreground">
                {item.makerLiveCount} produit
                {item.makerLiveCount > 1 ? "s" : ""} · {item.makerBans} ban
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">
              Checklist §9 — auto
            </h2>
            <div className="flex flex-col gap-2">
              <ChecklistRow
                ok={item.links.some((l) => l.icon === "globe")}
                label="Réel et joignable — site fourni"
              />
              <ChecklistRow ok={true} label="Niche & région — catégorie OK" />
              <ChecklistRow ok={true} label="Pas de spam — aucun doublon" />
              <ChecklistRow
                ok={item.links.length >= 2}
                label={`${item.links.length} liens à vérifier`}
              />
              <ChecklistRow ok={true} label="Icône exploitable — 256px+" />
            </div>
          </div>

          <div className="w-full h-px bg-border/40" />

          <ReviewVerdict productName={item.productName} />

          <Link
            href="/admin/review"
            className="text-[13px] font-bold text-muted-foreground hover:text-foreground transition-colors w-fit"
          >
            ← Retour à la file
          </Link>
        </div>
      </div>
    </div>
  );
}

const PLATFORM_ICONS = {
  web: GlobeIcon,
  ios: AppleLogoIcon,
  android: GooglePlayLogoIcon,
  macos: AppleLogoIcon,
  desktop: MonitorIcon,
  cli: TerminalIcon,
} as const;

function PlatformIcon({ id }: { id: string }) {
  const Icon = PLATFORM_ICONS[id as keyof typeof PLATFORM_ICONS] ?? GlobeIcon;
  return (
    <span title={id}>
      <Icon weight="fill" className="w-3.5 h-3.5" aria-hidden="true" />
    </span>
  );
}

function TechRow({
  label,
  value,
  muted,
  mono,
}: {
  label: string;
  value: string;
  muted?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <span className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <span
        className={
          muted
            ? "text-[13px] font-medium text-muted-foreground/70"
            : mono
              ? "font-mono text-[13px] font-medium text-foreground bg-muted/40 border border-border/40 rounded-lg px-2.5 py-1.5 w-fit"
              : "text-[13px] font-bold text-foreground"
        }
      >
        {value}
      </span>
    </div>
  );
}

function ProofSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function ChecklistRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2.5 text-[13px] font-semibold">
      {ok ? (
        <CheckIcon weight="fill" className="w-4 h-4 text-emerald-500 shrink-0" />
      ) : (
        <MinusIcon weight="bold" className="w-4 h-4 text-muted-foreground/50 shrink-0" />
      )}
      <span className={ok ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}
