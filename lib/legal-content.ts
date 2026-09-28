/**
 * Données structurées des documents juridiques.
 *
 * Pourquoi des tableaux React plutôt que des tableaux markdown : `remark-gfm`
 * n'est pas installé, donc un tableau écrit avec des `|` s'afficherait en
 * texte brut **silencieusement** — le rédacteur le croirait rendu. Les
 * données tabulaires vivent ici, typées, et sont insérées dans le flux par
 * `components/legal/legal-blocks.tsx` via un marqueur `{{block:cle}}`.
 *
 * Une contrepartie : modifier une durée se fait ici, pas dans le `.md`. C'est
 * le prix de la robustesse — un vrai `<table>` sémantique, thème sombre, et
 * scroll horizontal sur mobile, sans dépendance.
 *
 * Ces données sont **vérifiables dans le dépôt** : sous-traitants et régions
 * viennent de `package.json` et de `.env.local`, pas d'une supposition.
 */

export const LEGAL_IDENTITY = {
  /** Raison sociale ou nom du responsable — null = pas d'entité, on publie le projet. */
  legalEntity: null,
  projectName: "Mada-Made",
  /** Éditeur : un développeur indépendant, pas une société. */
  editorLabel:
    "Projet open source communautaire, publié et maintenu par un développeur indépendant",
  contactEmail: "tojorinaud@gmail.com",
  country: "Madagascar",
  /** Adresse postale non publiée : le contact par email est garanti atteignable. */
  postalAddress: null,
  /** Nom de l'autorité de contrôle : non vérifié, donc formule neutre. */
  authorityName: "l'autorité de contrôle compétente",
  governingLaw: "droit malgache",
  /** Tribunal non nommé : nommer un tribunal sans conseil juridique serait une erreur. */
  courtName: "le tribunal compétent",
  /** Cadre : droit national + RGPD pour les visiteurs européens. */
  frameworks: [
    "loi malgache n° 2014-038 sur la protection des données à caractère personnel",
    "Règlement (UE) 2016/679 (RGPD) pour les visiteurs résidant dans l'Union européenne",
  ],
} as const;

export type RetentionRow = {
  data: string;
  duration: string;
  rationale: string;
};

export const RETENTION_ROWS: readonly RetentionRow[] = [
  {
    data: "Compte, profil, produits publiés",
    duration: "Durée du compte",
    rationale: "Ces données constituent le service demandé ; elles n'ont pas d'autre finalité.",
  },
  {
    data: "Clé de facturation chiffrée",
    duration: "Jusqu'à révocation, puis purge",
    rationale: "Conserver un secret plus que nécessaire n'apporte rien et augmente le risque.",
  },
  {
    data: "Brouillon de soumission",
    duration: "90 jours",
    rationale: "Laisse le temps de reprendre une soumission commencée et abandonnée.",
  },
  {
    data: "Journaux anti-abus et adresses IP",
    duration: "30 jours",
    rationale: "La finalité est la détection de fraude au vote, de courte durée par nature.",
  },
  {
    data: "Journal de modération et recours",
    duration: "2 ans",
    rationale: "Traçabilité des décisions : sans elle, aucun recours sérieux n'est instruisible.",
  },
  {
    data: "Statistiques de pages (agrégées)",
    duration: "Indéfinie",
    rationale:
      "Aucun identifiant : elles ne sont pas ré-identifiables et ne sont pas des données personnelles.",
  },
  {
    data: "Sauvegardes après suppression de compte",
    duration: "30 jours",
    rationale:
      "Délai technique de rotation des sauvegardes ; la suppression est effective au-delà.",
  },
  {
    data: "MRR et agrégats publiés",
    duration: "Conservés",
    rationale: "Données publiques par choix du maker, sans identifiant ni donnée client.",
  },
];

export type SubprocessorRow = {
  service: string;
  purpose: string;
  location: string;
  /** Les flux non-transférables sont signalés plutôt que listés comme sous-traitants. */
  note?: string;
};

