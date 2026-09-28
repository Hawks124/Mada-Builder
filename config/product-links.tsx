/**
 * Liens par type de produit — SOURCE UNIQUE (formulaire submit, file de
 * revue admin, validation API, doc mobile). Le formulaire n'affiche que
 * le socle + le bloc du type sélectionné (3-5 champs max, le reste
 * n'existe pas à l'écran : invisible = pas de friction).
 *
 * Règles `required` :
 * - "access" : compte pour la règle "au moins un point d'accès" (site OU
 *   store OU registre OU démo OU téléchargement — le formulaire exige un
 *   point d'accès, jamais un champ précis).
 * - "kids" : requis si audience enfants · "monetized" : requis si monétisé
 *   (les stores l'exigent) · "almost" : quasi requis (fortement conseillé,
 *   badge "recommandé") · "never" : optionnel.
 * - `storePattern` : validation de forme côté client+serveur pour les
 *   stores qui bottent les crawlers (Apple/Play) — pas de fetch inutile.
 * - `icon` : clé `store-logo` (brand Simple Icons ou générique Phosphor).
 */

export type LinkRequired = "access" | "kids" | "monetized" | "almost" | "never";

export type LinkFieldDef = {
  id: string;
  label: string;
  placeholder: string;
  hint?: string;
  required: LinkRequired;
  /** Compte comme point d'accès (règle du § ci-dessus). */
  accessPoint?: boolean;
  /** Hosts + motif d'ID pour la validation de forme (stores). */
  storePattern?: { hosts: string[]; idPattern: RegExp };
  icon: string;
  /** Surcharge de `required` pour certains types (ex. docs framework). */
  requiredByType?: Record<string, LinkRequired>;
  /** Libellé du bouton primaire sur la fiche (défaut : label du champ). */
  ctaLabel?: string;
};

