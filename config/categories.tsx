import { 
  BriefcaseIcon,
  TerminalWindowIcon,
  CheckSquareIcon,
  SparkleIcon,
  UsersThreeIcon,
  VideoCameraIcon,
  StarIcon,
  ChartLineUpIcon,
  CreditCardIcon,
  HeartbeatIcon,
  GraduationCapIcon,
  GameControllerIcon,
  ShoppingCartIcon,
  ChatsCircleIcon,
  PlayIcon,
  PaletteIcon,
  DatabaseIcon,
  ShieldCheckIcon,
  UsersIcon,
  CarIcon,
  ForkKnifeIcon,
  BuildingIcon,
  LeafIcon,
  AirplaneIcon,
  MusicNoteIcon,
  CurrencyBtcIcon,
  ScalesIcon,
  HandshakeIcon,
  FlaskIcon,
  NewspaperIcon,
  FactoryIcon,
  LightningIcon,
  RobotIcon,
  ChurchIcon,
  SquaresFourIcon,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";

export type ProductCategory = {
  id: string;
  name: string;
  /** Short subtitle displayed under the name (2–4 words, no period). */
  subtitle: string;
  count: number;
  icon: Icon;
  /** Tailwind entire string class for hover color (must include group-hover: prefix for tailwind compiler) */
  hoverColor: string;
  /** Tailwind entire string class for hover background (must include group-hover: prefix for tailwind compiler) */
  hoverBg: string;
  /** Tailwind entire string class for self-hover (chips/toggles outside a `group` context) */
  hoverClass?: string;
  /** Tailwind entire string class for the selected/filled state (toggles) */
  selectedClass?: string;
  /** Tailwind entire string class for a static tinted chip (color visible without hover) */
  chipClass?: string;
};

/*
 * NB : les `count` sont des placeholders de prototype (Jalon 0).
 * Ils seront remplacés par le champ `app_count` dénormalisé (PRD §8)
 * dès que le leaderboard et les catégories seront alimentés en base.
 */

/**
 * Liste atomique des catégories de la plateforme.
 * Une seule idée par catégorie, sans regroupement — comme les stores,
 * mais couvrant aussi les produits non-app (packages, librairies,
 * frameworks, OS, bots...) qui se rangent par domaine d'application.
 * C'est cette liste qui alimente /categories, le formulaire de soumission
 * et la discover page.
 */
export const PRODUCT_CATEGORIES: ProductCategory[] = [
  { id: "saas",         name: "SaaS",                    subtitle: "Logiciels en abonnement",            count: 78,  icon: BriefcaseIcon,     hoverColor: "group-hover:text-blue-600",     hoverBg: "group-hover:bg-blue-600/10 group-hover:border-blue-600/20", hoverClass: "hover:text-blue-600 hover:bg-blue-600/10 hover:border-blue-600/20", selectedClass: "border-blue-600 bg-blue-600 text-background", chipClass: "text-blue-600 border-blue-600/20 bg-blue-600/10" },
  { id: "dev-tools",    name: "Dev Tools",               subtitle: "Outils pour développeurs",          count: 54,  icon: TerminalWindowIcon, hoverColor: "group-hover:text-zinc-600 dark:group-hover:text-zinc-400", hoverBg: "group-hover:bg-zinc-500/10 group-hover:border-zinc-500/20", hoverClass: "hover:text-zinc-600 dark:hover:text-zinc-400 hover:bg-zinc-500/10 hover:border-zinc-500/20", selectedClass: "border-zinc-600 bg-zinc-600 text-background", chipClass: "text-zinc-600 dark:text-zinc-400 border-zinc-500/20 bg-zinc-500/10" },
  { id: "productivity", name: "Productivité",            subtitle: "Tâches & organisation",            count: 41,  icon: CheckSquareIcon,   hoverColor: "group-hover:text-teal-500",     hoverBg: "group-hover:bg-teal-500/10 group-hover:border-teal-500/20", hoverClass: "hover:text-teal-500 hover:bg-teal-500/10 hover:border-teal-500/20", selectedClass: "border-teal-500 bg-teal-500 text-background", chipClass: "text-teal-600 border-teal-600/20 bg-teal-600/10" },
  { id: "ai",           name: "Intelligence Artificielle", subtitle: "Modèles, agents & NLP",         count: 27,  icon: SparkleIcon,       hoverColor: "group-hover:text-fuchsia-500",  hoverBg: "group-hover:bg-fuchsia-500/10 group-hover:border-fuchsia-500/20", hoverClass: "hover:text-fuchsia-500 hover:bg-fuchsia-500/10 hover:border-fuchsia-500/20", selectedClass: "border-fuchsia-500 bg-fuchsia-500 text-background", chipClass: "text-fuchsia-600 border-fuchsia-600/20 bg-fuchsia-600/10" },
  { id: "finance",      name: "Finance",                 subtitle: "Budget, comptabilité & bourse",     count: 33,  icon: ChartLineUpIcon,   hoverColor: "group-hover:text-green-500",    hoverBg: "group-hover:bg-green-500/10 group-hover:border-green-500/20", hoverClass: "hover:text-green-500 hover:bg-green-500/10 hover:border-green-500/20", selectedClass: "border-green-500 bg-green-500 text-background", chipClass: "text-green-600 border-green-600/20 bg-green-600/10" },
  { id: "fintech",      name: "Fintech",                 subtitle: "Paiements, mobile money & wallets", count: 29,  icon: CreditCardIcon,    hoverColor: "group-hover:text-emerald-600",  hoverBg: "group-hover:bg-emerald-600/10 group-hover:border-emerald-600/20", hoverClass: "hover:text-emerald-600 hover:bg-emerald-600/10 hover:border-emerald-600/20", selectedClass: "border-emerald-600 bg-emerald-600 text-background", chipClass: "text-emerald-600 border-emerald-600/20 bg-emerald-600/10" },
  { id: "health",       name: "Santé",                   subtitle: "Bien-être & télémédecine",         count: 18,  icon: HeartbeatIcon,     hoverColor: "group-hover:text-red-500",      hoverBg: "group-hover:bg-red-500/10 group-hover:border-red-500/20", hoverClass: "hover:text-red-500 hover:bg-red-500/10 hover:border-red-500/20", selectedClass: "border-red-500 bg-red-500 text-background", chipClass: "text-red-600 border-red-600/20 bg-red-600/10" },
  { id: "education",    name: "Éducation",               subtitle: "E-learning & apprentissage",       count: 46,  icon: GraduationCapIcon, hoverColor: "group-hover:text-orange-500",   hoverBg: "group-hover:bg-orange-500/10 group-hover:border-orange-500/20", hoverClass: "hover:text-orange-500 hover:bg-orange-500/10 hover:border-orange-500/20", selectedClass: "border-orange-500 bg-orange-500 text-background", chipClass: "text-orange-600 border-orange-600/20 bg-orange-600/10" },
  { id: "gaming",       name: "Gaming",                  subtitle: "Jeux vidéo & esport",              count: 22,  icon: GameControllerIcon, hoverColor: "group-hover:text-purple-500", hoverBg: "group-hover:bg-purple-500/10 group-hover:border-purple-500/20", hoverClass: "hover:text-purple-500 hover:bg-purple-500/10 hover:border-purple-500/20", selectedClass: "border-purple-500 bg-purple-500 text-background", chipClass: "text-purple-600 border-purple-600/20 bg-purple-600/10" },
  { id: "ecommerce",    name: "E-commerce",              subtitle: "Vente en ligne & marketplaces",     count: 35,  icon: ShoppingCartIcon,  hoverColor: "group-hover:text-emerald-500",  hoverBg: "group-hover:bg-emerald-500/10 group-hover:border-emerald-500/20", hoverClass: "hover:text-emerald-500 hover:bg-emerald-500/10 hover:border-emerald-500/20", selectedClass: "border-emerald-500 bg-emerald-500 text-background", chipClass: "text-emerald-600 border-emerald-600/20 bg-emerald-600/10" },
  { id: "communication", name: "Communication",          subtitle: "Chat & collaboration",             count: 26,  icon: ChatsCircleIcon,   hoverColor: "group-hover:text-sky-500",      hoverBg: "group-hover:bg-sky-500/10 group-hover:border-sky-500/20", hoverClass: "hover:text-sky-500 hover:bg-sky-500/10 hover:border-sky-500/20", selectedClass: "border-sky-500 bg-sky-500 text-background", chipClass: "text-sky-600 border-sky-600/20 bg-sky-600/10" },
  { id: "social",        name: "Réseaux sociaux",        subtitle: "Communautés & dating",             count: 13,  icon: UsersThreeIcon,    hoverColor: "group-hover:text-pink-400",     hoverBg: "group-hover:bg-pink-400/10 group-hover:border-pink-400/20", hoverClass: "hover:text-pink-400 hover:bg-pink-400/10 hover:border-pink-400/20", selectedClass: "border-pink-400 bg-pink-400 text-background", chipClass: "text-pink-400 border-pink-400/20 bg-pink-400/10" },
  { id: "entertainment", name: "Divertissement",         subtitle: "Streaming & médias",               count: 19,  icon: PlayIcon,          hoverColor: "group-hover:text-pink-500",     hoverBg: "group-hover:bg-pink-500/10 group-hover:border-pink-500/20", hoverClass: "hover:text-pink-500 hover:bg-pink-500/10 hover:border-pink-500/20", selectedClass: "border-pink-500 bg-pink-500 text-background", chipClass: "text-pink-500 border-pink-500/20 bg-pink-500/10" },
  { id: "video",         name: "Vidéo",                  subtitle: "Montage & streaming",              count: 16,  icon: VideoCameraIcon,   hoverColor: "group-hover:text-rose-400",     hoverBg: "group-hover:bg-rose-400/10 group-hover:border-rose-400/20", hoverClass: "hover:text-rose-400 hover:bg-rose-400/10 hover:border-rose-400/20", selectedClass: "border-rose-400 bg-rose-400 text-background", chipClass: "text-rose-500 border-rose-500/20 bg-rose-500/10" },
  { id: "design",       name: "Design",                  subtitle: "Graphisme, UI & prototypage",       count: 24,  icon: PaletteIcon,       hoverColor: "group-hover:text-violet-500",   hoverBg: "group-hover:bg-violet-500/10 group-hover:border-violet-500/20", hoverClass: "hover:text-violet-500 hover:bg-violet-500/10 hover:border-violet-500/20", selectedClass: "border-violet-500 bg-violet-500 text-background", chipClass: "text-violet-600 border-violet-600/20 bg-violet-600/10" },
  { id: "data",         name: "Data",                    subtitle: "Analytique & traitement",           count: 25,  icon: DatabaseIcon,      hoverColor: "group-hover:text-amber-600",    hoverBg: "group-hover:bg-amber-600/10 group-hover:border-amber-600/20", hoverClass: "hover:text-amber-600 hover:bg-amber-600/10 hover:border-amber-600/20", selectedClass: "border-amber-600 bg-amber-600 text-background", chipClass: "text-amber-600 border-amber-600/20 bg-amber-600/10" },
  { id: "security",     name: "Sécurité",                subtitle: "Protection & confidentialité",      count: 21,  icon: ShieldCheckIcon,   hoverColor: "group-hover:text-red-600",      hoverBg: "group-hover:bg-red-600/10 group-hover:border-red-600/20", hoverClass: "hover:text-red-600 hover:bg-red-600/10 hover:border-red-600/20", selectedClass: "border-red-600 bg-red-600 text-background", chipClass: "text-red-600 border-red-600/20 bg-red-600/10" },
  { id: "employment",   name: "Emploi",                  subtitle: "Job board & recrutement",          count: 12,  icon: UsersIcon,         hoverColor: "group-hover:text-blue-500",     hoverBg: "group-hover:bg-blue-500/10 group-hover:border-blue-500/20", hoverClass: "hover:text-blue-500 hover:bg-blue-500/10 hover:border-blue-500/20", selectedClass: "border-blue-500 bg-blue-500 text-background", chipClass: "text-blue-600 border-blue-600/20 bg-blue-600/10" },
  { id: "transport",    name: "Transport",               subtitle: "Logistique & mobilité",            count: 17,  icon: CarIcon,           hoverColor: "group-hover:text-indigo-500",   hoverBg: "group-hover:bg-indigo-500/10 group-hover:border-indigo-500/20", hoverClass: "hover:text-indigo-500 hover:bg-indigo-500/10 hover:border-indigo-500/20", selectedClass: "border-indigo-500 bg-indigo-500 text-background", chipClass: "text-indigo-600 border-indigo-600/20 bg-indigo-600/10" },
  { id: "food",         name: "Food",                    subtitle: "Commande & restaurants",           count: 20,  icon: ForkKnifeIcon,     hoverColor: "group-hover:text-yellow-500",   hoverBg: "group-hover:bg-yellow-500/10 group-hover:border-yellow-500/20", hoverClass: "hover:text-yellow-600 hover:bg-yellow-500/10 hover:border-yellow-500/20", selectedClass: "border-yellow-500 bg-yellow-500 text-background", chipClass: "text-yellow-700 border-yellow-600/20 bg-yellow-500/10" },
  { id: "real-estate",  name: "Immobilier",              subtitle: "Location & achat",                 count: 14,  icon: BuildingIcon,      hoverColor: "group-hover:text-slate-500",    hoverBg: "group-hover:bg-slate-500/10 group-hover:border-slate-500/20", hoverClass: "hover:text-slate-600 hover:bg-slate-500/10 hover:border-slate-500/20", selectedClass: "border-slate-500 bg-slate-500 text-background", chipClass: "text-slate-600 dark:text-slate-400 border-slate-500/20 bg-slate-500/10" },
  { id: "agriculture",  name: "Agriculture",             subtitle: "Agritech & élevage",               count: 9,   icon: LeafIcon,          hoverColor: "group-hover:text-green-600",    hoverBg: "group-hover:bg-green-600/10 group-hover:border-green-600/20", hoverClass: "hover:text-green-600 hover:bg-green-600/10 hover:border-green-600/20", selectedClass: "border-green-600 bg-green-600 text-background", chipClass: "text-green-700 border-green-600/20 bg-green-600/10" },
  { id: "travel",       name: "Tourisme",                subtitle: "Voyages & hôtellerie",             count: 11,  icon: AirplaneIcon,      hoverColor: "group-hover:text-cyan-500",     hoverBg: "group-hover:bg-cyan-500/10 group-hover:border-cyan-500/20", hoverClass: "hover:text-cyan-500 hover:bg-cyan-500/10 hover:border-cyan-500/20", selectedClass: "border-cyan-500 bg-cyan-500 text-background", chipClass: "text-cyan-600 border-cyan-600/20 bg-cyan-600/10" },
  { id: "music",        name: "Musique",                 subtitle: "Audio & podcasts",                 count: 8,   icon: MusicNoteIcon,     hoverColor: "group-hover:text-rose-500",     hoverBg: "group-hover:bg-rose-500/10 group-hover:border-rose-500/20", hoverClass: "hover:text-rose-500 hover:bg-rose-500/10 hover:border-rose-500/20", selectedClass: "border-rose-500 bg-rose-500 text-background", chipClass: "text-rose-600 border-rose-600/20 bg-rose-600/10" },
  { id: "blockchain",   name: "Blockchain",              subtitle: "Web3 & crypto",                    count: 10,  icon: CurrencyBtcIcon,   hoverColor: "group-hover:text-yellow-600",   hoverBg: "group-hover:bg-yellow-600/10 group-hover:border-yellow-600/20", hoverClass: "hover:text-yellow-600 hover:bg-yellow-600/10 hover:border-yellow-600/20", selectedClass: "border-yellow-600 bg-yellow-600 text-background", chipClass: "text-yellow-700 border-yellow-600/20 bg-yellow-600/10" },
  { id: "government",   name: "GovTech",                 subtitle: "Secteur public & open data",       count: 5,   icon: ScalesIcon,        hoverColor: "group-hover:text-zinc-600 dark:group-hover:text-zinc-400", hoverBg: "group-hover:bg-zinc-600/10 group-hover:border-zinc-600/20", hoverClass: "hover:text-zinc-600 dark:hover:text-zinc-400 hover:bg-zinc-600/10 hover:border-zinc-600/20", selectedClass: "border-zinc-600 bg-zinc-600 text-background", chipClass: "text-zinc-600 dark:text-zinc-400 border-zinc-600/20 bg-zinc-600/10" },
  { id: "nonprofit",    name: "Social",                  subtitle: "ONG & impact",                     count: 7,   icon: HandshakeIcon,     hoverColor: "group-hover:text-orange-600",   hoverBg: "group-hover:bg-orange-600/10 group-hover:border-orange-600/20", hoverClass: "hover:text-orange-600 hover:bg-orange-600/10 hover:border-orange-600/20", selectedClass: "border-orange-600 bg-orange-600 text-background", chipClass: "text-orange-600 border-orange-600/20 bg-orange-600/10" },
  { id: "science",      name: "Science",                 subtitle: "Simulation & recherche",           count: 6,   icon: FlaskIcon,         hoverColor: "group-hover:text-cyan-600",     hoverBg: "group-hover:bg-cyan-600/10 group-hover:border-cyan-600/20", hoverClass: "hover:text-cyan-600 hover:bg-cyan-600/10 hover:border-cyan-600/20", selectedClass: "border-cyan-600 bg-cyan-600 text-background", chipClass: "text-cyan-700 border-cyan-600/20 bg-cyan-600/10" },
  { id: "news",         name: "Médias",                  subtitle: "Presse & newsletters",             count: 4,   icon: NewspaperIcon,     hoverColor: "group-hover:text-slate-600 dark:group-hover:text-slate-400", hoverBg: "group-hover:bg-slate-600/10 group-hover:border-slate-600/20", hoverClass: "hover:text-slate-600 dark:hover:text-slate-400 hover:bg-slate-600/10 hover:border-slate-600/20", selectedClass: "border-slate-600 bg-slate-600 text-background", chipClass: "text-slate-600 dark:text-slate-400 border-slate-600/20 bg-slate-600/10" },
  { id: "industry",     name: "Industrie",               subtitle: "Manufacturing & production",       count: 3,   icon: FactoryIcon,       hoverColor: "group-hover:text-neutral-600 dark:group-hover:text-neutral-400", hoverBg: "group-hover:bg-neutral-600/10 group-hover:border-neutral-600/20", hoverClass: "hover:text-neutral-600 dark:hover:text-neutral-400 hover:bg-neutral-600/10 hover:border-neutral-600/20", selectedClass: "border-neutral-600 bg-neutral-600 text-background", chipClass: "text-neutral-600 dark:text-neutral-400 border-neutral-600/20 bg-neutral-600/10" },
  { id: "iot",          name: "IoT",                     subtitle: "Objets connectés & capteurs",      count: 8,   icon: LightningIcon,     hoverColor: "group-hover:text-amber-500",    hoverBg: "group-hover:bg-amber-500/10 group-hover:border-amber-500/20", hoverClass: "hover:text-amber-600 hover:bg-amber-500/10 hover:border-amber-500/20", selectedClass: "border-amber-500 bg-amber-500 text-background", chipClass: "text-amber-700 border-amber-600/20 bg-amber-500/10" },
  { id: "robotics",     name: "Robotique",               subtitle: "Bots & automatisation",            count: 6,   icon: RobotIcon,         hoverColor: "group-hover:text-fuchsia-600",  hoverBg: "group-hover:bg-fuchsia-600/10 group-hover:border-fuchsia-600/20", hoverClass: "hover:text-fuchsia-600 hover:bg-fuchsia-600/10 hover:border-fuchsia-600/20", selectedClass: "border-fuchsia-600 bg-fuchsia-600 text-background", chipClass: "text-fuchsia-600 border-fuchsia-600/20 bg-fuchsia-600/10" },
  { id: "lifestyle",   name: "Lifestyle",               subtitle: "Mode de vie & quotidien",          count: 11,  icon: StarIcon,          hoverColor: "group-hover:text-lime-600",     hoverBg: "group-hover:bg-lime-600/10 group-hover:border-lime-600/20", hoverClass: "hover:text-lime-600 hover:bg-lime-600/10 hover:border-lime-600/20", selectedClass: "border-lime-600 bg-lime-600 text-background", chipClass: "text-lime-700 border-lime-600/20 bg-lime-600/10" },
  { id: "religion",    name: "Religion",                subtitle: "Spiritualité & culte",              count: 4,   icon: ChurchIcon,       hoverColor: "group-hover:text-amber-700",    hoverBg: "group-hover:bg-amber-700/10 group-hover:border-amber-700/20", hoverClass: "hover:text-amber-700 hover:bg-amber-700/10 hover:border-amber-700/20", selectedClass: "border-amber-700 bg-amber-700 text-background", chipClass: "text-amber-700 border-amber-700/20 bg-amber-700/10" },
  { id: "other",        name: "Autre",                   subtitle: "Tout ce qui reste",                count: 9,   icon: SquaresFourIcon,   hoverColor: "group-hover:text-neutral-500",  hoverBg: "group-hover:bg-neutral-500/10 group-hover:border-neutral-500/20", hoverClass: "hover:text-neutral-500 hover:bg-neutral-500/10 hover:border-neutral-500/20", selectedClass: "border-neutral-500 bg-neutral-500 text-background", chipClass: "text-neutral-500 border-neutral-500/20 bg-neutral-500/10" },
];

/**
 * Liste du hero (homepage) — version groupée « & », conservée telle quelle :
 * c'est la sélection éditoriale affichée sur l'accueil (les 7 premières).
 * Volontairement distincte de PRODUCT_CATEGORIES : le hero met en avant des
 * domaines regroupés, la discover page et le formulaire utilisent l'atomique.
 */
export const HERO_CATEGORIES: ProductCategory[] = [
  { id: "saas",            name: "SaaS & Business",                subtitle: "Apps B2B & outils métier",           count: 185, icon: BriefcaseIcon,     hoverColor: "group-hover:text-blue-600",     hoverBg: "group-hover:bg-blue-600/10 group-hover:border-blue-600/20" },
  { id: "dev-tools",       name: "Dev Tools",                      subtitle: "Outils pour développeurs",          count: 154, icon: TerminalWindowIcon, hoverColor: "group-hover:text-zinc-600 dark:group-hover:text-zinc-400", hoverBg: "group-hover:bg-zinc-500/10 group-hover:border-zinc-500/20" },
  { id: "ai",              name: "IA & Machine Learning",          subtitle: "Agents, modèles & NLP",             count: 87,  icon: SparkleIcon,       hoverColor: "group-hover:text-fuchsia-500",  hoverBg: "group-hover:bg-fuchsia-500/10 group-hover:border-fuchsia-500/20" },
  { id: "fintech",         name: "Finance & Fintech",              subtitle: "Paiements & mobile money",          count: 63,  icon: CreditCardIcon,    hoverColor: "group-hover:text-emerald-600",  hoverBg: "group-hover:bg-emerald-600/10 group-hover:border-emerald-600/20" },
  { id: "iot",             name: "Automation & IoT",               subtitle: "Capteurs & domotique",              count: 48,  icon: LightningIcon,     hoverColor: "group-hover:text-amber-500",    hoverBg: "group-hover:bg-amber-500/10 group-hover:border-amber-500/20" },
  { id: "security",        name: "Sécurité & Confidentialité",     subtitle: "Cyber & devsecops",                 count: 41,  icon: ShieldCheckIcon,   hoverColor: "group-hover:text-red-600",      hoverBg: "group-hover:bg-red-600/10 group-hover:border-red-600/20" },
  { id: "ecommerce",       name: "E-commerce & Marketplaces",      subtitle: "Vente en ligne & paiements",        count: 35,  icon: ShoppingCartIcon,  hoverColor: "group-hover:text-emerald-500",  hoverBg: "group-hover:bg-emerald-500/10 group-hover:border-emerald-500/20" },
  { id: "education",       name: "Éducation & E-learning",         subtitle: "Cours & plateformes",               count: 46,  icon: GraduationCapIcon, hoverColor: "group-hover:text-orange-500",   hoverBg: "group-hover:bg-orange-500/10 group-hover:border-orange-500/20" },
  { id: "health",          name: "Santé & Bien-être",              subtitle: "Télémédecine & fitness",            count: 28,  icon: HeartbeatIcon,     hoverColor: "group-hover:text-red-500",      hoverBg: "group-hover:bg-red-500/10 group-hover:border-red-500/20" },
  { id: "communication",   name: "Communication & Collaboration",  subtitle: "Chat, visio & outils d'équipe",     count: 26,  icon: ChatsCircleIcon,   hoverColor: "group-hover:text-sky-500",      hoverBg: "group-hover:bg-sky-500/10 group-hover:border-sky-500/20" },
  { id: "productivity",    name: "Productivité & Organisation",    subtitle: "Tâches, notes & workflow",          count: 41,  icon: CheckSquareIcon,   hoverColor: "group-hover:text-teal-500",     hoverBg: "group-hover:bg-teal-500/10 group-hover:border-teal-500/20" },
  { id: "data",            name: "Data & Analytics",               subtitle: "Visualisation & BI",                count: 55,  icon: DatabaseIcon,      hoverColor: "group-hover:text-amber-600",    hoverBg: "group-hover:bg-amber-600/10 group-hover:border-amber-600/20" },
  { id: "design",          name: "Design & Créatif",               subtitle: "UI/UX & graphisme",                 count: 24,  icon: PaletteIcon,       hoverColor: "group-hover:text-violet-500",   hoverBg: "group-hover:bg-violet-500/10 group-hover:border-violet-500/20" },
  { id: "gaming",          name: "Gaming & Esport",                subtitle: "Jeux & compétitions",               count: 22,  icon: GameControllerIcon, hoverColor: "group-hover:text-purple-500", hoverBg: "group-hover:bg-purple-500/10 group-hover:border-purple-500/20" },
  { id: "entertainment",   name: "Média & Divertissement",         subtitle: "Streaming & contenus",              count: 19,  icon: PlayIcon,          hoverColor: "group-hover:text-pink-500",     hoverBg: "group-hover:bg-pink-500/10 group-hover:border-pink-500/20" },
  { id: "music",           name: "Musique & Audio",                subtitle: "Streaming & podcasts",              count: 18,  icon: MusicNoteIcon,     hoverColor: "group-hover:text-rose-500",     hoverBg: "group-hover:bg-rose-500/10 group-hover:border-rose-500/20" },
  { id: "transport",       name: "Transport & Logistique",         subtitle: "Mobilité & livraison",              count: 17,  icon: CarIcon,           hoverColor: "group-hover:text-indigo-500",   hoverBg: "group-hover:bg-indigo-500/10 group-hover:border-indigo-500/20" },
  { id: "food",            name: "Food & Restaurants",             subtitle: "Commande & réservation",            count: 20,  icon: ForkKnifeIcon,     hoverColor: "group-hover:text-yellow-500",   hoverBg: "group-hover:bg-yellow-500/10 group-hover:border-yellow-500/20" },
  { id: "travel",          name: "Tourisme & Hôtellerie",          subtitle: "Voyages & réservations",            count: 11,  icon: AirplaneIcon,      hoverColor: "group-hover:text-cyan-500",     hoverBg: "group-hover:bg-cyan-500/10 group-hover:border-cyan-500/20" },
  { id: "real-estate",     name: "Immobilier & Proptech",          subtitle: "Location & achat",                  count: 14,  icon: BuildingIcon,      hoverColor: "group-hover:text-slate-500",    hoverBg: "group-hover:bg-slate-500/10 group-hover:border-slate-500/20" },
  { id: "employment",      name: "Emploi & RH",                    subtitle: "Job board & recrutement",           count: 12,  icon: UsersIcon,         hoverColor: "group-hover:text-blue-500",     hoverBg: "group-hover:bg-blue-500/10 group-hover:border-blue-500/20" },
  { id: "blockchain",      name: "Blockchain & Web3",              subtitle: "Crypto & smart contracts",          count: 10,  icon: CurrencyBtcIcon,   hoverColor: "group-hover:text-yellow-600",   hoverBg: "group-hover:bg-yellow-600/10 group-hover:border-yellow-600/20" },
  { id: "government",      name: "GovTech & Civic Tech",           subtitle: "Secteur public & open data",        count: 5,   icon: ScalesIcon,        hoverColor: "group-hover:text-zinc-600 dark:group-hover:text-zinc-400", hoverBg: "group-hover:bg-zinc-600/10 group-hover:border-zinc-600/20" },
  { id: "nonprofit",       name: "Social & ONG",                   subtitle: "Impact & solidarité",               count: 7,   icon: HandshakeIcon,     hoverColor: "group-hover:text-orange-600",   hoverBg: "group-hover:bg-orange-600/10 group-hover:border-orange-600/20" },
  { id: "agriculture",     name: "Agriculture & Agritech",         subtitle: "Farming & élevage",                 count: 9,   icon: LeafIcon,          hoverColor: "group-hover:text-green-600",    hoverBg: "group-hover:bg-green-600/10 group-hover:border-green-600/20" },
  { id: "science",         name: "Science & Recherche",            subtitle: "Simulation & lab",                  count: 6,   icon: FlaskIcon,         hoverColor: "group-hover:text-cyan-600",     hoverBg: "group-hover:bg-cyan-600/10 group-hover:border-cyan-600/20" },
  { id: "robotics",        name: "Robotique & Agents",             subtitle: "Bots & automatisation",             count: 16,  icon: RobotIcon,         hoverColor: "group-hover:text-fuchsia-600",  hoverBg: "group-hover:bg-fuchsia-600/10 group-hover:border-fuchsia-600/20" },
  { id: "industry",        name: "Industrie & Manufacturing",      subtitle: "Production & usine",                count: 3,   icon: FactoryIcon,       hoverColor: "group-hover:text-neutral-600 dark:group-hover:text-neutral-400", hoverBg: "group-hover:bg-neutral-600/10 group-hover:border-neutral-600/20" },
  { id: "other",           name: "Autre",                          subtitle: "Tout le reste",                     count: 9,   icon: SquaresFourIcon,   hoverColor: "group-hover:text-neutral-500",  hoverBg: "group-hover:bg-neutral-500/10 group-hover:border-neutral-500/20" },
];

/** Total product count across all categories (hero stats bar). */
export const TOTAL_PRODUCT_COUNT = PRODUCT_CATEGORIES.reduce((acc, c) => acc + c.count, 0);

/** Résout une catégorie atomique depuis son id, avec fallback neutre (`other`). */
export function getCategoryById(id: string): ProductCategory | undefined {
  return PRODUCT_CATEGORIES.find((c) => c.id === id);
}