"use client";

import Link from "next/link";
import {
  ShieldCheckIcon,
  LightbulbIcon,
  RocketLaunchIcon,
  QuestionIcon,
  LockIcon,
  EyeSlashIcon,
  TrashIcon,
  LifebuoyIcon,
} from "@phosphor-icons/react";
import { SidebarAccordion } from "@/components/submit/sidebar/sidebar-accordion";

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

const HOW_IT_WORKS = [
  {
    number: "1",
    title: "Envoyez",
    desc: "APK analysé sur votre appareil (manifest + signature) puis téléversé direct, jamais via nos serveurs.",
  },
  {
    number: "2",
    title: "Revue humaine",
    desc: "Sous 24 h ouvrées : l'APK est installé et testé sur un vrai téléphone. Ce qui ne s'installe pas est rejeté avec motif.",
  },
  {
    number: "3",
    title: "En ligne + notifié",
    desc: "Approuvé = téléchargeable sur la fiche. Chaque verdict part par email et dans votre cloche.",
  },
];

const WHY_VERIFY = [
  {
    title: "La fiche raconte, le binaire prouve",
    text: "N'importe qui écrit une description. Seul un APK signé et installé prouve que l'app existe vraiment.",
  },
  {
    title: "Une empreinte pincée, pas une promesse",
    text: "Le SHA-256 de votre clé est enregistré : chaque mise à jour est comparée, toute rotation est signalée à la revue.",
  },
  {
    title: "Refusé n'est jamais définitif",
    text: "Motif envoyé par email, fiche intacte, re-upload en un clic. On corrige, on renvoie, ça passe.",
  },
];

const GUARANTEES = [
  {
    icon: "lock",
    title: "SHA-256 pincé",
    desc: "L'empreinte de votre certificat est comparée à chaque envoi. Impossible de substituer un binaire.",
  },
  {
    icon: "eye",
    title: "Bucket privé",
    desc: "Les APK vivent en stockage privé. Seuls des liens signés de 5 minutes permettent le téléchargement.",
  },
  {
    icon: "shield",
    title: "Aucune donnée client",
    desc: "On ne lit que le manifest et les certificats. Jamais le contenu, jamais les utilisateurs.",
  },
  {
    icon: "trash",
    title: "Debug refusé comme Play",
    desc: "Un APK signé debug est refusé automatiquement, sans même entrer en file.",
  },
];

const REFUSAL_FAQ = [
  {
    question: "Fiche et binaire : deux pistes indépendantes ?",
    answer:
      "Oui. La fiche raconte, le binaire prouve — et chacun a sa revue, son verdict, son email. Un refus de l'un ne bloque jamais l'autre : une fiche rejetée garde ses builds en revue, un binaire rejeté laisse la fiche en ligne. Vous avancez des deux côtés sans attendre.",
  },
  {
    question: "Et si mon APK est refusé ?",
    answer:
      "Vous recevez le motif par email, la fiche reste en ligne sans le binaire. Corrigez, renvoyez depuis le dashboard : ça repart en revue, sans pénalité.",
  },
  {
    question: "Mon APK est refusé « signé sans v1 » ou « non signé » ?",
    answer:
      'Activez les trois schémas dans la config de signature Gradle : enableV1Signing = true, enableV2Signing = true, enableV3Signing = true (Kotlin DSL : dans create("release") ; Groovy : dans release { … }). La v1 est indispensable : les téléphones sous Android 7 ne savent vérifier qu\'elle. Contrôle sans IDE : « apksigner verify --print-certs fichier.apk » — les trois lignes doivent afficher true. Guide complet A à Z (keystore inclus, tous frameworks) : « Signer son APK release » dans la rubrique Guides, ou /guides/signature-apk.',
  },
  {
    question: "J'ai changé de clé de signature ?",
    answer:
      "C'est une rotation : la revue la voit (certificat différent signalé) et vérifie avec vous avant d'approuver. Prévenez dans les notes de version, ça va plus vite.",
  },
  {
    question: "Mon APK fait plus de 300 Mo ?",
    answer:
      "La limite est ferme (hébergement + installabilité). Allégez (splits par ABI refusés ici : c'est l'APK universel qui compte) ou distribuez les assets autrement.",
  },
];

const ICON_MAP: Record<string, React.ElementType> = {
  lock: LockIcon,
  eye: EyeSlashIcon,
  shield: ShieldCheckIcon,
  trash: TrashIcon,
};

/**
 * Guidance binaire partagée (D6) : MÊME pattern et design que la sidebar
 * submit (hero, Divider, SectionHeading, timeline, checks, icon-boxes,
 * carte émeraude, support) — contenu mix global : confiance/processus,
 * communauté, 1-2 conseils APK. Montée sur update + submit (complément,
 * sans remplacer l'existante).
 */