export const PRODUCT_LINK_FIELDS: Record<string, LinkFieldDef> = {
  website: {
    id: "website",
    label: "Site web officiel",
    placeholder: "https://votre-app.com",
    required: "access",
    accessPoint: true,
    ctaLabel: "Visiter le site",
    icon: "website",
  },
  source: {
    id: "source",
    label: "Code source",
    placeholder: "https://github.com/vous/projet",
    hint: "Public, source-available ou privé (un repo privé donne un avertissement, jamais un blocage).",
    required: "never",
    icon: "source",
  },
  demo: {
    id: "demo",
    label: "Démo live",
    placeholder: "https://demo.votre-app.com",
    required: "never",
    accessPoint: true,
    icon: "demo",
  },
  docs: {
    id: "docs",
    label: "Documentation",
    placeholder: "https://docs.votre-app.com",
    required: "never",
    requiredByType: { framework: "almost" },
    icon: "docs",
  },
  download: {
    id: "download",
    label: "Téléchargement direct",
    placeholder: "https://votre-app.com/download/app-v1.0.apk",
    hint: "APK, binaire, archive — quand aucun store ne convient.",
    required: "never",
    accessPoint: true,
    icon: "download",
  },
  appstore: {
    id: "appstore",
    label: "Apple App Store",
    placeholder: "https://apps.apple.com/…/id123456789",
    required: "access",
    accessPoint: true,
    storePattern: { hosts: ["apps.apple.com"], idPattern: /\/id\d+/ },
    icon: "appstore",
  },
  playstore: {
    id: "playstore",
    label: "Google Play",
    placeholder: "https://play.google.com/store/apps/details?id=com.vous.app",
    required: "access",
    accessPoint: true,
    storePattern: { hosts: ["play.google.com"], idPattern: /[?&]id=[\w.]+/ },
    icon: "playstore",
  },
  msstore: {
    id: "msstore",
    label: "Microsoft Store",
    placeholder: "https://apps.microsoft.com/…",
    required: "access",
    accessPoint: true,
    storePattern: { hosts: ["apps.microsoft.com"], idPattern: /./ },
    icon: "msstore",
  },
  macstore: {
    id: "macstore",
    label: "Mac App Store",
    placeholder: "https://apps.apple.com/…/id123456789",
    required: "access",
    accessPoint: true,
    storePattern: { hosts: ["apps.apple.com"], idPattern: /\/id\d+/ },
    icon: "macstore",
  },
  flathub: {
    id: "flathub",
    label: "Flathub / Snap",
    placeholder: "https://flathub.org/apps/…",
    required: "access",
    accessPoint: true,
    icon: "flathub",
  },
  registry: {
    id: "registry",
    label: "Registre",
    placeholder: "ex : npm i mon-package",
    hint: "npm, PyPI, crates.io, pub.dev, Packagist, Go, Maven, NuGet, RubyGems…",
    required: "access",
    accessPoint: true,
    icon: "registry",
  },
  endpoint: {
    id: "endpoint",
    label: "URL de l'API",
    placeholder: "https://api.votre-app.com/v1",
    required: "access",
    accessPoint: true,
    icon: "endpoint",
  },
  apimarket: {
    id: "apimarket",
    label: "RapidAPI / Postman",
    placeholder: "https://www.postman.com/…",
    required: "never",
    icon: "apimarket",
  },
  chromestore: {
    id: "chromestore",
    label: "Chrome Web Store",
    placeholder: "https://chromewebstore.google.com/detail/…",
    required: "access",
    accessPoint: true,
    icon: "chrome",
  },
  firefoxaddons: {
    id: "firefoxaddons",
    label: "Firefox Add-ons",
    placeholder: "https://addons.mozilla.org/…",
    required: "access",
    accessPoint: true,
    icon: "firefox",
  },
  edgeaddons: {
    id: "edgeaddons",
    label: "Edge Add-ons",
    placeholder: "https://microsoftedge.microsoft.com/addons/detail/…",
    required: "access",
    accessPoint: true,
    icon: "edge",
  },
  iso: {
    id: "iso",
    label: "Image ISO / firmware",
    placeholder: "https://votre-os.com/download/v1.img",
    required: "access",
    accessPoint: true,
    icon: "iso",
  },
  releases: {
    id: "releases",
    label: "GitHub Releases",
    placeholder: "https://github.com/vous/projet/releases",
    required: "never",
    icon: "releases",
  },
  hf: {
    id: "hf",
    label: "Hugging Face",
    placeholder: "https://huggingface.co/spaces/vous/app",
    hint: "Spaces, Models, Datasets — incontournable IA.",
    required: "access",
    accessPoint: true,
    icon: "hf",
  },
  botinvite: {
    id: "botinvite",
    label: "Lien d'ajout du bot",
    placeholder: "https://t.me/votre_bot",
    required: "access",
    accessPoint: true,
    icon: "botinvite",
  },
  pluginmarket: {
    id: "pluginmarket",
    label: "Marketplace hôte",
    placeholder: "https://marketplace.visualstudio.com/…",
    hint: "VS Code / Open VSX, WordPress, Figma…",
    required: "access",
    accessPoint: true,
    icon: "pluginmarket",
  },
  shop: {
    id: "shop",
    label: "Lien d'achat",
    placeholder: "https://www.tindie.com/…",
    required: "access",
    accessPoint: true,
    icon: "shop",
  },
  itchio: {
    id: "itchio",
    label: "itch.io",
    placeholder: "https://vous.itch.io/jeu",
    required: "access",
    accessPoint: true,
    icon: "itchio",
  },
  steam: {
    id: "steam",
    label: "Steam",
    placeholder: "https://store.steampowered.com/app/…",
    required: "access",
    accessPoint: true,
    icon: "steam",
  },
  gamedemo: {
    id: "gamedemo",
    label: "Démo jouable",
    placeholder: "https://vous.itch.io/jeu (build WebGL)",
    hint: "On ne liste pas un jeu sans y jouer — quasi requise.",
    required: "almost",
    accessPoint: true,
    ctaLabel: "Jouer à la démo",
    icon: "gamedemo",
  },
  video: {
    id: "video",
    label: "Vidéo de présentation",
    placeholder: "https://www.youtube.com/watch?v=…",
    hint: "Bande-annonce ou démo filmée — affichée en grand sur la fiche.",
    required: "never",
    icon: "video",
  },
  mainlink: {
    id: "mainlink",
    label: "Lien principal",
    placeholder: "https://…",
    hint: "Le meilleur point d'entrée quand rien d'autre ne convient.",
    required: "access",
    accessPoint: true,
    icon: "mainlink",
  },
  privacy: {
    id: "privacy",
    label: "Politique de confidentialité",
    placeholder: "Lien vers la Privacy Policy",
    required: "kids",
    icon: "privacy",
  },
  tos: {
    id: "tos",
    label: "Conditions d'utilisation",
    placeholder: "Lien vers les Terms of Service",
    required: "never",
    icon: "tos",
  },
  kidsafety: {
    id: "kidsafety",
    label: "Politique de sécurité enfants",
    placeholder: "URL Politique de sécurité enfants",
    required: "kids",
    icon: "kidsafety",
  },
};

