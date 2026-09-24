"use client";

import {
  ShieldCheckIcon,
  LightbulbIcon,
  LifebuoyIcon,
  RocketLaunchIcon,
  CheckCircleIcon,
  QuestionIcon,
  LockIcon,
  EyeSlashIcon,
  TrashIcon,
  BookOpenIcon,
  ArrowSquareOutIcon,
} from "@phosphor-icons/react";

const STORE_GUIDES = [
  {
    label: "Apple — Review Guidelines",
    href: "https://developer.apple.com/app-store/review/guidelines/",
  },
  {
    label: "Google Play — Règles",
    href: "https://play.google.com/about/developer-content-policy/",
  },
  {
    label: "npm — Publier un package",
    href: "https://docs.npmjs.com/",
  },
];
import { SidebarAccordion } from "./sidebar/sidebar-accordion";
import {
  LAUNCH_CHECKLIST,
  WHY_PUBLISH,
  FIELD_EXPLANATIONS,
  FAQ_ITEMS,
  SECURITY_GUARANTEES,
} from "./sidebar/sidebar-data";

// ─────────────────────────────────────────────────────────────────────────────
// Shared micro-components (local only — not exported)
// ─────────────────────────────────────────────────────────────────────────────

function SectionHeading({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2.5 text-muted-foreground">
      <Icon
        weight="duotone"
        className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-500 shrink-0"
      />
      <h3 className="text-[11px] font-black uppercase tracking-[0.15em]">{label}</h3>
    </div>
  );
}

