// ─────────────────────────────────────────────────────────────────────────────
// SIDEBAR DATA — Submit Guidance Sidebar
// All static content lives here. The component only renders.
// ─────────────────────────────────────────────────────────────────────────────

export interface ChecklistItem {
  number: string;
  title: string;
  desc: string;
}

export interface BenefitItem {
  text: string;
}

export interface FieldExplanation {
  field: string;
  explanation: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface SecurityGuarantee {
  icon: string; // emoji or identifier for icon choice in the component
  title: string;
  desc: string;
}

// ── 1. LAUNCH CHECKLIST ──────────────────────────────────────────────────────
export const LAUNCH_CHECKLIST: ChecklistItem[] = [
  {
    number: "1",
    title: "Le problème d'abord",
    desc: "Nommez exactement à qui vous aidez et quel problème vous résolvez.",
  },
  {
    number: "2",
    title: "Une tagline percutante",
    desc: "Faites une promesse claire en moins de 80 caractères.",
  },
  {
    number: "3",
    title: "Montrez l'app en action",
    desc: "Les vraies captures d'écran convertissent mieux que de l'art abstrait.",
  },
  {
    number: "4",
    title: "Un logo lisible",
    desc: "Gardez un logo aux lignes nettes sur un fond uni.",
  },
];

// ── 2. WHY PUBLISH BENEFITS ──────────────────────────────────────────────────
export const WHY_PUBLISH: BenefitItem[] = [
  {
    text: "Visibilité gratuite auprès des créateurs et devs malgaches.",
  },
  {
    text: "Boost SEO grâce aux pages indexables dédiées à votre produit.",
  },
  {
    text: "Prouvez vos revenus officiellement avec le badge MRR vérifié Stripe.",
  },
  {
    text: "Intégrez la communauté référence de la tech malgache.",
  },
];

// ── 3. FIELD EXPLANATIONS ("Pourquoi on vous demande ça ?") ──────────────────
export const FIELD_EXPLANATIONS: FieldExplanation[] = [
  {
    field: "Modèle économique",
    explanation:
      "Permet aux utilisateurs de filtrer les apps gratuites, payantes ou freemium. Ce badge est affiché directement sur votre fiche produit et influence la découverte.",
  },
  {
    field: "Licence de l'app",
    explanation:
      "Indique si votre code est open source (MIT, GPL…) ou propriétaire. Crucial pour les développeurs qui cherchent à contribuer ou s'inspirer. Laissez vide pour les apps fermées.",
  },
  {
    field: "Publicités (Ads)",
    explanation:
      "Signale la présence de publicités intégrées. Requis pour la transparence. Les utilisateurs peuvent filtrer les apps sans pub — être honnête améliore la confiance.",
  },
  {
    field: "Third-party SDK",
    explanation:
      "Indique si votre app utilise des SDK tiers (analytics, tracking, crash reporting). Requis pour la transparence RGPD et la confiance des utilisateurs.",
  },
  {
    field: "Politique de confidentialité enfants",
    explanation:
      "Si votre app cible les moins de 13 ans, les stores (Google Play, App Store) et la loi COPPA exigent une politique de confidentialité dédiée. Un lien valide est obligatoire.",
  },
  {
    field: "Commande d'installation",
    explanation:
      "Uniquement pour les packages npm, pip, composer, etc. Laissez ce champ vide si votre produit est une app mobile ou web classique.",
  },
  {
    field: "Clé API Revenus (Stripe / RevenueCat)",
    explanation:
      "Une clé à accès restreint en lecture seule — uniquement votre MRR agrégé. Elle ne peut pas initier de remboursements, de transferts ou de charges. Sur Stripe, créez une clé restreinte avec uniquement la permission 'Lire les charges, abonnements'. Nous la chiffrons avec AES-256 dès réception. Jamais loggée, jamais partagée. Seul vous pouvez la supprimer depuis votre dashboard.",
  },
];

// ── 5. SECURITY GUARANTEES ───────────────────────────────────────────────────
export const SECURITY_GUARANTEES: SecurityGuarantee[] = [
  {
    icon: "lock",
    title: "Chiffrement AES-256",
    desc: "Votre clé est chiffrée dès réception avec AES-256, le standard utilisé par les banques. Elle n'est jamais stockée en clair.",
  },
  {
    icon: "eye",
    title: "Lecture seule, toujours",
    desc: "Nous lisons uniquement votre MRR agrégé. La clé ne peut pas déclencher de paiements, remboursements, ou transferts.",
  },
  {
    icon: "shield",
    title: "Agrégats uniquement",
    desc: "Nous ne stockons ni ne loggons jamais les données de vos clients. Seul votre MRR (chiffre global) est conservé sous forme agrégée.",
  },
  {
    icon: "trash",
    title: "Révocable à tout moment",
    desc: "Supprimez la connexion depuis votre dashboard à tout moment. Nous effaçons immédiatement la clé de nos serveurs.",
  },
];

// ── 4. FAQ ───────────────────────────────────────────────────────────────────
export const FAQ_ITEMS: FaqItem[] = [
  {
    question: "Combien de temps prend la modération ?",
    answer:
      "Moins de 24h en semaine. Vous recevez un email à l'approbation ou au rejet avec la raison détaillée.",
  },
  {
    question: "Puis-je modifier ma fiche après publication ?",
    answer:
      "Oui. Tous les champs sont éditables. Seuls le nom et les liens principaux repassent en revue rapide pour éviter les abus.",
  },
  {
    question: "Que se passe-t-il si mon app est rejetée ?",
    answer:
      "Vous recevez un email avec la raison précise. Vous pouvez corriger les points soulevés et resoumettre sans délai d'attente supplémentaire.",
  },
  {
    question: "Mon app doit-elle être malgache ?",
    answer:
      "Le maker doit être malgache, ou le produit doit cibler le marché malgache. Les deux conditions sont acceptées.",
  },
  {
    question: "Est-ce que mes revenus sont vraiment confidentiels ?",
    answer:
      "Oui. On stocke uniquement des agrégats (MRR, nombre d'abonnés). Vos transactions clients leur sont invisibles. Vous pouvez aussi activer le mode badge-only pour ne pas afficher le chiffre exact.",
  },
];