export function MakerGuidanceSidebar({
  sticky = true,
  chrome = true,
}: {
  sticky?: boolean;
  /**
   * `chrome=false` (page submit) : uniquement les blocs informatifs
   * binaire (timeline, pourquoi, garanties, refus) — sans hero, carte
   * émeraude ni support, déjà présents dans la sidebar submit. Une
   * seule colonne, aucun doublon.
   */
  chrome?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-12${sticky ? " sticky top-28" : ""}`}>
      {chrome && (
        <>
          {/* ── 1. Binaires vérifiés ── */}
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <ShieldCheckIcon
                weight="fill"
                className="w-8 h-8 text-emerald-600 dark:text-emerald-500"
              />
              <h2 className="text-[22px] font-black tracking-tight text-foreground">
                Binaires vérifiés
              </h2>
            </div>
            <p className="text-[14px] font-medium text-muted-foreground leading-relaxed">
              Votre APK est installé et testé par un humain avant d&apos;être proposé à la
              communauté. La confiance ne se déclare pas, elle se prouve.
            </p>
            <Link
              href="/regles"
              className="self-start text-[12px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 hover:opacity-70 transition-opacity border-b-2 border-emerald-600/30 pb-0.5 cursor-pointer"
            >
              LIRE LES RÈGLES
            </Link>
          </div>

          <Divider />
        </>
      )}

      {/* ── 2. Comment ça marche ── */}
      <div className="flex flex-col gap-8">
        <SectionHeading icon={LightbulbIcon} label="Comment ça marche" />
        <div className="flex flex-col gap-7 relative before:absolute before:left-3 before:top-1 before:bottom-2 before:w-px before:bg-border/50">
          {HOW_IT_WORKS.map((item) => (
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

      {/* ── 3. Pourquoi on vérifie ── */}
      <div className="flex flex-col gap-6">
        <SectionHeading icon={RocketLaunchIcon} label="Pourquoi on vérifie" />
        <div className="flex flex-col gap-4">
          {WHY_VERIFY.map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <ShieldCheckIcon
                weight="fill"
                className="w-5 h-5 text-emerald-600 dark:text-emerald-500 shrink-0 mt-0.5"
              />
              <p className="text-[13px] font-medium text-muted-foreground leading-relaxed">
                <span className="text-foreground font-bold">{item.title}. </span>
                {item.text}
              </p>
            </div>
          ))}
        </div>
      </div>

      <Divider />

      {/* ── 4. Garanties ── */}
      <div className="flex flex-col gap-5">
        <SectionHeading icon={LockIcon} label="Ce qu'on garantit" />
        <div className="flex flex-col gap-4">
          {GUARANTEES.map((g, i) => {
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

      {/* ── 5. Refus & questions ── */}
      <div className="flex flex-col gap-5">
        <SectionHeading icon={QuestionIcon} label="En cas de refus" />
        <SidebarAccordion items={REFUSAL_FAQ} />
      </div>

      {chrome && (
        <>
          <Divider />

          {/* ── 6. Le saviez-vous ? ── */}
          <div className="flex flex-col gap-4 bg-emerald-500/[0.06] p-6 rounded-[28px] border border-emerald-500/20">
            <SectionHeading icon={LightbulbIcon} label="Le saviez-vous ?" />
            <p className="text-[13px] font-medium text-muted-foreground leading-relaxed">
              <span className="text-foreground font-bold">La scène se prouve par ses apps. </span>
              Un APK vérifié, c&apos;est un maker qu&apos;on peut installer les yeux fermés — et une
              scène locale qui n&apos;a besoin de personne pour distribuer.
            </p>
            <Link
              href="/regles"
              className="text-[13px] font-bold text-emerald-600 dark:text-emerald-500 hover:underline w-fit"
            >
              Voir les règles du jeu &rarr;
            </Link>
          </div>

          <Divider />

          {/* ── 7. Support ── */}
          <div className="flex flex-col gap-4 bg-muted/20 p-6 rounded-[28px] border border-border/40">
            <div className="flex items-center gap-3">
              <LifebuoyIcon
                weight="fill"
                className="w-6 h-6 text-emerald-600 dark:text-emerald-500"
              />
              <h4 className="text-[15px] font-black tracking-tight text-foreground">
                Besoin d&apos;aide ?
              </h4>
            </div>
            <p className="text-[13px] font-medium text-muted-foreground leading-relaxed">
              Notre équipe éditoriale modère chaque produit. Si vous avez une question,
              contactez-nous.
            </p>
            <button className="text-[13px] font-bold text-emerald-600 dark:text-emerald-500 text-left hover:underline">
              Contacter le support &rarr;
            </button>
          </div>
        </>
      )}
    </div>
  );
}