function Divider() {
  return <div className="w-full h-px bg-border/40" />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Sidebar
// ─────────────────────────────────────────────────────────────────────────────

export function SubmitGuidanceSidebar() {
  // Map FIELD_EXPLANATIONS to accordion format
  const fieldAccordionItems = FIELD_EXPLANATIONS.map((f) => ({
    question: f.field,
    answer: f.explanation,
  }));

  // Map security icon keys to Phosphor components
  const ICON_MAP: Record<string, React.ElementType> = {
    lock: LockIcon,
    eye: EyeSlashIcon,
    shield: ShieldCheckIcon,
    trash: TrashIcon,
  };

  return (
    <div className="flex flex-col gap-12 sticky top-28">
      {/* ── 1. Listings responsables ── */}
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <ShieldCheckIcon
            weight="fill"
            className="w-8 h-8 text-emerald-600 dark:text-emerald-500"
          />
          <h2 className="text-[22px] font-black tracking-tight text-foreground">
            Listings responsables
          </h2>
        </div>
        <p className="text-[14px] font-medium text-muted-foreground leading-relaxed">
          Les applications doivent être légales, éthiques et représentées honnêtement. Aucun spam ou
          produit dupliqué.
        </p>
        <button className="self-start text-[12px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 hover:opacity-70 transition-opacity border-b-2 border-emerald-600/30 pb-0.5 cursor-pointer">
          LIRE LES RÈGLES
        </button>
      </div>

      <Divider />

      {/* ── 2. Checklist de Lancement ── */}
      <div className="flex flex-col gap-8">
        <SectionHeading icon={LightbulbIcon} label="Checklist de Lancement" />
        <div className="flex flex-col gap-7 relative before:absolute before:left-3 before:top-1 before:bottom-2 before:w-px before:bg-border/50">
          {LAUNCH_CHECKLIST.map((item) => (
            <div key={item.number} className="flex gap-5 relative z-10 group cursor-default">
              <div className="w-6 h-6 rounded-full bg-background border-2 border-border flex items-center justify-center shrink-0 mt-0.5 group-hover:border-emerald-500 transition-colors">
                <span className="text-[10px] font-bold text-muted-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  {item.number}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[14px] font-black text-foreground tracking-tight">
                  {item.title}
                </span>
                <span className="text-[13px] font-medium text-muted-foreground leading-relaxed">
                  {item.desc}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Divider />

      {/* ── 3. Pourquoi publier ici ? ── */}
      <div className="flex flex-col gap-6">
        <SectionHeading icon={RocketLaunchIcon} label="Pourquoi publier ici ?" />
        <div className="flex flex-col gap-4">
          {WHY_PUBLISH.map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <CheckCircleIcon
                weight="fill"
                className="w-5 h-5 text-emerald-600 dark:text-emerald-500 shrink-0 mt-0.5"
              />
              <p className="text-[13px] font-medium text-muted-foreground leading-relaxed">
                {item.text}
              </p>
            </div>
          ))}
        </div>
      </div>

      <Divider />

      {/* ── 4. Pourquoi on vous demande ça ? (accordion) ── */}
      <div className="flex flex-col gap-5">
        <SectionHeading icon={QuestionIcon} label="Pourquoi on vous demande ça ?" />
        <p className="text-[12px] font-medium text-muted-foreground leading-relaxed">
          Certains champs peuvent sembler techniques. Voici leur rôle exact sur la plateforme.
        </p>
        <SidebarAccordion items={fieldAccordionItems} />
      </div>

      <Divider />

      {/* ── 5. Sécurité des données ── */}
      <div className="flex flex-col gap-5">
        <SectionHeading icon={LockIcon} label="Sécurité de vos données" />
        <p className="text-[12px] font-medium text-muted-foreground leading-relaxed">
          Vos clés ne transitent jamais en clair et ne sont jamais partagées avec des tiers.
        </p>
        <div className="flex flex-col gap-4">
          {SECURITY_GUARANTEES.map((g, i) => {
            const Icon = ICON_MAP[g.icon] ?? ShieldCheckIcon;
            return (
              <div key={i} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-xl bg-muted/30 border border-border/50 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon weight="duotone" className="w-3.5 h-3.5 text-foreground/70" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[13px] font-bold text-foreground">{g.title}</span>
                  <span className="text-[12px] font-medium text-muted-foreground leading-relaxed">
                    {g.desc}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Divider />

      {/* ── 6. Guides des stores ── */}
      <div className="flex flex-col gap-5">
        <SectionHeading icon={BookOpenIcon} label="Guides des stores" />
        <p className="text-[12px] font-medium text-muted-foreground leading-relaxed">
          Anticipez les refus : lisez les règles officielles des plateformes que vous ciblez avant
          de soumettre.
        </p>
        <div className="flex flex-col gap-1">
          {STORE_GUIDES.map((guide) => (
            <a
              key={guide.href}
              href={guide.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-between gap-3 rounded-xl py-2.5 text-[13px] font-bold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              {guide.label}
              <ArrowSquareOutIcon
                weight="bold"
                className="w-4 h-4 shrink-0 text-muted-foreground/60 group-hover:text-foreground transition-colors"
              />
            </a>
          ))}
        </div>
      </div>

      <Divider />

      {/* ── 7. FAQ ── */}
      <div className="flex flex-col gap-5">
        <SectionHeading icon={QuestionIcon} label="Questions fréquentes" />
        <SidebarAccordion items={FAQ_ITEMS} />
      </div>

      <Divider />

      {/* ── 6. Support ── */}
      <div className="flex flex-col gap-4 bg-muted/20 p-6 rounded-[28px] border border-border/40">
        <div className="flex items-center gap-3">
          <LifebuoyIcon weight="fill" className="w-6 h-6 text-emerald-600 dark:text-emerald-500" />
          <h4 className="text-[15px] font-black tracking-tight text-foreground">
            Besoin d&apos;aide ?
          </h4>
        </div>
        <p className="text-[13px] font-medium text-muted-foreground leading-relaxed">
          Notre équipe éditoriale modère chaque produit. Si vous avez une question, contactez-nous.
        </p>
        <button className="text-[13px] font-bold text-emerald-600 dark:text-emerald-500 text-left hover:underline">
          Contacter le support &rarr;
        </button>
      </div>
    </div>
  );
}