export const SUBPROCESSOR_ROWS: readonly SubprocessorRow[] = [
  {
    service: "Supabase",
    purpose: "Base de données, authentification, stockage des fichiers de compte",
    location: "Union européenne (Londres, eu-west-2)",
  },
  {
    service: "Vercel",
    purpose: "Hébergement du site",
    location: "États-Unis / Union européenne selon région de déploiement",
  },
  {
    service: "Cloudflare R2",
    purpose: "Médias produits uniquement (logos, captures d'écran)",
    location: "Non spécifiée dans la configuration du projet",
  },
  {
    service: "Resend",
    purpose: "Emails transactionnels (connexion, revue de soumission)",
    location: "États-Unis",
  },
  {
    service: "Sentry",
    purpose: "Suivi des erreurs applicatives",
    location: "États-Unis",
  },
  {
    service: "Upstash Redis",
    purpose: "Limitation de débit (anti-abus, votes, soumissions)",
    location: "Non spécifiée dans la configuration du projet",
  },
  {
    service: "Umami",
    purpose: "Mesure d'audience anonyme",
    location: "Auto-hébergé — aucun transfert vers un tiers",
    note: "Ni cookie, ni traceur, aucun envoi vers un service tiers",
  },
];

/**
 * Ce qui n'est **pas** un sous-traitant — distinction que le texte doit faire
 * explicitement, sinon elle se retourne contre nous.
 *
 * Stripe et RevenueCat sont les prestataires du *maker*, chez qui vont ses
 * propres clés. Nous ne stockons qu'une clé chiffrée et des agrégats : nous ne
 * recevons ni identité de ses clients, ni détail de ses transactions.
 */
export const NOT_SUBPROCESSORS: readonly string[] = [
  "Stripe et RevenueCat, lorsqu'un maker y relie sa facturation : ce sont les prestataires du maker, pas les nôtres. Nous ne recevons qu'une clé chiffrée en lecture seule et des agrégats (MRR, nombre d'abonnés), jamais de donnée client ni de détail de transaction.",
];

export type LegalBasisRow = {
  treatment: string;
  data: string;
  basis: string;
};

export const LEGAL_BASIS_ROWS: readonly LegalBasisRow[] = [
  {
    treatment: "Compte et authentification",
    data: "Email, fournisseur d'authentification, avatar",
    basis: "Exécution du contrat — sans compte, ni vote, ni soumission",
  },
  {
    treatment: "Profil public",
    data: "Nom d'affichage, bio, liens, localisation",
    basis: "Exécution du contrat — c'est la fiche que vous publiez",
  },
  {
    treatment: "Produits et contenus",
    data: "Descriptions, images, catégories, liens",
    basis: "Exécution du contrat — le service est l'annuaire lui-même",
  },
  {
    treatment: "Votes et classement",
    data: "Produit voté, lien durable compte ↔ vote",
    basis: "Exécution du contrat — l'unicité du vote est structurelle",
  },
  {
    treatment: "Revenus vérifiés",
    data: "Clé chiffrée, MRR et nombre d'abonnés agrégés",
    basis: "Exécution du contrat — affichage du badge que vous demandez",
  },
  {
    treatment: "Journaux anti-abus",
    data: "Adresse IP, horodatage, compte",
    basis: "Intérêt légitime — protéger l'intégrité du classement",
  },
  {
    treatment: "Journal de modération et recours",
    data: "Décisions, motifs, échanges",
    basis: "Obligation légale et intérêt légitime — rendre un recours instruisible",
  },
  {
    treatment: "Mesure d'audience",
    data: "Pages vues, adresse IP anonymisée",
    basis: "Intérêt légitime — mesurer sans profiler, aucun cookie",
  },
  {
    treatment: "Emails transactionnels",
    data: "Adresse email, type d'événement",
    basis: "Exécution du contrat — connexion, revue de soumission, sécurité",
  },
  {
    treatment: "Comptabilité des dons",
    data: "Référence de paiement, montant",
    basis: "Obligation légale — obligation de traçabilité comptable",
  },
];

export type StorageRow = {
  name: string;
  purpose: string;
  scope: "essentiel" | "mesure d'audience";
  detail: string;
};

export const STORAGE_ROWS: readonly StorageRow[] = [
  {
    name: "Session d'authentification",
    purpose: "Vous garder connecté",
    scope: "essentiel",
    detail: "Géré par Supabase, nécessaire au fonctionnement du compte",
  },
  {
    name: "Mémorisation de la fermeture de l'avis",
    purpose: "Ne pas réafficher l'avis à chaque visite",
    scope: "essentiel",
    detail: "Stockage local du navigateur, jamais transmis à un serveur",
  },
  {
    name: "Préférence de thème clair / sombre",
    purpose: "Conserver le thème choisi",
    scope: "essentiel",
    detail: "Stockage local du navigateur",
  },
  {
    name: "Mesure d'audience",
    purpose: "Compter les pages vues, sans profilage",
    scope: "mesure d'audience",
    detail:
      "Umami auto-hébergé : aucun cookie, adresse IP anonymisée, aucune donnée de navigation transmise à un tiers",
  },
];