/** Socle affiché pour TOUS les types (avant le bloc spécifique). */
export const BASE_LINK_FIELDS = ["website", "source", "demo", "docs", "download", "video"];

/** Bloc spécifique par type (source unique : formulaire + admin + API). */
export const PRODUCT_LINKS_BY_TYPE: Record<string, string[]> = {
  app_mobile: ["appstore", "playstore"],
  app_web: [],
  saas: [],
  app_desktop: ["msstore", "macstore", "flathub", "releases"],
  cli: ["registry", "releases"],
  package: ["registry"],
  framework: ["registry"],
  api: ["endpoint", "apimarket"],
  extension: ["chromestore", "firefoxaddons", "edgeaddons"],
  os: ["iso", "releases"],
  iot: ["shop", "source"],
  bot: ["hf", "botinvite"],
  plugin: ["pluginmarket"],
  game: ["itchio", "steam", "appstore", "playstore", "gamedemo"],
  other: ["mainlink"],
};

/** Règle effective d'un champ pour un type (surcharge incluse). */
export function requiredFor(field: LinkFieldDef, productType: string): LinkRequired {
  return field.requiredByType?.[productType] ?? field.required;
}

/** Field-ids visibles pour un type : socle + bloc (la section Liens de
    l'admin exclut "video", qui a sa section dédiée — voir appelant). */
export function linkIdsForType(productType: string): string[] {
  return [
    ...BASE_LINK_FIELDS,
    ...(PRODUCT_LINKS_BY_TYPE[productType] ?? PRODUCT_LINKS_BY_TYPE.other ?? []),
  ];
}

/**
 * Règle "au moins un point d'accès" : site OU store OU registre OU démo
 * OU téléchargement. Le formulaire exige UN point d'accès, jamais un
 * champ précis (anti-friction : un CLI npm-only ou un bot Telegram n'a
 * pas de site web).
 */
export function hasAccessPoint(values: Record<string, string | undefined>): boolean {
  return Object.values(PRODUCT_LINK_FIELDS).some(
    (f) => f.accessPoint && (values[f.id] ?? "").trim() !== "",
  );
}

/** Nom d'affichage d'un registre depuis son host (bouton dynamique). */
const REGISTRY_NAMES: Array<[RegExp, string]> = [
  [/npmjs\.com$/, "NPM"],
  [/pypi\.org$/, "PyPI"],
  [/crates\.io$/, "crates.io"],
  [/pub\.dev$/, "pub.dev"],
  [/packagist\.org$/, "Packagist"],
  [/pkg\.go\.dev$/, "Go Modules"],
  [/mvnrepository\.com|repo1\.maven\.org$/, "Maven"],
  [/nuget\.org$/, "NuGet"],
  [/rubygems\.org$/, "RubyGems"],
  [/brew\.sh$/, "Homebrew"],
];

export function registryDisplayName(url: string): string {
  try {
    const host = new URL(url.trim()).hostname.toLowerCase();
    for (const [re, name] of REGISTRY_NAMES) {
      if (re.test(host)) return name;
    }
  } catch {
    // URL incomplète : libellé générique, pas d'erreur.
  }
  return "Registre";
}
