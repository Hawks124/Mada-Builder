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
  title: string;
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
  {
    number: "5",
    title: "Des liens qui fonctionnent",
    desc: "Chaque lien est vérifié en direct pendant la saisie. Visez le vert partout — un lien non vérifié ralentit la revue.",
  },
];

// ── 2. WHY PUBLISH BENEFITS ──────────────────────────────────────────────────
export const WHY_PUBLISH: BenefitItem[] = [
  {
    // **Premier item, volontairement.** C'est l'argument le plus fort et le plus
    // durable — une fiche indexée vaut mille-six-cents jours, un post de groupe
    // en vaut un — et c'était le 8e sur 8, donc le moins lu. Le mot « SEO » a
    // disparu au profit de la conséquence concrète, que tout le monde comprend.
    title: "Une fiche qui reste en ligne",
    text: "Chaque fiche est une page à son adresse : indexée par Google, partageable, et qui continue d'être trouvée des années après qu'un post a disparu. Et si vous reliez votre facturation, vos revenus lus en direct deviennent une preuve que personne ne peut inventer.",
  },
  {
    title: "Tes premiers utilisateurs sont ici",
    text: "Pas sur Product Hunt : le marché international est saturé et la concurrence écrasante pour un lancement. Tes premiers utilisateurs sont toujours locaux — c'est eux que tu trouves ici, directement, sans budget marketing.",
  },
  {
    title: "Gratuit, sans paperasse",
    text: "Pas de déclaration sur l'honneur, pas de pièces justificatives, pas d'abonnement pour exister ou pour être vu. Tu publies, point — le reste, c'est ton produit qui parle.",
  },
  {
    title: "Ouvert à tous",
    text: "Makers comme simples curieux : aucune barrière à l'entrée, aucun gatekeeping, aucun diplôme requis. Si tu construis, tu as ta place ; si tu regardes, bienvenue aussi.",
  },
  {
    title: "Un classement qui ne se vend pas",
    text: "Ni abonnement « top », ni prime à l'ancienneté : seuls les votes et les commentaires font le rang — et une fiche publiée hier peut dépasser une fiche d'il y a un mois. Les nouveautés ne sont jamais écartées.",
  },
  {
    title: "La vitrine du pays",
    text: "Publier ici, c'est inscrire ton produit au patrimoine tech local : fierté, valorisation du fait local, support aux makers d'ici — et la possibilité pour chacun de choisir le local sans subir l'ailleurs.",
  },
  {
    title: "Open source jusque dans le code",
    text: "La plateforme elle-même se construit en public : code ouvert, décisions visibles, contributions bienvenues. La confiance ne se décrète pas, elle s'inspecte.",
  },
  {
    title: "Modération qui donne confiance",
    text: "Chaque fiche est lue par un humain — en général sous 24 h ouvrées. Cette exigence est ce qui rend l'annuaire crédible : une fiche listée ici a été vérifiée par quelqu'un.",
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
    field: "Type de produit",
    explanation:
      "Ce choix commande tout le formulaire : liens affichés, plateformes suggérées, orientation des captures. Un CLI ne voit pas l'App Store, un jeu voit itch.io — rien d'inutile, rien à deviner.",
  },
  {
    field: "Tags libres",
    explanation:
      "Mots-clés qui affinent la découverte (mobile-money, offline-first). Ils nourrissent la recherche et les pages catégorie — pensez comme quelqu'un qui chercherait votre produit.",
  },
  {
    field: "Vérification des liens en direct",
    explanation:
      "Chaque URL collée est testée instantanément (pastille verte, ambre ou rouge). Vert = joignable. Ambre = privé ou invérifiable — accepté, signalé à la revue. Rouge = cassé — à corriger avant envoi. Seul un point d'accès (site, store, registre ou démo) est exigé, jamais un champ précis.",
  },
  {
    field: "Vidéo de présentation",
    explanation:
      "Bande-annonce ou démo filmée, affichée en grand sur la fiche. Pour un jeu, préférez la démo jouable : on ne liste pas un jeu sans y jouer.",
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
    question: "Pourquoi je ne vois pas les mêmes champs qu'un autre produit ?",
    answer:
      "Normal, c'est voulu : le formulaire s'adapte à votre type de produit. Une app mobile demande les stores, un package demande son registre, un jeu demande sa démo jouable. Rien n'est caché — chaque type a juste ses propres champs.",
  },
  {
    // 2e position : c'est la deuxième grande crainte d'un maker, après « mon
    // formulaire a-t-il l'air correct ». Elle n'était traitée nulle part. La
    // dernière phrase referme sur le classement invendable, ce qui transforme
    // une question technique en argument.
    question: "Est-ce que ma fiche sera visible sur Google ?",
    answer:
      "Oui — c'est même l'intérêt principal. Chaque fiche est une page à son adresse propre, indexée par les moteurs, partageable, et qui reste en ligne. Un post dans un groupe disparaît en quelques heures ; une fiche indexée continue d'être trouvée des années après. C'est aussi pour ça qu'aucun abonnement ne vient acheter une meilleure place : le classement ne se vend pas, donc ce qui est bien fait finit par se voir.",
  },
  {
    question: "Combien de temps prend la modération ?",
    answer:
      "Chaque fiche est lue par un humain — en général sous 24 h ouvrées. Pas une file façon store : si c'est propre, ça passe vite ; si ça coince, on vous dit exactement quoi corriger. Cette exigence est ce qui rend l'annuaire crédible.",
  },
  {
    question: "Puis-je modifier ma fiche après publication ?",
    answer:
      "Textes et liens : oui, à tout moment (liens revérifiés automatiquement). Seul le nom repasse en revue humaine (anti-squat). Captures et logo : figés après publication en MVP.",
  },
  {
    question: "Que se passe-t-il si mon app est rejetée ?",
    answer:
      "Vous recevez la raison précise par email. Corrigez à votre rythme et resoumettez quand c'est prêt — aucun délai imposé, aucun compteur.",
  },
  {
    question: "Un de mes liens est signalé non vérifié, que faire ?",
    answer:
      "Vérifiez d'abord l'adresse (faute de frappe, page déplacée). Si le lien est privé (repo privé, site à accès restreint) ou protégé anti-robots, c'est normal : soumettez quand même, la revue humaine tranchera. Seuls les liens cassés (inexistants, timeout) bloquent l'envoi.",
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
