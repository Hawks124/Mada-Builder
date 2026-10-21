import { z } from "zod";
import { and, asc, count, desc, eq, ilike, inArray, isNull, lt, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  products,
  productRevisions,
  productScreenshots,
  productPageViews,
  productLinkClicks,
  productDownloads,
  votes,
  users,
  adminActions,
} from "@/db/schema";
import type { NewProduct } from "@/db/schema";
import type { ProductLinks } from "@/db/schema/products";
import type { DashboardApp } from "@/components/dashboard/dashboard-mock";
import type { ReviewItem } from "@/components/admin/admin-mock";
import { ProfileError, assertNotBanned, getUserProfile } from "@/services/users.service";
import { notifyAdminsReview } from "@/services/notifications.service";
import { PRODUCT_TYPES, type GalleryOrientation } from "@/config/product-types";
import { getProductTypeById } from "@/config/product-types";
import { PRODUCT_CATEGORIES } from "@/config/categories";
import { PLATFORMS } from "@/config/platforms";
import { PRICING_MODELS } from "@/config/pricing";
import { AGE_RATINGS } from "@/config/ratings";
import { PRODUCT_LINK_FIELDS } from "@/config/product-links";
import { hasAccessPoint, requiredFor, downloadBannedFor } from "@/config/product-links";
import { isMonetizedPricing } from "@/config/pricing";
import { isCurationAccount } from "@/config/curation";
import { checkUrl, classifyForSubmit, matchStorePattern } from "@/services/url-check.service";
import { checkLimit } from "@/lib/ratelimit";
import { isUniqueViolation } from "@/lib/api/idempotency";
import { waitingFr } from "@/lib/utils";

export { waitingFr };
import {
  ImageRejectedError,
  classifyShotOrientation,
  detectImageKind,
  measureImage,
  processImage,
} from "@/lib/images";
import type { ShotOrientation } from "@/lib/images";
import { sanitizeImportedMarkdown } from "@/lib/readme-import";
import {
  PRODUCT_BUILDS_BUCKET,
  PRODUCT_LOGOS_BUCKET,
  PRODUCT_SHOTS_BUCKET,
  assertR2Public,
  deleteR2Object,
  getR2Object,
  listR2Keys,
  putR2Object,
  r2Configured,
  r2Key,
} from "@/lib/r2";

/**
 * Purge best-effort des APK d'un produit (D6) : les lignes builds
 * partent en cascade SQL avec la fiche, les objets R2 partent ici
 * (jamais d'APK orphelin facturé). Échec silencieux : le balayeur
 * `sweepR2Orphans` repasse (bucket builds couvert).
 */
async function purgeProductBuildObjects(makerId: string, productId: string): Promise<void> {
  try {
    const keys = await listR2Keys(PRODUCT_BUILDS_BUCKET, 500, `builds/${makerId}/${productId}/`);
    await Promise.all(keys.map((k) => deleteR2Object(PRODUCT_BUILDS_BUCKET, k).catch(() => {})));
  } catch {
    // Best-effort : le balayeur repassera.
  }
}

/**
 * Purge R2 de TOUS les produits d'un maker (delete compte, §legal) :
 * logos, captures, APKs. Lignes DB partent en cascade SQL ; SANS cet
 * appel, elles laisseraient des orphelins R2 (la promesse « les copies
 * sur le stockage suivent la purge » serait rompue). Best-effort :
 * le balayeur `sweepR2Orphans` repasse. Exportée pour les actions de
 * suppression de compte (jamais dans users.service : cycle d'imports).
 */
export async function purgeUserProductObjects(makerId: string): Promise<void> {
  try {
    const owned = await db
      .select({ id: products.id, iconUrl: products.iconUrl })
      .from(products)
      .where(eq(products.makerId, makerId));
    await Promise.all(
      owned.map(async (p) => {
        const shots = await db
          .select({ url: productScreenshots.url })
          .from(productScreenshots)
          .where(eq(productScreenshots.productId, p.id))
          .catch(() => []);
        for (const s of shots) {
          const key = r2KeyFromUrl(s.url);
          if (key) await deleteR2Object(PRODUCT_SHOTS_BUCKET, key).catch(() => {});
        }
        if (p.iconUrl) {
          const key = r2KeyFromUrl(p.iconUrl);
          if (key) await deleteR2Object(PRODUCT_LOGOS_BUCKET, key).catch(() => {});
        }
        await purgeProductBuildObjects(makerId, p.id);
      }),
    );
  } catch {
    // Best-effort : le balayeur repassera.
  }
}
import { captureError } from "@/lib/monitoring";

/**
 * Domaine products — même contrat que users.service : jamais de session
 * ici (viewerId/isStaff fournis), Drizzle + Zod + R2, erreurs ProfileError
 * (codes stables → enveloppe API + toasts). RLS deny-all en écriture :
 * tout passe par ces fonctions.
 */

const TYPE_IDS = new Set(PRODUCT_TYPES.map((t) => t.id));
/**
 * Orientation de départ d'un type : imposée si fixe, `defaultOrientation`
 * si "both". C'est une SUGGESTION, pas un verrou — le maker peut
 * changer l'orientation de sa galerie quand il veut ; la barrière, elle,
 * reste entière : une fois l'orientation choisie, TOUTES les captures
 * doivent la respecter (portrait ⇒ portrait only, paysage ⇒ paysage
 * only) — cf. `uploadProductFiles` et la purge au basculement.
 */
const DEFAULT_ORIENTATION = new Map<string, GalleryOrientation>(
  PRODUCT_TYPES.map((t) => [
    t.id,
    t.orientation === "both" ? (t.defaultOrientation ?? "landscape") : t.orientation,
  ]),
);
const CATEGORY_IDS = new Set(PRODUCT_CATEGORIES.map((c) => c.id));
const PLATFORM_IDS = new Set(PLATFORMS.map((p) => p.id));
const PRICING_IDS = new Set(PRICING_MODELS.map((p) => p.id));
function defaultOrientationFor(productType: string): GalleryOrientation {
  return DEFAULT_ORIENTATION.get(productType) ?? "landscape";
}
const AUDIENCE_IDS = new Set(AGE_RATINGS.map((r) => r.id));

const optionalUrlSchema = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.url().max(2048).optional(),
);

/**
 * Liens : record field-id matrice → URL. Clés inconnues REFUSÉES (pas de
 * champ fantôme en DB) ; chaque valeur = URL valide. La matrice
 * (labels, required, storePattern) vit dans config/product-links.
 */
export const KNOWN_LINK_IDS = new Set(Object.keys(PRODUCT_LINK_FIELDS));

/**
 * Champs liens d'un objet brut (FormData converti, multipart mobile) :
 * - présents et non vides → valeur ;
 * - présents mais VIDES → effacement explicite (`cleared`) ;
 * - absents → non envoyés (le mode « merge » les conserve).
 *
 * `undefined` = aucun champ lien dans la payload → PATCH : on ne touche
 * à rien.
 *
 * Pourquoi la distinction : le formulaire WEB envoie TOUS les champs
 * (un champ vidé = « efface ce lien »), donc son résultat est identique
 * en remplacement total. L'API mobile, elle, n'envoie que les champs
 * qu'elle modifie : sans `cleared`, un simple remplacement total
 * EFFACERAIT tous les autres liens de la fiche (le mobile perdait des
 * liens à chaque édition — « le mobile sera incohérent »).
 */
export type ParsedLinkFields = {
  /** Valeurs non vides envoyées (id → URL). */
  links: Record<string, string>;
  /** Ids présents mais vides = effacement explicite. */
  cleared: string[];
};

export function parseLinkFields(input: unknown): ParsedLinkFields | undefined {
  if (typeof input !== "object" || input === null) return undefined;
  const rec = input as Record<string, unknown>;
  const links: Record<string, string> = {};
  const cleared: string[] = [];
  let seen = false;
  for (const id of KNOWN_LINK_IDS) {
    if (!(id in rec)) continue;
    seen = true;
    const v = rec[id];
    if (typeof v === "string" && v.trim() !== "") links[id] = v.trim();
    else cleared.push(id);
  }
  return seen ? { links, cleared } : undefined;
}

/**
 * Variante FormData (web ou mobile multipart) : même contrat, zéro
 * dérive. Vit ici (module serveur pur) car les fichiers "use server"
 * n'exportent que des fonctions async.
 */
export function parseProductLinkFields(formData: FormData): ParsedLinkFields | undefined {
  const obj: Record<string, unknown> = {};
  for (const id of Object.keys(PRODUCT_LINK_FIELDS)) {
    const v = formData.get(id);
    if (v !== null) obj[id] = v;
  }
  return parseLinkFields(obj);
}

const linksSchema = z
  .record(z.string(), z.string())
  .refine((rec) => Object.keys(rec).every((id) => KNOWN_LINK_IDS.has(id)), "Champ de lien inconnu")
  .refine(
    (rec) =>
      Object.values(rec).every((v) => typeof v === "string" && v.trim() !== "" && v.length <= 2048),
    "URL invalide.",
  )
  .refine(
    (rec) =>
      Object.values(rec).every((v) => {
        try {
          const u = new URL(v.trim());
          return u.protocol === "http:" || u.protocol === "https:";
        } catch {
          return false;
        }
      }),
    "URL invalide (http(s) uniquement).",
  )
  .transform((rec) => Object.fromEntries(Object.entries(rec).map(([id, v]) => [id, v.trim()])));

/** Labels FR des champs (erreurs nommées : jamais de « Champs invalides » nu). */
const FIELD_LABELS_FR: Record<string, string> = {
  name: "Nom",
  tagline: "Tagline",
  description: "Description",
  productType: "Type de produit",
  lifecycle: "Avancement",
  audience: "Audience",
  category: "Catégorie",
  categories: "Catégories",
  tags: "Tags",
  platforms: "Plateformes",
  pricingModel: "Modèle économique",
  license: "Licence",
  installCommand: "Commande d'installation",
  version: "Version",
  requirements: "Configuration requise",
  changelogUrl: "Journal des modifications",
  hasAds: "Publicités",
  sharesData: "Partage de données",
  hasInAppPurchase: "Achats in-app",
  targetCountries: "Pays cibles",
  languagesSupported: "Langues",
  galleryOrientation: "Orientation",
  links: "Liens",
};

/**
 * Première erreur Zod en français nommé (« Tagline : trop court »).
 * Le prochain champ mal mappé se diagnostique en 10 secondes.
 */
export function zodFieldMessage(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Champs invalides.";
  const key = String(issue.path[0] ?? "");
  const label = FIELD_LABELS_FR[key] ?? (key !== "" ? key : "Formulaire");
  if (issue.code === "too_small") {
    const min = typeof issue.minimum === "number" ? issue.minimum : null;
    return min !== null && min > 1
      ? `${label} : trop court (min ${min} caractères).`
      : `${label} : requis.`;
  }
  if (issue.code === "too_big") {
    const max = typeof issue.maximum === "number" ? issue.maximum : null;
    return max !== null ? `${label} : trop long (max ${max} caractères).` : `${label} : trop long.`;
  }
  if (issue.code === "invalid_type") return `${label} : requis.`;
  if (issue.code === "custom" || issue.code === "invalid_format") {
    return `${label} : ${issue.message}`;
  }
  return `${label} : invalide.`;
}

export const submitProductSchema = z.object({
  name: z.string().trim().min(2).max(80),
  tagline: z.string().trim().min(1).max(220),
  description: z.string().trim().min(20).max(20000),
  productType: z.string().refine((id) => TYPE_IDS.has(id), "Type inconnu"),
  category: z.string().refine((id) => CATEGORY_IDS.has(id), "Catégorie inconnue"),
  categories: z
    .array(z.string())
    .max(3)
    .refine((ids) => ids.every((id) => CATEGORY_IDS.has(id)), "Catégorie inconnue")
    .optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).optional(),
  platforms: z
    .array(z.string())
    .min(1, "Au moins une plateforme.")
    .max(10)
    .refine((ids) => ids.every((id) => PLATFORM_IDS.has(id)), "Plateforme inconnue"),
  pricingModel: z.string().refine((id) => PRICING_IDS.has(id), "Modèle inconnu"),
  lifecycle: z.string().refine((id) => ["dev", "beta", "live"].includes(id), "Avancement inconnu"),
  audience: z.string().refine((id) => AUDIENCE_IDS.has(id), "Audience inconnue"),
  license: z.string().trim().max(60).optional(),
  installCommand: z.string().trim().max(200).optional(),
  version: z.string().trim().max(20).optional(),
  requirements: z.array(z.string().trim().min(1).max(80)).max(8).optional(),
  // Changelog (champ metadata, pas matrice) : fusionné dans links à
  // l'insertion — UNE seule source en lecture (même forme que le submit).
  changelogUrl: optionalUrlSchema,
  hasAds: z.boolean().optional(),
  hasInAppPurchase: z.boolean().optional(),
  // Toggle formulaire câblé (review phases 1+2) : déclaration réelle.
  sharesData: z.boolean().optional(),
  isChildDirected: z.boolean().optional(),
  // Orientation déclarée de la galerie (FormData `galleryOrientation`,
  // pilotée par le type — le toggle n'est actif que pour les types "both").
  galleryOrientation: z.enum(["portrait", "landscape"]),
  targetCountries: z.array(z.string().trim().max(60)).max(10).optional(),
  languagesSupported: z.array(z.string().trim().max(30)).max(20).optional(),
  links: linksSchema.optional(),
  /**
   * Ids de liens explicitement VIDES dans la payload = effacement
   * (mode « merge », API mobile). Absent = remplacement total (web).
   * Écriture seule : jamais renvoyé en lecture.
   */
  clearedLinks: z
    .array(z.string())
    .max(40)
    .refine((ids) => ids.every((id) => KNOWN_LINK_IDS.has(id)), "Lien inconnu")
    .optional(),
  /**
   * Mode d'écriture des liens — décidé par l'APPELANT, jamais déduit de
   * la forme de la payload.
   *
   * - "replace" (formulaire web) : le formulaire envoie TOUS les champs
   *   liens, un champ vide = « efface » → le résultat est le formulaire.
   * - "merge" (API mobile) : le mobile n'envoie que les champs qu'il
   *   modifie ; les absents sont CONSERVÉS, les champs vides effacés.
   *
   * Le déduire de la payload (« y a-t-il un `clearedLinks` ? ») était le
   * bug : une PATCH mobile avec seulement `changelogUrl` (aucun champ
   * lien) tombait en « replace » → les liens de la fiche partaient avec,
   * et la révision devenait inapprovable (plus de point d'accès).
   */
  linksMode: z.enum(["replace", "merge"]).optional(),
});

/**
 * Brouillon = travail en cours (`submitProductSchema` reste le contrat de
 * PUBLICATION, inchangé). Un seul champ strictement nécessaire : `name`
 * (identité + slug). Tout le reste retombe sur les valeurs par défaut —
 * celles de la base (`platforms` `[]`, `pricingModel` "free", `lifecycle`
 * "live", `audience` "all", orientation pilotée par le type). Un brouillon
 * peut donc être un simple nom ; les badges « Requis » de l'UI décrivent
 * la publication, pas l'enregistrement d'une saisie en cours.
 */
export const submitDraftSchema = z.object({
  name: z.string().trim().min(2).max(80),
  productType: z.string().refine((id) => TYPE_IDS.has(id), "Type inconnu"),
  // notNull en base, valeur neutre : un brouillon n'est jamais public.
  tagline: z.string().trim().max(220).default(""),
  description: z.string().trim().max(20000).default(""),
  // Alimente `categories[0]` (notNull) : repli sur la 1re catégorie tant
  // que le maker n'en a pas choisi — exigée au publish.
  category: z
    .string()
    .refine((id) => CATEGORY_IDS.has(id), "Catégorie inconnue")
    .default(PRODUCT_CATEGORIES[0]?.id ?? ""),
  categories: z
    .array(z.string())
    .max(3)
    .refine((ids) => ids.every((id) => CATEGORY_IDS.has(id)), "Catégorie inconnue")
    .optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(10).optional(),
  platforms: z
    .array(z.string())
    .max(10)
    .refine((ids) => ids.every((id) => PLATFORM_IDS.has(id)), "Plateforme inconnue")
    .default([]),
  pricingModel: z
    .string()
    .default("free")
    .refine((id) => PRICING_IDS.has(id), "Modèle inconnu"),
  lifecycle: z
    .string()
    .default("live")
    .refine((id) => ["dev", "beta", "live"].includes(id), "Avancement inconnu"),
  audience: z
    .string()
    .default("all")
    .refine((id) => AUDIENCE_IDS.has(id), "Audience inconnue"),
  license: z.string().trim().max(60).optional(),
  installCommand: z.string().trim().max(200).optional(),
  version: z.string().trim().max(20).optional(),
  requirements: z.array(z.string().trim().min(1).max(80)).max(8).optional(),
  changelogUrl: optionalUrlSchema,
  hasAds: z.boolean().optional(),
  hasInAppPurchase: z.boolean().optional(),
  sharesData: z.boolean().optional(),
  isChildDirected: z.boolean().optional(),
  // Absent en brouillon si le maker n'a pas touché au toggle : résolu par
  // le type (`defaultOrientationFor`) juste après le parse.
  galleryOrientation: z.enum(["portrait", "landscape"]).optional(),
  targetCountries: z.array(z.string().trim().max(60)).max(10).optional(),
  languagesSupported: z.array(z.string().trim().max(30)).max(20).optional(),
  links: linksSchema.optional(),
});

export type SubmitProductInput = z.infer<typeof submitProductSchema>;

// ── Slugs ─────────────────────────────────────────────────────────────────
function slugBase(name: string): string {
  const base =
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "produit";
  return base;
}

async function freshProductSlug(name: string): Promise<string> {
  const base = slugBase(name);
  for (let suffix = 0; suffix < 100; suffix++) {
    const candidate = suffix === 0 ? base : `${base}-${suffix}`;
    const [exists] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.slug, candidate))
      .limit(1);
    if (!exists) return candidate;
  }
  return `${base}-${Math.floor(Math.random() * 1_000_000)}`;
}

// ── Liens : forme stores + atteignabilité ─────────────────────────────────
// Entrée = record field-id matrice (même forme que le formulaire et la
// fiche admin — zéro mapping vers des colonnes, zéro perte).
/**
 * Règles matrice appliquées serveur (les badges/pastilles client ne
 * suffisent pas) : point d'accès exigé + champs conditionnels (kids,
 * monétisé) + privacy si monétisé. Publications et éditions de fiches
 * en ligne uniquement — drafts/pending exemptés (travail en cours, la
 * revue tranche). Exportée pour tests purs (zéro DB/réseau).
 */
export function assertLinkRules(opts: {
  productType: string;
  audience: string;
  pricingModel: string;
  /** Absent = pas de ban (tests purs historiques). */
  platforms?: string[];
  links: Record<string, string>;
}): void {
  const dlBanned = downloadBannedFor(opts.platforms ?? []);
  // Anti-contournement revue binaire : aucun lien direct sur Android
  // (ni au submit ni à l'édition — l'API mobile ne doit pas contourner
  // le masquage du formulaire).
  if (dlBanned && (opts.links.download ?? "").trim() !== "") {
    throw new ProfileError(
      "VALIDATION",
      "Téléchargement direct interdit pour Android : distribuez via le Play Store ou soumettez l'APK à la revue.",
    );
  }
  if (!hasAccessPoint(opts.links, { ignoreDownload: dlBanned })) {
    throw new ProfileError(
      "VALIDATION",
      "Au moins un point d'accès requis : site, store, registre ou démo.",
    );
  }
  const monetized = isMonetizedPricing(opts.pricingModel);
  for (const field of Object.values(PRODUCT_LINK_FIELDS)) {
    const eff = requiredFor(field, opts.productType);
    const needed =
      (eff === "kids" && opts.audience === "kids") || (eff === "monetized" && monetized);
    if (needed && !(opts.links[field.id] ?? "").trim()) {
      const why = eff === "kids" ? "audience enfants" : "produit monétisé";
      throw new ProfileError("VALIDATION", `${field.label} : requis (${why}).`);
    }
  }
  // Privacy si monétisé : aucun champ matrice ne porte "monetized" (la
  // matrice ne connaît que kids/access), mais les stores l'exigent dès
  // qu'on encaisse — règle explicite, miroir du badge UI.
  if (monetized && !(opts.links.privacy ?? "").trim()) {
    throw new ProfileError(
      "VALIDATION",
      "Politique de confidentialité : requise (produit monétisé).",
    );
  }
}

/** Comparaison de maps insensible à l'ordre des clés (anti re-revue fantôme). */
function canonicalLinks(record: Record<string, string>): string {
  return JSON.stringify(
    Object.keys(record)
      .sort()
      .map((k) => [k, record[k]]),
  );
}

/**
 * Vérifie chaque URL renseignée (cache-first) : forme store d'abord
 * (pas cher), atteignabilité ensuite. `block` → VALIDATION nommant le
 * champ (FR) ; `warn` → autorisé (la revue re-vérifie à frais).
 */
async function assertLinksReachable(links: Record<string, string>): Promise<void> {
  for (const [fieldId, url] of Object.entries(links)) {
    const field = PRODUCT_LINK_FIELDS[fieldId];
    if (!field) continue; // Impossible (Zod), ceinture.
    if (field.storePattern && !matchStorePattern(url, field.storePattern)) {
      throw new ProfileError("VALIDATION", `${field.label} : pas une URL valide pour ce store.`);
    }
    let verdict: Awaited<ReturnType<typeof checkUrl>>["verdict"];
    try {
      ({ verdict } = await checkUrl(url));
    } catch (e) {
      captureError(e instanceof Error ? e : new Error(String(e)), { op: "products.linkcheck" });
      continue; // Vérificateur en panne : la revue humaine tranche.
    }
    if (classifyForSubmit(verdict) === "block") {
      throw new ProfileError("VALIDATION", `${field.label} : lien injoignable (${verdict}).`);
    }
  }
}

// ── Fichiers ──────────────────────────────────────────────────────────────
// Logo : contain carré sur fond transparent (jamais de recadrage — un
// wordmark large ne doit pas être coupé), 256 px min (comme l'UI promet).
// Le GIF n'est PAS accepté ici : un logo animé n'apporte rien et le
// passthrough du GIF sauterait le recadrage carré (tuile non carrée).
const LOGO_OPTS = {
  maxInputBytes: 10 * 1024 * 1024,
  minPx: 256,
  outPx: 512,
  outQuality: 82,
  maxOutBytes: 2 * 1024 * 1024,
  fit: "contain-square",
} as const;
// Captures : ratio source préservé (inside, côté long ≤ 1600), côté court
// ≥ 400 px (200 px pour un GIF animé, format lourd par nature).
// L'uniformité par fiche est imposée par l'orientation déclarée
// (rejet des intrus, jamais de recadrage) — pas par la sortie.
const SHOT_OPTS = {
  maxInputBytes: 10 * 1024 * 1024,
  minPx: 400,
  outPx: 1600,
  outQuality: 80,
  maxOutBytes: 4 * 1024 * 1024,
  fit: "inside",
  maxLongEdge: 1600,
  allowGif: true,
} as const;
const MAX_SHOTS = 6;

export type PreparedShot = {
  url: string;
  /** Orientation mesurée (= déclarée — les intrus sont rejetés en amont). */
  orientation: ShotOrientation;
  width: number;
  height: number;
};

type PreparedFiles = { logoUrl: string | null; shots: PreparedShot[] };

/**
 * Upload logo + captures : mesure chaque capture AVANT traitement —
 * hors orientation déclarée = rejet nommé (jamais de recadrage, jamais
 * de mix sur une fiche). Clés toujours `.webp` (le contenu est du WebP,
 * l'extension suit le contenu, pas la source).
 */
async function uploadProductFiles(
  productId: string,
  logo: File | null,
  screenshots: File[],
  declared: ShotOrientation,
): Promise<PreparedFiles> {
  if (!r2Configured()) {
    throw new ProfileError("VALIDATION", "Upload indisponible (stockage non configuré).");
  }
  if (screenshots.length > MAX_SHOTS) {
    throw new ProfileError("VALIDATION", `${MAX_SHOTS} captures maximum.`);
  }
  const declaredFr = declared === "portrait" ? "portrait" : "paysage";
  // Mesure d'abord (tout ou rien) : aucun upload partiel en cas d'intrus.
  const measured: Array<{
    file: File;
    width: number;
    height: number;
    orientation: ShotOrientation;
  }> = [];
  let pos = 0;
  for (const file of screenshots) {
    pos++;
    const n = pos;
    const buffer = Buffer.from(await file.arrayBuffer());
    const kind = detectImageKind(buffer);
    if (!kind) {
      throw new ProfileError(
        "FILE_REJECTED",
        `Capture ${n} : format non supporté — PNG, JPG, WebP ou GIF uniquement.`,
      );
    }
    const { width, height } = await measureImage(buffer).catch(() => {
      throw new ProfileError("FILE_REJECTED", `Capture ${n} : image illisible ou corrompue.`);
    });
    const orientation = classifyShotOrientation(width, height, declared);
    if (orientation !== declared) {
      const gotFr = orientation === "portrait" ? "portrait" : "paysage";
      throw new ProfileError(
        "FILE_REJECTED",
        `Capture ${n} : orientation ${gotFr} rejetée — la galerie est en ${declaredFr}. Basculez l'orientation en ${gotFr} pour l'ajouter.`,
      );
    }
    measured.push({ file, width, height, orientation });
  }
  const out: PreparedFiles = { logoUrl: null, shots: [] };
  const uploaded: Array<{
    bucket: typeof PRODUCT_LOGOS_BUCKET | typeof PRODUCT_SHOTS_BUCKET;
    key: string;
  }> = [];
  const track = async <T>(
    bucket: typeof PRODUCT_LOGOS_BUCKET | typeof PRODUCT_SHOTS_BUCKET,
    key: string,
    p: Promise<T>,
  ): Promise<T> => {
    const v = await p;
    uploaded.push({ bucket, key });
    return v;
  };
  try {
    // Uploads en PARALLÈLE (7 PUT séquentiels sur une liaison lente =
    // 49 s constatés). L'ordre des captures est préservé (Promise.all
    // ordonné) ; le rollback purge tout ce qui a été tracké.
    const logoTask = logo
      ? (async () => {
          const buffer = Buffer.from(await logo.arrayBuffer());
          const processed = await processImage(buffer, { ...LOGO_OPTS }).catch((e) => {
            if (e instanceof ImageRejectedError)
              throw new ProfileError("FILE_REJECTED", `Logo : ${e.message}`);
            throw e;
          });
          const key = r2Key(productId, "logo", "webp");
          return track(
            PRODUCT_LOGOS_BUCKET,
            key,
            putR2Object(PRODUCT_LOGOS_BUCKET, key, processed, "image/webp"),
          );
        })()
      : Promise.resolve(null);
    const shotTasks = measured.map(async (m, idx) => {
      const n = idx + 1;
      const buffer = Buffer.from(await m.file.arrayBuffer());
      const processed = await processImage(buffer, { ...SHOT_OPTS }).catch((e) => {
        if (e instanceof ImageRejectedError)
          throw new ProfileError("FILE_REJECTED", `Capture ${n} : ${e.message}`);
        throw e;
      });
      // GIF : `processImage` renvoie les octets d'origine (animation
      // préservée) — la clé et le content-type doivent donc suivre le
      // format réel, pas WebP.
      const ext = detectImageKind(buffer) === "gif" ? "gif" : "webp";
      const contentType = ext === "gif" ? "image/gif" : "image/webp";
      const key = r2Key(productId, `shot-${n}`, ext);
      const url = await track(
        PRODUCT_SHOTS_BUCKET,
        key,
        putR2Object(PRODUCT_SHOTS_BUCKET, key, processed, contentType),
      );
      // Dimensions de sortie (inside + withoutEnlargement : jamais au-delà
      // de la source) — recalculées, pas supposées.
      const outDims = await measureImage(processed).catch(() => ({
        width: m.width,
        height: m.height,
      }));
      return {
        url,
        orientation: m.orientation,
        width: outDims.width,
        height: outDims.height,
      };
    });
    const [logoUrl, shotResults] = await Promise.all([logoTask, Promise.all(shotTasks)]);
    out.logoUrl = logoUrl;
    out.shots = shotResults;
    // Garde post-upload (jamais de fiche cassée en silence) : chaque URL
    // stockée doit répondre (HEAD). Échec = VALIDATION franche + purge
    // (le catch ci-dessous nettoie `uploaded`).
    const storedUrls = [
      ...(out.logoUrl ? [{ url: out.logoUrl, label: "Logo" }] : []),
      ...out.shots.map((s, i) => ({ url: s.url, label: `Capture ${i + 1}` })),
    ];
    try {
      await Promise.all(storedUrls.map(({ url, label }) => assertR2Public(url, label)));
    } catch (e) {
      throw new ProfileError(
        "VALIDATION",
        e instanceof Error ? e.message : "Images injoignables après upload.",
      );
    }
    return out;
  } catch (e) {
    // Échec à mi-chemin : purger les objets déjà poussés (pas d'orphelins).
    await Promise.all(uploaded.map(({ bucket, key }) => deleteR2Object(bucket, key)));
    throw e;
  }
}

export type StagedMedia = {
  logo?: string | null;
  screenshots?: string[];
};

/**
 * Bascule d'orientation : purge les captures MESURÉES dans l'autre
 * orientation (lignes + objets R2). Une fiche n'est jamais mixte — le
 * type peut imposer l'orientation, le maker la choisit quand le type est
 * "both" ; dans les deux cas la galerie reste homogène. Le refus
 * « fournissez de nouvelles captures » a été remplacé par ce purge : le
 * maker garde son choix, les images incompatibles partent (R2 compris,
 * donc aucun orphelin).
 */
async function purgeScreenshotsOffOrientation(
  productId: string,
  orientation: GalleryOrientation,
): Promise<number> {
  const stale = await db
    .select({ url: productScreenshots.url })
    .from(productScreenshots)
    .where(
      and(
        eq(productScreenshots.productId, productId),
        ne(productScreenshots.orientation, orientation),
      ),
    );
  if (stale.length === 0) return 0;
  for (const s of stale) {
    const key = r2KeyFromUrl(s.url);
    if (key) await deleteR2Object(PRODUCT_SHOTS_BUCKET, key).catch(() => {});
  }
  await db
    .delete(productScreenshots)
    .where(
      and(
        eq(productScreenshots.productId, productId),
        ne(productScreenshots.orientation, orientation),
      ),
    );
  return stale.length;
}

const STAGED_KEY_RE = /^staging\/[0-9a-f-]{36}\/\d+-[a-z0-9]+\.(png|jpg|webp|gif)$/;
const STAGED_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

/**
 * Clés staging → File (Phase 6) : préfixe `staging/{maker}/` vérifié
 * (jamais de lecture hors de son espace), download R2, re-validation
 * complète par le pipeline existant (magic-bytes, taille, orientation —
 * le staging ne fait confiance à rien). Suppression staging après succès
 * (échec → balayeur 24 h).
 */
async function resolveStagedMedia(
  viewerId: string,
  staged: StagedMedia,
): Promise<{
  logo: File | null;
  screenshots: File[];
  stagedKeys: Array<{
    bucket: typeof PRODUCT_LOGOS_BUCKET | typeof PRODUCT_SHOTS_BUCKET;
    key: string;
  }>;
}> {
  const out: {
    logo: File | null;
    screenshots: File[];
    stagedKeys: Array<{
      bucket: typeof PRODUCT_LOGOS_BUCKET | typeof PRODUCT_SHOTS_BUCKET;
      key: string;
    }>;
  } = { logo: null, screenshots: [], stagedKeys: [] };
  const load = async (
    key: string,
    bucket: typeof PRODUCT_LOGOS_BUCKET | typeof PRODUCT_SHOTS_BUCKET,
    name: string,
  ): Promise<File> => {
    if (!STAGED_KEY_RE.test(key) || !key.startsWith(`staging/${viewerId}/`)) {
      throw new ProfileError("VALIDATION", "Clé staging invalide.");
    }
    const buffer = await getR2Object(bucket, key).catch(() => {
      throw new ProfileError("VALIDATION", "Fichier staging introuvable ou expiré.");
    });
    const ext = key.split(".").pop() ?? "webp";
    out.stagedKeys.push({ bucket, key });
    // Copie ArrayBuffer frais (typé strict pour File/BlobPart).
    const bytes = new Uint8Array(buffer).slice();
    return new File([bytes], `${name}.${ext}`, { type: STAGED_MIME[ext] ?? "image/webp" });
  };
  if (staged.logo) out.logo = await load(staged.logo, PRODUCT_LOGOS_BUCKET, "logo");
  for (const [i, key] of (staged.screenshots ?? []).entries()) {
    out.screenshots.push(await load(key, PRODUCT_SHOTS_BUCKET, `shot-${i + 1}`));
  }
  return out;
}

async function cleanupStaged(
  stagedKeys: Array<{
    bucket: typeof PRODUCT_LOGOS_BUCKET | typeof PRODUCT_SHOTS_BUCKET;
    key: string;
  }>,
): Promise<void> {
  await Promise.all(
    stagedKeys.map(({ bucket, key }) => deleteR2Object(bucket, key).catch(() => {})),
  );
}

// ── Soumission ────────────────────────────────────────────────────────────
export async function submitProduct(input: {
  viewerId: string;
  data: unknown;
  logo?: File | null;
  screenshots?: File[];
  staged?: StagedMedia;
  asDraft: boolean;
}): Promise<{ id: string; slug: string; status: string }> {
  await assertNotBanned(input.viewerId);
  try {
    const { allowed } = await checkLimit({
      namespace: "products:submit",
      id: input.viewerId,
      window: { window: "60 m", max: 10 },
    });
    if (!allowed) {
      throw new ProfileError("FORBIDDEN", "Trop de soumissions. Réessayez dans une heure.");
    }
  } catch (e) {
    if (e instanceof ProfileError) throw e;
    captureError(e instanceof Error ? e : new Error(String(e)), { op: "products.ratelimit" });
    // Limiteur en panne : on laisse passer (fail-open documenté).
  }
  const rawData =
    input.data !== null &&
    typeof input.data === "object" &&
    !Array.isArray(input.data) &&
    typeof (input.data as Record<string, unknown>).description === "string"
      ? {
          ...(input.data as Record<string, unknown>),
          description: sanitizeImportedMarkdown(
            (input.data as Record<string, unknown>).description as string,
          ).text,
        }
      : input.data;
  // Brouillon : schéma allégé (travail en cours, MediaField contraints
  // seulement au publish). Publication : `submitProductSchema` strict.
  const parsed = (input.asDraft ? submitDraftSchema : submitProductSchema).safeParse(rawData);
  if (!parsed.success) {
    throw new ProfileError("VALIDATION", zodFieldMessage(parsed.error));
  }
  const data = parsed.data;
  // Brouillon sans toggle touché : orientation déduite du type (notNull en base).
  const galleryOrientation = data.galleryOrientation ?? defaultOrientationFor(data.productType);
  // Pas de garde d'orientation ici : le type SUGGÈRE une orientation, il ne
  // l'impose plus — le maker bascule librement (la barrière ratio, elle,
  // reste appliquée au moment de l'upload).
  // Staging présigné (mobile) : clés → File, mergés aux directs.
  const staged = input.staged
    ? await resolveStagedMedia(input.viewerId, input.staged)
    : { logo: null, screenshots: [], stagedKeys: [] };
  const logo = input.logo ?? staged.logo;
  const screenshots = [...(input.screenshots ?? []), ...staged.screenshots];
  const needsMedia = !input.asDraft;
  if (needsMedia && !logo) {
    throw new ProfileError("VALIDATION", "Logo requis pour publier (brouillon accepté sans).");
  }
  if (needsMedia && screenshots.length === 0) {
    throw new ProfileError("VALIDATION", "Au moins une capture requise pour publier.");
  }
  const links: Record<string, string> = { ...(data.links ?? {}) };
  if (data.changelogUrl) links.changelog = data.changelogUrl;
  if (!input.asDraft) {
    // Publish : règles matrice (point d'accès + champs conditionnels).
    // Draft : travail en cours — la reachability attendra la publication
    // (un lien en maintenance ne doit pas bloquer une sauvegarde).
    assertLinkRules({
      productType: data.productType,
      audience: data.audience,
      pricingModel: data.pricingModel,
      platforms: data.platforms,
      links,
    });
    await assertLinksReachable(links);
  }

  const [maker] = await db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(eq(users.id, input.viewerId))
    .limit(1);
  if (!maker) throw new ProfileError("NOT_FOUND", "Compte introuvable.");

  const slug = await freshProductSlug(data.name);
  const categories =
    data.categories && data.categories.length > 0 ? data.categories : [data.category];
  const values = {
    slug,
    makerId: maker.id,
    name: data.name,
    tagline: data.tagline,
    description: data.description,
    category: categories[0],
    categories,
    tags: data.tags ?? [],
    // Plateformes ET configuration requise : ces deux clés ÉTAIENT
    // ABSENTES de l'objet inserté — l'INSERT les omettait et le défaut
    // SQL (`platforms` = []) s'appliquait. Les plateformes étaient
    // donc validées puis jetées à la création, en brouillon comme en
    // publication (constaté sur des fiches réelles sans plateforme).
    platforms: data.platforms,
    requirements: data.requirements ?? [],
    productType: data.productType as NewProduct["productType"],
    pricingModel: data.pricingModel as NewProduct["pricingModel"],
    lifecycle: data.lifecycle as NewProduct["lifecycle"],
    audience: data.audience,
    license: data.license,
    hasAds: data.hasAds ?? false,
    hasInAppPurchase: data.hasInAppPurchase ?? false,
    sharesData: data.sharesData ?? false,
    isChildDirected: data.isChildDirected ?? false,
    installCommand: data.installCommand,
    version: data.version,
    targetCountries: data.targetCountries ?? [],
    languagesSupported: data.languagesSupported ?? [],
    links,
    galleryOrientation: galleryOrientation,
    status: input.asDraft ? ("draft" as const) : ("pending" as const),
    // Soumission directe en file (D0) : le SLA part d'ici. Brouillon =
    // jamais soumis (NULL) — la date est posée à la (re-)soumission.
    submittedAt: input.asDraft ? null : new Date(),
    // Curation auto : compte veille → hors jeu (classement/featured),
    // catalogue oui. Jamais modifiable par le maker (toggle admin seul).
    curated: isCurationAccount(maker.username),
  };
  // Course slug (double submit simultané) : 23505 → nouveau slug + 1 seul
  // retry, sinon message franc (jamais d'erreur brute au client).
  let row: { id: string; slug: string; status: "draft" | "pending" | "published" | "rejected" };
  try {
    [row] = await db
      .insert(products)
      .values(values)
      .returning({ id: products.id, slug: products.slug, status: products.status });
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    const retrySlug = await freshProductSlug(`${data.name} ${Date.now().toString(36)}`);
    [row] = await db
      .insert(products)
      .values({ ...values, slug: retrySlug })
      .returning({ id: products.id, slug: products.slug, status: products.status });
  }

  const files = [...(logo ? [logo] : []), ...screenshots];
  if (files.length > 0) {
    try {
      const prepared = await uploadProductFiles(row.id, logo, screenshots, galleryOrientation);
      await db
        .update(products)
        .set({ iconUrl: prepared.logoUrl, updatedAt: new Date() })
        .where(eq(products.id, row.id));
      if (prepared.shots.length > 0) {
        await db.insert(productScreenshots).values(
          prepared.shots.map((s, i) => ({
            productId: row.id,
            url: s.url,
            position: i + 1,
            orientation: s.orientation,
            width: s.width,
            height: s.height,
          })),
        );
      }
      // Staging consommé : purge (échec → balayeur 24 h).
      await cleanupStaged(staged.stagedKeys);
    } catch (e) {
      // Uploads en échec : pas de fiche orpheline — tout est retiré.
      await db.delete(products).where(eq(products.id, row.id));
      throw e;
    }
  }
  // Staff : création en file (jamais les brouillons).
  if (row.status === "pending") notifyReviewAsync(row.id);
  return { id: row.id, slug: row.slug, status: row.status };
}

function notifyReviewAsync(productId: string, buildId?: string): void {
  // Staff : fiche qui entre en pending / build enregistré (D6). Fire-
  // and-forget best-effort (le helper ne throw jamais) — la soumission
  // n'attend pas l'email et n'en dépend pas.
  void notifyAdminsReview({ productId, buildId: buildId ?? null });
}

// ── Lectures ──────────────────────────────────────────────────────────────
// Allowlist stricte : jamais d'email maker en public (jointure minimale).
const publicMakerSelect = {
  id: products.id,
  slug: products.slug,
  name: products.name,
  tagline: products.tagline,
  description: products.description,
  category: products.category,
  categories: products.categories,
  tags: products.tags,
  platforms: products.platforms,
  links: products.links,
  productType: products.productType,
  pricingModel: products.pricingModel,
  lifecycle: products.lifecycle,
  audience: products.audience,
  license: products.license,
  hasAds: products.hasAds,
  hasInAppPurchase: products.hasInAppPurchase,
  sharesData: products.sharesData,
  isChildDirected: products.isChildDirected,
  installCommand: products.installCommand,
  version: products.version,
  requirements: products.requirements,
  targetCountries: products.targetCountries,
  languagesSupported: products.languagesSupported,
  iconUrl: products.iconUrl,
  galleryOrientation: products.galleryOrientation,
  upvoteCount: products.upvoteCount,
  score: products.score,
  ratingsSum: products.ratingsSum,
  ratingsCount: products.ratingsCount,
  commentsCount: products.commentsCount,
  // Téléchargements APK (compteur dénormalisé, lu aussi en base par le
  // mobile) : présent dans la lecture produit pour que l'API v1 l'expose
  // sans requête supplémentaire.
  downloadCount: products.downloadCount,
  curated: products.curated,
  publishedAt: products.publishedAt,
  createdAt: products.createdAt,
};

/** Fiche publique (SEO) : published + screenshots + maker public. */
export async function fetchProductBySlug(slug: string) {
  const [row] = await db
    .select({
      ...publicMakerSelect,
      makerId: products.makerId,
      makerUsername: users.username,
      makerDisplayName: users.displayName,
      makerAvatarUrl: users.avatarUrl,
      makerWebsiteUrl: users.websiteUrl,
      makerSocialLinks: users.socialLinks,
    })
    .from(products)
    .innerJoin(users, eq(products.makerId, users.id))
    .where(
      and(
        eq(products.slug, slug.toLowerCase()),
        eq(products.status, "published"),
        isNull(products.deletedAt),
      ),
    )
    .limit(1);
  if (!row) return null;
  const shots = await db
    .select({
      url: productScreenshots.url,
      caption: productScreenshots.caption,
      orientation: productScreenshots.orientation,
      width: productScreenshots.width,
      height: productScreenshots.height,
    })
    .from(productScreenshots)
    .where(eq(productScreenshots.productId, row.id))
    .orderBy(productScreenshots.position);
  return { ...row, screenshots: shots };
}

/**
 * APERÇU d'une fiche — propriétaire OU staff.
 *
 * Doublette de `fetchProductBySlug` SANS le filtre `published` : l'aperçu
 * montre une fiche encore en brouillon / en revue / rejetée, exactement
 * telle qu'elle paraîtra. La garde vit ICI (pas seulement dans la page) :
 * `null` = indisponible pour ce viewer → la route répond 404, jamais 403
 * (on ne confirme pas l'existence d'une fiche non publiée).
 *
 * `isStaff` est décidé par l'appelant (rôle en base, jamais le miroir
 * JWT). Un tiers ne reçoit RIEN : la ligne n'est même pas lue.
 */
export async function fetchProductForPreview(
  viewerId: string,
  productId: string,
  opts?: { isStaff?: boolean },
) {
  const [row] = await db
    .select({
      ...publicMakerSelect,
      makerId: products.makerId,
      status: products.status,
      rejectionReason: products.rejectionReason,
      publishedAt: products.publishedAt,
      createdAt: products.createdAt,
      makerUsername: users.username,
      makerDisplayName: users.displayName,
      makerAvatarUrl: users.avatarUrl,
      makerWebsiteUrl: users.websiteUrl,
      makerSocialLinks: users.socialLinks,
    })
    .from(products)
    .innerJoin(users, eq(products.makerId, users.id))
    .where(and(eq(products.id, productId), isNull(products.deletedAt)))
    .limit(1);
  if (!row) return null;
  // Garde : le propriétaire, ou un staff. Un tiers → null (404 en route).
  if (row.makerId !== viewerId && opts?.isStaff !== true) return null;
  const shots = await db
    .select({
      url: productScreenshots.url,
      caption: productScreenshots.caption,
      orientation: productScreenshots.orientation,
      width: productScreenshots.width,
      height: productScreenshots.height,
    })
    .from(productScreenshots)
    .where(eq(productScreenshots.productId, row.id))
    .orderBy(productScreenshots.position);
  // Révision en attente : l'aperçu doit montrer CE QUI SERA PUBLIÉ
  // (le texte et les médias proposés), pas le contenu validé. Sans ça,
  // le maker voit son ancien texte dans l'aperçu et croit que sa
  // modification a disparu (alors qu'elle est en file de revue).
  const [revision] = await db
    .select({ payload: productRevisions.payload, media: productRevisions.media })
    .from(productRevisions)
    .where(eq(productRevisions.productId, row.id))
    .limit(1);
  if (!revision) return { product: row, shots };
  const payload = (revision.payload ?? {}) as Record<string, unknown>;
  const media = (revision.media ?? null) as PendingMedia | null;
  const product = {
    ...row,
    name: typeof payload.name === "string" ? payload.name : row.name,
    tagline: typeof payload.tagline === "string" ? payload.tagline : row.tagline,
    description: typeof payload.description === "string" ? payload.description : row.description,
    tags: Array.isArray(payload.tags) ? (payload.tags as string[]) : row.tags,
    requirements: Array.isArray(payload.requirements)
      ? (payload.requirements as string[])
      : row.requirements,
    installCommand:
      typeof payload.installCommand === "string" ? payload.installCommand : row.installCommand,
    links: (payload.links as typeof row.links | undefined) ?? row.links,
    iconUrl: media?.logo ?? row.iconUrl,
  };
  const previewShots =
    media && media.shots.length > 0
      ? media.shots.map((s, i) => ({
          url: s.url,
          caption: null,
          orientation: s.orientation,
          width: s.width,
          height: s.height,
          position: i + 1,
        }))
      : shots;
  return { product, shots: previewShots };
}

/** Dashboard maker : tout ses produits (draft/pending/rejected inclus).
 * Keyset optionnel (`updatedAt` + id, ordre dashboard) pour les clients
 * mobiles — le web charge tout (totaux exacts, volume V1). */
export async function fetchMyProducts(
  viewerId: string,
  input?: { limit?: number; cursor?: { at: Date; id: string } | null },
) {
  const limit = Math.min(Math.max(input?.limit ?? 0, 0), 100);
  const conditions = [eq(products.makerId, viewerId), isNull(products.deletedAt)];
  if (input?.cursor) {
    conditions.push(
      sql`(${products.updatedAt}, ${products.id}) < (${input.cursor.at.toISOString()}, ${input.cursor.id})`,
    );
  }
  const base = db
    .select({
      ...publicMakerSelect,
      makerId: products.makerId,
      status: products.status,
      rejectionReason: products.rejectionReason,
      updatedAt: products.updatedAt,
      // Révision en attente (table dédiée, deny-all) : le maker doit
      // voir CE QU'IL A PROPOSÉ, pas le contenu validé.
      revisionPayload: productRevisions.payload,
      revisionAt: productRevisions.createdAt,
    })
    .from(products)
    .leftJoin(productRevisions, eq(productRevisions.productId, products.id))
    .where(and(...conditions))
    .orderBy(desc(products.updatedAt), desc(products.id))
    .$dynamic();
  // Sans limite (web) : tout (totaux exacts, volume V1). Mobile : page +1
  // (détection hasMore sans COUNT).
  const rows = limit > 0 ? await base.limit(limit + 1) : await base;
  if (limit === 0) return { items: rows, nextCursor: null };
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  return {
    items,
    nextCursor: hasMore && last ? { at: last.updatedAt, id: last.id } : null,
  };
}

/** File de revue : pending par ancienneté (SLA 24 h). */
export async function fetchReviewQueue(input: { isStaff: boolean; limit?: number }) {
  if (!input.isStaff) throw new ProfileError("FORBIDDEN", "Réservé à l'équipe.");
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);
  const rows = await db
    .select({
      ...publicMakerSelect,
      makerId: products.makerId,
      status: products.status,
      submittedAt: products.submittedAt,
      makerUsername: users.username,
      makerDisplayName: users.displayName,
      makerAvatarUrl: users.avatarUrl,
    })
    .from(products)
    .innerJoin(users, eq(products.makerId, users.id))
    .where(and(eq(products.status, "pending"), isNull(products.deletedAt)))
    .orderBy(desc(sql`COALESCE(${products.submittedAt}, ${products.createdAt})`), desc(products.id))
    .limit(limit);
  // Compte captures par produit (1 requête groupée — jamais de N+1).
  const shotCounts = new Map<string, number>();
  if (rows.length > 0) {
    const counts = await db
      .select({ productId: productScreenshots.productId, n: count() })
      .from(productScreenshots)
      .where(
        inArray(
          productScreenshots.productId,
          rows.map((r) => r.id),
        ),
      )
      .groupBy(productScreenshots.productId);
    for (const c of counts) shotCounts.set(c.productId, c.n);
  }
  return rows.map((r) => ({ ...r, shotCount: shotCounts.get(r.id) ?? 0 }));
}

/**
 * File des rejetés : mêmes lignes que la revue (statut rejected) + dates
 * d'audit groupées (dernier `product_rejected` → jours depuis rejet,
 * dernier `product_nudged` → jours depuis rappel). 3 requêtes, jamais N+1.
 * Sert la section Rejetés (rappel manuel des makers).
 */
export async function fetchRejectedQueue(input: { isStaff: boolean; limit?: number }): Promise<
  Array<
    Omit<ReviewQueueRow, "shotCount"> & {
      shotCount: number;
      status: "draft" | "pending" | "published" | "rejected";
      rejectionReason: string | null;
      rejectedAt: Date | null;
      lastNudgedAt: Date | null;
    }
  >
> {
  if (!input.isStaff) throw new ProfileError("FORBIDDEN", "Réservé à l'équipe.");
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);
  const rows = await db
    .select({
      ...publicMakerSelect,
      makerId: products.makerId,
      status: products.status,
      submittedAt: products.submittedAt,
      rejectionReason: products.rejectionReason,
      makerUsername: users.username,
      makerDisplayName: users.displayName,
      makerAvatarUrl: users.avatarUrl,
    })
    .from(products)
    .innerJoin(users, eq(products.makerId, users.id))
    .where(and(eq(products.status, "rejected"), isNull(products.deletedAt)))
    .orderBy(desc(products.updatedAt), desc(products.id))
    .limit(limit);
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [rejectedRows, nudgedRows] = await Promise.all([
    db
      .select({ targetId: adminActions.targetId, at: sql<Date>`max(${adminActions.createdAt})` })
      .from(adminActions)
      .where(and(inArray(adminActions.targetId, ids), eq(adminActions.action, "product_rejected")))
      .groupBy(adminActions.targetId),
    db
      .select({ targetId: adminActions.targetId, at: sql<Date>`max(${adminActions.createdAt})` })
      .from(adminActions)
      .where(and(inArray(adminActions.targetId, ids), eq(adminActions.action, "product_nudged")))
      .groupBy(adminActions.targetId),
  ]);
  const rejectedBy = new Map(rejectedRows.map((r) => [r.targetId, r.at]));
  const nudgedBy = new Map(nudgedRows.map((r) => [r.targetId, r.at]));
  // `max()` brut = string côté driver (pas de parsing Date) → normaliser
  // ici, une fois (sinon `getTime is not a function` côté UI).
  const asDate = (v: Date | string | undefined): Date | null => {
    if (!v) return null;
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  };
  return rows.map((r) => ({
    ...r,
    shotCount: 0,
    rejectedAt: asDate(rejectedBy.get(r.id)),
    lastNudgedAt: asDate(nudgedBy.get(r.id)),
  }));
}

/** Délai minimum entre deux rappels au même maker (anti-spam). */
export const NUDGE_COOLDOWN_DAYS = 3;

/**
 * Cible d'un rappel maker (section Rejetés) : produit encore rejected +
 * identité maker + jours depuis rejet/dernier rappel. Throw si le produit
 * n'est plus rejeté (resoumis entre-temps → le rappel n'a plus de sens).
 */
export async function fetchNudgeTarget(productId: string): Promise<{
  productName: string;
  reason: string;
  makerEmail: string;
  makerDisplayName: string;
  makerTimeZone: string | null;
  rejectedDays: number;
  lastNudgedDays: number | null;
}> {
  const [row] = await db
    .select({
      name: products.name,
      status: products.status,
      rejectionReason: products.rejectionReason,
      makerEmail: users.email,
      makerDisplayName: users.displayName,
      makerTimeZone: users.timeZone,
    })
    .from(products)
    .innerJoin(users, eq(products.makerId, users.id))
    .where(and(eq(products.id, productId), isNull(products.deletedAt)))
    .limit(1);
  if (!row || row.status !== "rejected") {
    throw new ProfileError("VALIDATION", "Produit non rejeté — rappel inutile.");
  }
  const [rej, nudge] = await Promise.all([
    db
      .select({ at: adminActions.createdAt })
      .from(adminActions)
      .where(and(eq(adminActions.targetId, productId), eq(adminActions.action, "product_rejected")))
      .orderBy(desc(adminActions.createdAt))
      .limit(1),
    db
      .select({ at: adminActions.createdAt })
      .from(adminActions)
      .where(and(eq(adminActions.targetId, productId), eq(adminActions.action, "product_nudged")))
      .orderBy(desc(adminActions.createdAt))
      .limit(1),
  ]);
  const now = Date.now();
  const days = (at: Date | string | undefined): number | null => {
    if (!at) return null;
    const t = at instanceof Date ? at.getTime() : new Date(at).getTime();
    if (Number.isNaN(t)) return null;
    return Math.max(0, Math.floor((now - t) / 86_400_000));
  };
  return {
    productName: row.name,
    reason: row.rejectionReason ?? "Motif non renseigné.",
    makerEmail: row.makerEmail,
    makerDisplayName: row.makerDisplayName,
    makerTimeZone: row.makerTimeZone,
    rejectedDays: days(rej[0]?.at) ?? 0,
    lastNudgedDays: days(nudge[0]?.at),
  };
}

// ── Présentation dashboard / revue ─────────────────────────────────────
// Mapping DB → formes UI (les composants ne changent pas) : statuts DB →
// AppStatus, labels via config, dates FR ("mars 2026"), initiales +
// gradient déterministes. Zéro mock : vues/commentaires/revenus valent
// 0/undefined tant que leurs phases ne sont pas livrées (jamais de faux
// chiffres — les états vides restent honnêtes).

export type DashboardRow = Awaited<ReturnType<typeof fetchMyProducts>>["items"][number];

/** Lignes affichables dans l'overview (les brouillons vivent sur /drafts). */
export function isListedProduct(
  row: DashboardRow,
): row is DashboardRow & { status: "pending" | "published" | "rejected" } {
  return row.status !== "draft";
}

const PRICING_LABEL = new Map(PRICING_MODELS.map((p) => [p.id, p.label]));

const ICON_GRADIENTS = [
  "from-zinc-800 to-zinc-950",
  "from-emerald-500 to-teal-600",
  "from-blue-600 to-indigo-600",
  "from-orange-500 to-amber-600",
  "from-teal-500 to-cyan-600",
  "from-yellow-500 to-orange-500",
];
export function appGradientFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return ICON_GRADIENTS[h % ICON_GRADIENTS.length] ?? ICON_GRADIENTS[0];
}

/** Moyenne d'avis (1 décimale, 0 si aucun — jamais de faux chiffre). */
export function ratingsAvgOf(sum: number, count: number): number {
  return count > 0 ? Math.round((sum / count) * 10) / 10 : 0;
}

/** Libellé carte : "4,5 (12)" ou undefined si aucun avis (bloc masqué). */
export function ratingLabelOf(sum: number, count: number): string | undefined {
  if (count <= 0) return undefined;
  return `${ratingsAvgOf(sum, count).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} (${count})`;
}

export function appInitialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : (parts[0]?.[1] ?? "");
  return `${first}${last}`.toUpperCase();
}

function monthYearFr(d: Date): string {
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(d);
}

/**
 * Ligne DB → DashboardApp (overview + pré-remplissage édition :
 * description + linkValues inclus). `views/clicks/comments/rating/revenue`
 * = 0/vide (enrichis ou phases ultérieures — jamais de faux chiffres).
 */
export function toDashboardApp(
  row: DashboardRow & { status: "pending" | "published" | "rejected" },
): DashboardApp {
  const status = row.status === "published" ? "live" : row.status;
  const lifecycle = (["dev", "beta", "live"] as const).find((l) => l === row.lifecycle) ?? "live";
  // Révision en attente : le maker doit voir CE QU'IL A ÉCRIT (la
  // fiche publique, elle, garde le contenu validé). Sans ça, il
  // reverrait son texte validé et croirait que son edit a été perdu.
  const pending = (row.revisionPayload ?? {}) as Record<string, unknown>;
  const pendingName = typeof pending.name === "string" ? pending.name : row.name;
  const pendingTagline = typeof pending.tagline === "string" ? pending.tagline : row.tagline;
  const pendingDescription =
    typeof pending.description === "string" ? pending.description : row.description;
  const pendingTags = Array.isArray(pending.tags) ? (pending.tags as string[]) : row.tags;
  const pendingRequirements = Array.isArray(pending.requirements)
    ? (pending.requirements as string[])
    : row.requirements;
  const pendingInstallCommand =
    typeof pending.installCommand === "string" ? pending.installCommand : row.installCommand;
  const pendingLinks = (pending.links ?? row.links) as ProductLinks;
  return {
    id: row.id,
    slug: row.slug,
    name: pendingName,
    tagline: pendingTagline,
    description: pendingDescription,
    categoryId: row.categories[0] ?? row.category,
    productType: getProductTypeById(row.productType).label,
    productTypeId: row.productType,
    platforms: row.platforms,
    audienceId: row.audience,
    pricing: PRICING_LABEL.get(row.pricingModel) ?? row.pricingModel,
    version: row.version ?? undefined,
    lifecycle,
    launchedAt: monthYearFr(row.publishedAt ?? row.createdAt),
    tags: pendingTags,
    waitingText: row.status === "pending" ? waitingFr(row.createdAt) : undefined,
    votes: row.upvoteCount,
    views: 0,
    clicks: 0,
    views7d: 0,
    // Engagement réel injecté plus haut par `getMakerAppsDashboard`.
    downloads: 0,
    comments: row.commentsCount ?? 0,
    rating: ratingsAvgOf(row.ratingsSum ?? 0, row.ratingsCount ?? 0),
    ratingsCount: row.ratingsCount ?? 0,
    status,
    rejectionReason: row.rejectionReason ?? undefined,
    curated: row.curated ?? false,
    revenue: undefined,
    linkValues: pendingLinks,
    categoryIds: row.categories.length > 0 ? row.categories : [row.category],
    license: row.license ?? undefined,
    installCommand: pendingInstallCommand ?? undefined,
    requirements: pendingRequirements ?? undefined,
    changelogUrl: pendingLinks.changelog,
    hasAds: row.hasAds,
    hasThirdParty: row.sharesData,
    targetCountries: row.targetCountries,
    languagesSupported: row.languagesSupported,
    galleryOrientation: row.galleryOrientation as "portrait" | "landscape",
    iconGradient: appGradientFor(row.id),
    initials: appInitialsFor(row.name),
    iconUrl: row.iconUrl ?? null,
  };
}

/**
 * Pré-remplissage du formulaire d'édition : mêmes champs que
 * toDashboardApp, tout statut accepté (brouillon inclus). Le statut DB
 * n'est jamais affiché ni modifié par le formulaire — `draft` est mappé
 * en `pending` affichable uniquement pour satisfaire le type (le service
 * d'update conserve le vrai statut).
 */
export function toEditApp(row: DashboardRow): DashboardApp {
  const listed = row.status === "draft" ? { ...row, status: "pending" as const } : row;
  return toDashboardApp(listed as DashboardRow & { status: "pending" | "published" | "rejected" });
}

/**
 * Dossier de revue complet : fiche pending + captures réelles + identité
 * maker + compteurs (produits en ligne, bans). Non-pending → NOT_FOUND
 * (la file ne connaît que les pending).
 */
export async function fetchReviewItem(input: {
  isStaff: boolean;
  productId: string;
  /** Revue binaire seule (D6) : dossier d'une fiche déjà tranchée. */
  includeDecided?: boolean;
}) {
  if (!input.isStaff) throw new ProfileError("FORBIDDEN", "Réservé à l'équipe.");
  const [row] = await db
    .select({
      ...publicMakerSelect,
      makerId: products.makerId,
      status: products.status,
      submittedAt: products.submittedAt,
      makerUsername: users.username,
      makerDisplayName: users.displayName,
      makerAvatarUrl: users.avatarUrl,
    })
    .from(products)
    .innerJoin(users, eq(products.makerId, users.id))
    .where(and(eq(products.id, input.productId), isNull(products.deletedAt)))
    .limit(1);
  if (!row || (row.status !== "pending" && !input.includeDecided))
    throw new ProfileError("NOT_FOUND", "Soumission introuvable.");
  const shots = await db
    .select({
      url: productScreenshots.url,
      caption: productScreenshots.caption,
      orientation: productScreenshots.orientation,
      width: productScreenshots.width,
      height: productScreenshots.height,
    })
    .from(productScreenshots)
    .where(eq(productScreenshots.productId, row.id))
    .orderBy(productScreenshots.position);
  const [live] = await db
    .select({ n: count() })
    .from(products)
    .where(
      and(
        eq(products.makerId, row.makerId),
        eq(products.status, "published"),
        isNull(products.deletedAt),
      ),
    )
    .limit(1);
  const [bans] = await db
    .select({ n: count() })
    .from(adminActions)
    .where(and(eq(adminActions.targetId, row.makerId), eq(adminActions.action, "ban")))
    .limit(1);
  return { ...row, shots, makerLiveCount: live?.n ?? 0, makerBans: bans?.n ?? 0 };
}

export type ReviewQueueRow = Awaited<ReturnType<typeof fetchReviewQueue>>[number];

/**
 * Statut admin d'une fiche (page review) : distingue "déjà tranchée"
 * (→ redirect file, pas de 404 brut au reload post-verdict) de
 * "inexistante" (→ vrai 404). 1 requête, cas null uniquement.
 */
export async function fetchProductAdminStatus(input: {
  isStaff: boolean;
  productId: string;
}): Promise<{ status: string } | null> {
  if (!input.isStaff) throw new ProfileError("FORBIDDEN", "Réservé à l'équipe.");
  const [row] = await db
    .select({ status: products.status })
    .from(products)
    .where(and(eq(products.id, input.productId), isNull(products.deletedAt)))
    .limit(1);
  return row ?? null;
}

/**
 * Ligne DB → ReviewItem (file + cockpit, composants inchangés) :
 * labels via config, attente calculée (SLA 24 h), avatar maker, liens
 * bruts (pastilles re-vérifiées côté page). `revenue` : non collecté
 * en V1 → undefined (jamais de faux positif).
 * Accepte les lignes file comme les dossiers détail (même sélection).
 */
export function toReviewItem(
  row: Omit<ReviewQueueRow, "shotCount">,
  extras?: {
    shotCount?: number;
    makerLive?: number;
    makerBans?: number;
    /** Vue revenus réelle (staff uniquement — jamais undefined par défaut). */
    revenue?: ReviewItem["revenue"];
  },
): ReviewItem {
  // SLA 24 h (D0) : depuis la (re-)soumission, jamais la naissance du
  // brouillon (un brouillon de 3 jours ne naît pas "dépassé"). Fallback
  // createdAt pour les lignes pré-D0 sans submittedAt.
  const since = row.submittedAt ?? row.createdAt;
  const waitingHours = Math.max(0, Math.floor((Date.now() - since.getTime()) / 3_600_000));
  return {
    id: row.id,
    productName: row.name,
    tagline: row.tagline,
    description: row.description,
    makerName: row.makerDisplayName,
    makerUsername: row.makerUsername,
    makerAvatar: row.makerAvatarUrl,
    makerLiveCount: extras?.makerLive ?? 0,
    makerBans: extras?.makerBans ?? 0,
    categoryIds: row.categories.length > 0 ? row.categories : [row.category],
    productTypeId: row.productType,
    platforms: row.platforms,
    audienceId: row.audience,
    kidsPolicyUrl: row.links.kidsafety,
    pricing: PRICING_LABEL.get(row.pricingModel) ?? row.pricingModel,
    version: row.version ?? undefined,
    license: row.license ?? undefined,
    installCommand: row.installCommand ?? undefined,
    hasAds: row.hasAds,
    sharesData: row.sharesData,
    lifecycle: (["dev", "beta", "live"] as const).find((l) => l === row.lifecycle) ?? "live",
    tags: row.tags,
    linkValues: row.links,
    videoUrl: row.links.video,
    requirements: row.requirements ?? undefined,
    changelogUrl: row.links.changelog,
    iconGradient: appGradientFor(row.id),
    initials: appInitialsFor(row.name),
    iconUrl: row.iconUrl ?? null,
    // Nombre de captures : passé explicitement par l'appelant (file =
    // comptage groupé, détail = shots.length) — jamais deviné ici.
    screenshots: extras?.shotCount ?? 0,
    waitingText: waitingFr(since),
    waitingHours,
    revenue: extras?.revenue,
  };
}

/** Admin produits : tout, paginé keyset (created_at, id) comme users. */
export async function fetchAdminProducts(input: {
  isStaff: boolean;
  q?: string;
  status?: "all" | "draft" | "pending" | "published" | "rejected";
  cursor?: { createdAt: Date; id: string } | null;
  limit?: number;
  /** `false` = produits pinnables uniquement (utilisé par l'épinglage). */
  curated?: boolean;
}) {
  if (!input.isStaff) throw new ProfileError("FORBIDDEN", "Réservé à l'équipe.");
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);
  const status = input.status ?? "all";
  const q = (input.q ?? "").trim();
  const conditions = [isNull(products.deletedAt)];
  if (status !== "all") conditions.push(eq(products.status, status));
  if (input.curated === false) conditions.push(eq(products.curated, false));
  if (q !== "") {
    // % et _ saisis = littéraux (sinon "100%" matche "1000").
    const literal = q.replace(/[%_\\]/g, (c) => `\\${c}`);
    conditions.push(
      or(
        ilike(products.name, `%${literal}%`),
        ilike(products.slug, `%${literal}%`),
        ilike(products.tagline, `%${literal}%`),
      )!,
    );
  }
  if (input.cursor) {
    conditions.push(
      sql`(${products.createdAt}, ${products.id}) < (${input.cursor.createdAt.toISOString()}, ${input.cursor.id})`,
    );
  }
  const rows = await db
    .select({
      ...publicMakerSelect,
      makerId: products.makerId,
      status: products.status,
      makerUsername: users.username,
      makerDisplayName: users.displayName,
      makerAvatarUrl: users.avatarUrl,
    })
    .from(products)
    .innerJoin(users, eq(products.makerId, users.id))
    .where(and(...conditions))
    .orderBy(desc(products.createdAt), desc(products.id))
    .limit(limit + 1);
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  return {
    items,
    nextCursor: hasMore && last ? { createdAt: last.createdAt, id: last.id } : null,
  };
}

// ── Édition (règles re-revue) ─────────────────────────────────────────────
const editProductSchema = submitProductSchema.partial();

/**
 * Médias existants pour l'édition (affichage seul : absents = conservés,
 * présents + nouvelle sélection = remplacement total). Ownership vérifié.
 */
export async function getEditMedia(
  viewerId: string,
  productId: string,
): Promise<{
  iconUrl: string | null;
  // `orientation` mesurée à l'upload : la dialog de bascule affiche
  // exactement les miniatures que la purge serveur va supprimer.
  shots: {
    url: string;
    width: number | null;
    height: number | null;
    orientation: GalleryOrientation;
  }[];
}> {
  const [row] = await db
    .select({ id: products.id, makerId: products.makerId, iconUrl: products.iconUrl })
    .from(products)
    .where(and(eq(products.id, productId), isNull(products.deletedAt)))
    .limit(1);
  if (!row || row.makerId !== viewerId) {
    throw new ProfileError("FORBIDDEN", "Modification du produit d'autrui interdite.");
  }
  const shots = await db
    .select({
      url: productScreenshots.url,
      width: productScreenshots.width,
      height: productScreenshots.height,
      orientation: productScreenshots.orientation,
    })
    .from(productScreenshots)
    .where(eq(productScreenshots.productId, productId))
    .orderBy(productScreenshots.position);
  return {
    iconUrl: row.iconUrl,
    shots: shots.map((s) => ({ ...s, orientation: s.orientation as GalleryOrientation })),
  };
}

/**
 * Champs SENSIBLES d'une fiche PUBLIÉE : contenu libre, affiché
 * publiquement et indexé par les moteurs.
 *
 * Un maker peut y glisser un lien noir (SEO), du spam, une commande
 * piégée (`installCommand` est affichée comme une commande à
 * exécuter), une capture trompeuse. Aucune règle automatique ne peut
 * juger ça → re-revue HUMAINE obligatoire.
 *
 * Règle (la règle des stores) : la fiche reste EN LIGNE avec son
 * contenu validé, la modification attend dans la file des révisions
 * (colonnes `pending_*`, migration 0048). Les changements ne filent
 * pas : tant que l'admin n'a pas validé, le public voit l'ancien.
 *
 * Les champs STRUCTURÉS (plateformes, modèle économique, audience,
 * type, catégories) ne sont PAS sensibles : ils ne portent pas de
 * contenu libre, mais ils DÉCLENCHENT des règles → ils sont appliqués
 * immédiatement, avec les règles rejouées sur la fiche effective.
 */
export const SENSITIVE_EDIT_FIELDS = [
  "name",
  "tagline",
  "description",
  "tags",
  "requirements",
  "installCommand",
  // L'orientation de la galerie est une décision MÉDIA : la purger hors
  // revue viderait la galerie publiée avant validation.
  "galleryOrientation",
] as const;

/** Médias en attente (uploadés dans R2, pas encore attachés). */
export type PendingMedia = {
  logo: string | null;
  shots: PreparedShot[];
};

/** Révision en attente d'une fiche publiée. */
export type PendingRevision = {
  /** Champs sensibles modifiés (valeurs nouvelles). */
  payload: Record<string, unknown>;
  /** Nouveaux médias (logo + captures), pas encore attachés. */
  media: PendingMedia | null;
  at: Date | null;
};

/**
 * Le maker édite sa fiche : textes libres immédiats ; nom OU liens
 * modifiés sur une fiche published → retour pending (re-revue).
 * Draft + `publish: true` → passage pending (publication depuis l'édition :
 * mêmes règles que la création publish). Sinon statut conservé.
 */
export async function updateProduct(
  viewerId: string,
  productId: string,
  rawInput: unknown,
  files?: { logo?: File | null; screenshots?: File[]; staged?: StagedMedia },
  opts?: { publish?: boolean },
): Promise<{ slug: string; status: string; rereview: boolean }> {
  await assertNotBanned(viewerId);
  const [row] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
  if (!row || row.deletedAt) throw new ProfileError("NOT_FOUND", "Produit introuvable.");
  if (row.makerId !== viewerId) {
    throw new ProfileError("FORBIDDEN", "Modification du produit d'autrui interdite.");
  }
  const parsed = editProductSchema.safeParse(
    rawInput !== null &&
      typeof rawInput === "object" &&
      !Array.isArray(rawInput) &&
      typeof (rawInput as Record<string, unknown>).description === "string"
      ? {
          ...(rawInput as Record<string, unknown>),
          description: sanitizeImportedMarkdown(
            (rawInput as Record<string, unknown>).description as string,
          ).text,
        }
      : rawInput,
  );
  if (!parsed.success) throw new ProfileError("VALIDATION", zodFieldMessage(parsed.error));
  const data = parsed.data;
  // changelogUrl n'est PAS une colonne : mergé dans links (comme au submit).
  // Remplacement total sinon (effacer un lien = le vider) MAIS changelog
  // préservé : aucune UI ne l'édite ni ne l'efface - seul changelogUrl
  // l'écrit (B3). Sans ça, toute édition effaçait links.changelog.
  const { changelogUrl: editChangelog, ...restData } = data;
  let mergedLinks: Record<string, string> | undefined;
  if (data.links !== undefined || editChangelog) {
    // Deux modes, un seul résultat final :
    //
    // - REPLACE (web) : le formulaire envoie TOUS les champs liens, un
    //   champ vidé = « efface » → le remplacement total de la fiche
    //   donne exactement le formulaire (comportement inchangé).
    // - MERGE (API mobile) : le mobile n'envoie que les champs qu'il
    //   modifie ; les absents sont CONSERVÉS, les champs vidés sont
    //   effacés (`clearedLinks`). Sans ce mode, chaque édition mobile
    //   effaçait tous les liens non renvoyés de la fiche.
    const mode = data.linksMode ?? (data.clearedLinks !== undefined ? "merge" : "replace");
    const base: Record<string, string> =
      mode === "merge" ? { ...((row.links ?? {}) as Record<string, string>) } : {};
    if (mode === "merge") {
      for (const id of data.clearedLinks ?? []) delete base[id];
    }
    mergedLinks = { ...base, ...(data.links ?? {}) };
    if (editChangelog) {
      mergedLinks.changelog = editChangelog;
    } else if (!("changelog" in mergedLinks) && row.links.changelog) {
      mergedLinks.changelog = row.links.changelog;
    }
  }
  // Orientation : plus aucune contrainte de type (le type propose, le maker
  // choisit). La bascule est libre ; c'est la purge plus bas qui écarte les
  // captures de l'orientation abandonnée.
  // Bascule d'orientation : PAS de refus (l'ancien « fournissez aussi de
  // nouvelles captures » bloquait le toggle). La purge des captures
  // mesurées dans l'autre orientation a lieu plus bas, après le bloc
  // média — donc après l'upload éventuel de nouvelles captures.
  // Staging présigné mergé aux directs (même pipeline, mêmes règles).
  const staged = files?.staged
    ? await resolveStagedMedia(viewerId, files.staged)
    : { logo: null, screenshots: [], stagedKeys: [] };
  const editLogo = files?.logo && files.logo.size > 0 ? files.logo : staged.logo;
  const newShots = [...(files?.screenshots ?? []).filter((f) => f.size > 0), ...staged.screenshots];
  const effectiveOrientation =
    data.galleryOrientation ?? (row.galleryOrientation as GalleryOrientation);
  if (data.categories !== undefined && data.categories.length === 0) {
    throw new ProfileError("VALIDATION", "Au moins une catégorie.");
  }

  const linksChanged =
    mergedLinks !== undefined && canonicalLinks(mergedLinks) !== canonicalLinks(row.links);
  const isPublished = row.status === "published";

  // ── Tier 1 : champs SENSIBLES + médias ───────────────────────────
  // Sur une fiche PUBLIÉE, ils ne sont PAS appliqués : ils vont dans
  // la révision en attente (la fiche reste en ligne avec son contenu
  // validé, la modification attend un regard admin). Les changements
  // ne filent pas.
  //
  // Sur un brouillon/pending, rien de tout ça : le travail en cours
  // s'applique, la revue tranche au moment de la publication.
  //
  // La révision en cours (table `product_revisions`) est reprise : un
  // champ que le maker NE RE-TOUCHE PAS garde sa valeur proposée ; un
  // champ remis à sa valeur VALIDÉE disparaît de la révision (il a
  // annulé son changement).
  const previousRevision = isPublished
    ? (
        await db
          .select({ payload: productRevisions.payload, media: productRevisions.media })
          .from(productRevisions)
          .where(eq(productRevisions.productId, productId))
          .limit(1)
      )[0]
    : undefined;
  const sensitive: Record<string, unknown> = isPublished
    ? { ...((previousRevision?.payload ?? {}) as Record<string, unknown>) }
    : {};
  if (isPublished) {
    for (const field of SENSITIVE_EDIT_FIELDS) {
      const next = (data as Record<string, unknown>)[field];
      if (next === undefined) continue;
      const prev = (row as Record<string, unknown>)[field];
      if (JSON.stringify(next ?? null) === JSON.stringify(prev ?? null)) {
        // Remis à la valeur validée → plus de changement proposé.
        delete sensitive[field];
      } else {
        sensitive[field] = next;
      }
    }
    // Les liens (et le changelog, qui vit dans les liens) : comparés
    // canoniquement (l'ordre des clés ne doit pas compter).
    if (linksChanged) sensitive.links = mergedLinks;
  }
  const mediaChanged = isPublished && (Boolean(editLogo) || newShots.length > 0);
  const needsRevision = Object.keys(sensitive).length > 0 || mediaChanged;

  // Publication depuis l'édition (draft + intent publish) : mêmes règles
  // que la création publish, puis statut → pending.
  // RE-SOUMISSION après rejet (rejected + intent publish) : même traitement
  // (mêmes exigences médias, retour en file, motif effacé) — sinon la fiche
  // reste rejetée et le maker croit à tort l'avoir republiée (bug vu en QA).
  const publishing = opts?.publish === true && row.status === "draft";
  const resubmitting = opts?.publish === true && row.status === "rejected";
  const toQueue = publishing || resubmitting;
  if (toQueue) {
    const hasLogo = Boolean(editLogo) || Boolean(row.iconUrl);
    if (!hasLogo) {
      throw new ProfileError("VALIDATION", "Logo requis pour publier (brouillon accepté sans).");
    }
    let existingShots = 0;
    if (newShots.length === 0) {
      const [shotCount] = await db
        .select({ n: count() })
        .from(productScreenshots)
        .where(eq(productScreenshots.productId, productId))
        .limit(1);
      existingShots = shotCount?.n ?? 0;
    }
    if (newShots.length === 0 && existingShots === 0) {
      throw new ProfileError("VALIDATION", "Au moins une capture requise pour publier.");
    }
    // Contrat de PUBLICATION, revalidé sur la fiche EFFECTIVE (champs
    // modifiés + fiche existante) : un brouillon peut être allégé
    // (travail en cours), sa publication non. Avant, ce chemin ne
    // validait QUE les médias et les liens — une fiche sans
    // plateforme, sans tagline ou sans description partait en file
    // telle quelle. On réutilise `submitProductSchema` (le contrat de
    // la création publish) : un seul contrat, deux chemins.
    const effective = effectiveProductForPublish(row, {
      ...data,
      ...(mergedLinks !== undefined ? { links: mergedLinks } : {}),
    });
    const republished = submitProductSchema.safeParse(effective);
    if (!republished.success) {
      throw new ProfileError("VALIDATION", zodFieldMessage(republished.error));
    }
  }

  // Reachability seulement si les liens changent vraiment (pas à chaque
  // édition) ; règles matrice rejouées à chaque édition d'une fiche en
  // ligne — AVANT, elles n'étaient rejouées que si les liens changeaient :
  // un produit publié pouvait passer en "subscription", en "android" ou en
  // audience "enfants" SANS revalidation → privacy / kidsafety / download
  // banni contournés. Les règles sont une contrainte de la fiche, pas
  // des liens : elles suivent les champs qui les déclenchent.
  if (linksChanged && mergedLinks) await assertLinksReachable(mergedLinks);
  if (isPublished || toQueue) {
    assertLinkRules({
      productType: data.productType ?? row.productType,
      audience: data.audience ?? row.audience,
      pricingModel: data.pricingModel ?? row.pricingModel,
      platforms: data.platforms ?? row.platforms,
      links: mergedLinks ?? (row.links as Record<string, string>),
    });
  }

  // Contrat de PUBLICATION appliqué aussi à la révision : on ne met
  // pas en file une fiche invalide (le contrat est le même que pour
  // une publication — la forme est vérifiée par la machine, le
  // contenu par l'admin).
  if (needsRevision) {
    const effective = effectiveProductForPublish(row, {
      ...data,
      ...(mergedLinks !== undefined ? { links: mergedLinks } : {}),
    });
    const checked = submitProductSchema.safeParse(effective);
    if (!checked.success) {
      throw new ProfileError("VALIDATION", zodFieldMessage(checked.error));
    }
  }

  // Le patch applique les champs NON sensibles (structures, cosmetique) ;
  // les champs sensibles et les medias vont dans la revision.
  const patch: Partial<typeof products.$inferInsert> = { updatedAt: new Date() };
  for (const [key, value] of Object.entries(restData)) {
    if (key === "links" || value === undefined) continue;
    if (isPublished && (SENSITIVE_EDIT_FIELDS as readonly string[]).includes(key)) continue;
    (patch as Record<string, unknown>)[key] = value;
  }
  // Les liens vont dans la revision quand ils ont change sur une fiche
  // en ligne ; sinon ils s'appliquent (brouillon, ou liens inchanges).
  const linksInRevision = isPublished && linksChanged;
  if (mergedLinks !== undefined && !linksInRevision) patch.links = mergedLinks;
  if (toQueue) {
    patch.status = "pending";
    patch.rejectionReason = null;
  }
  // L'orientation de la galerie est une decision MEDIA : elle va dans la
  // revision quand la fiche est en ligne (sinon la purge des captures
  // incompatibles viderait la galerie PUBLIEE avant validation).
  const orientationChanged = effectiveOrientation !== row.galleryOrientation;
  const orientationInRevision = isPublished && orientationChanged;
  // Retour en file (publication, re-soumission) : nouveau cycle
  // SLA (D0) - la date de (re-)soumission, jamais la naissance du brouillon.
  if (patch.status === "pending") patch.submittedAt = new Date();

  // --- 1. Les MEDIAS : upload d'abord ------------------------------
  // L'upload R2 passe AVANT toute ecriture en base : un upload qui
  // echoue (R2 indisponible, quota, format) ne doit pas laisser la
  // fiche a moitie ecrite (texte a jour + revision en file alors que le
  // maker a vu une erreur).
  let prepared: { logoUrl: string | null; shots: PreparedShot[] } | null = null;
  let oldShots: { url: string }[] = [];
  if (editLogo || newShots.length > 0) {
    if (!r2Configured()) {
      throw new ProfileError("VALIDATION", "Upload indisponible (stockage non configure).");
    }
    if (newShots.length > MAX_SHOTS) {
      throw new ProfileError("VALIDATION", `${MAX_SHOTS} captures maximum.`);
    }
    // iconUrl deja lu sur `row` (pas de re-select).
    oldShots =
      newShots.length > 0
        ? await db
            .select({ url: productScreenshots.url })
            .from(productScreenshots)
            .where(eq(productScreenshots.productId, productId))
        : [];
    prepared = await uploadProductFiles(productId, editLogo, newShots, effectiveOrientation);
  }
  const pendingMedia: PendingMedia | null =
    needsRevision && prepared ? { logo: prepared.logoUrl, shots: prepared.shots } : null;

  // --- 2. Les ECRITURES en base, en une transaction ----------------
  const [updated] = await db.transaction(async (tx) => {
    const [row2] = await tx
      .update(products)
      .set(patch)
      .where(eq(products.id, productId))
      .returning({ slug: products.slug, status: products.status });

    // Les medias : appliques (hors revision) ou ranges dans la revision.
    if (prepared && !needsRevision) {
      if (prepared.logoUrl) {
        await tx
          .update(products)
          .set({ iconUrl: prepared.logoUrl })
          .where(eq(products.id, productId));
      }
      if (prepared.shots.length > 0) {
        await tx.delete(productScreenshots).where(eq(productScreenshots.productId, productId));
        await tx.insert(productScreenshots).values(
          prepared.shots.map((s, i) => ({
            productId,
            url: s.url,
            position: i + 1,
            orientation: s.orientation,
            width: s.width,
            height: s.height,
          })),
        );
      }
    }

    // --- 3. La revision en attente (table `product_revisions`, deny-all) ---
    if (needsRevision) {
      await tx
        .insert(productRevisions)
        .values({
          productId,
          makerId: viewerId,
          payload: sensitive as never,
          media: pendingMedia as never,
          createdAt: new Date(),
        })
        .onConflictDoUpdate({
          target: productRevisions.productId,
          set: {
            payload: sensitive as never,
            media: pendingMedia as never,
            createdAt: new Date(),
            reviewedAt: null,
            reviewedBy: null,
            rejectionReason: null,
          },
        });
    } else if (previousRevision) {
      // Plus rien de propose (le maker a tout remis a sa valeur validee) :
      // la revision ne sert plus a rien -> on la jette.
      await tx.delete(productRevisions).where(eq(productRevisions.productId, productId));
    }
    return [row2] as const;
  });

  // --- 4. Les purges R2 (apres la transaction : on ne supprime pas
  // l'ancien media avant que le nouveau soit en place) ----------------
  if (prepared) {
    if (!needsRevision) {
      // Remplacement total (logo + galerie) : les anciens objets
      // partent, best-effort.
      if (prepared.logoUrl) {
        const oldKey = r2KeyFromUrl(row.iconUrl);
        if (oldKey) await deleteR2Object(PRODUCT_LOGOS_BUCKET, oldKey).catch(() => {});
      }
      for (const s of oldShots) {
        const key = r2KeyFromUrl(s.url);
        if (key) await deleteR2Object(PRODUCT_SHOTS_BUCKET, key).catch(() => {});
      }
    }
    await cleanupStaged(staged.stagedKeys);
  }
  // Les medias de la revision precedente qui ne sont pas reconduits sont
  // purges (R2) : pas d'orphelin, pas de melange v1/v2.
  const oldMedia = (previousRevision?.media ?? null) as PendingMedia | null;
  if (oldMedia) {
    const kept = new Set((pendingMedia?.shots ?? []).map((s) => s.url));
    if (oldMedia.logo && oldMedia.logo !== pendingMedia?.logo) {
      const key = r2KeyFromUrl(oldMedia.logo);
      if (key) await deleteR2Object(PRODUCT_LOGOS_BUCKET, key).catch(() => {});
    }
    for (const s of oldMedia.shots ?? []) {
      if (kept.has(s.url)) continue;
      const key = r2KeyFromUrl(s.url);
      if (key) await deleteR2Object(PRODUCT_SHOTS_BUCKET, key).catch(() => {});
    }
  }
  // Bascule d'orientation = purge des captures de l'autre orientation.
  // Sur une fiche EN LIGNE, la bascule attend la validation (sinon la
  // galerie publiee se vide avant que l'admin ne regarde) : la purge
  // part avec l'approbation de la revision.
  if (orientationChanged && !orientationInRevision) {
    await purgeScreenshotsOffOrientation(productId, effectiveOrientation);
  }

  // Staff : entrée en file uniquement (un edit qui reste pending ne
  // re-notifie pas — pas de spam à chaque sauvegarde).
  if (updated.status === "pending" && row.status !== "pending") {
    notifyReviewAsync(productId);
  }
  // `rereview` = une révision est en attente (le contenu public n’a pas bougé).
  return { slug: updated.slug, status: updated.status, rereview: needsRevision };
}

// ── Révisions en attente (re-revue d'une fiche publiée) ────────────────────
/**
 * Nombre de révisions en attente (pastille admin). Une requête.
 */
export async function countPendingRevisions(): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(productRevisions)
    .innerJoin(products, eq(products.id, productRevisions.productId))
    .where(isNull(products.deletedAt));
  return row?.n ?? 0;
}

/**
 * File des révisions : les fiches PUBLIÉES dont le contenu sensible a
 * été modifié et attend un regard admin.
 *
 * La fiche reste en ligne avec son contenu validé — c'est la règle des
 * stores. Le public ne voit PAS la modification tant qu'elle n'est pas
 * validée : les changements ne filent pas.
 */
export async function listPendingRevisions(input: { isStaff: boolean; limit?: number }): Promise<
  {
    id: string;
    slug: string;
    name: string;
    makerUsername: string;
    makerDisplayName: string;
    payload: Record<string, unknown>;
    media: PendingMedia | null;
    pendingAt: Date | null;
  }[]
> {
  if (!input.isStaff) throw new ProfileError("FORBIDDEN", "Réservé à l'équipe.");
  const rows = await db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      makerUsername: users.username,
      makerDisplayName: users.displayName,
      payload: productRevisions.payload,
      media: productRevisions.media,
      pendingAt: productRevisions.createdAt,
    })
    .from(productRevisions)
    .innerJoin(products, eq(products.id, productRevisions.productId))
    .innerJoin(users, eq(products.makerId, users.id))
    .where(isNull(products.deletedAt))
    .orderBy(asc(productRevisions.createdAt))
    .limit(Math.min(Math.max(input.limit ?? 50, 1), 100));
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    makerUsername: r.makerUsername,
    makerDisplayName: r.makerDisplayName,
    payload: (r.payload ?? {}) as Record<string, unknown>,
    media: (r.media ?? null) as PendingMedia | null,
    pendingAt: r.pendingAt,
  }));
}

/** Purge les médias d'une révision refusée (R2) — jamais d'orphelin. */
async function purgePendingMedia(media: PendingMedia | null): Promise<void> {
  if (!media) return;
  if (media.logo) {
    const key = r2KeyFromUrl(media.logo);
    if (key) await deleteR2Object(PRODUCT_LOGOS_BUCKET, key).catch(() => {});
  }
  for (const s of media.shots ?? []) {
    const key = r2KeyFromUrl(s.url);
    if (key) await deleteR2Object(PRODUCT_SHOTS_BUCKET, key).catch(() => {});
  }
}

/**
 * Tranche une révision en attente : approuver (le contenu et les médias
 * sont appliqués à la fiche) ou refuser (la fiche garde son contenu
 * validé, la modification est jetée).
 *
 * À l'approbation, les règles de la fiche sont REJOUÉES : entre la mise
 * en file et la décision, la fiche a pu changer (prix, audience,
 * plateformes) — on n'applique jamais un changement qui viole les
 * règles actuelles.
 */
export async function reviewRevision(input: {
  isStaff: boolean;
  productId: string;
  decision: "approved" | "rejected";
  reason?: string;
  staffId: string;
}): Promise<{ applied: boolean }> {
  if (!input.isStaff) throw new ProfileError("FORBIDDEN", "Réservé à l'équipe.");
  const [row] = await db.select().from(products).where(eq(products.id, input.productId)).limit(1);
  if (!row || row.deletedAt) throw new ProfileError("NOT_FOUND", "Produit introuvable.");
  const [revision] = await db
    .select({ payload: productRevisions.payload, media: productRevisions.media })
    .from(productRevisions)
    .where(eq(productRevisions.productId, input.productId))
    .limit(1);
  if (!revision) throw new ProfileError("NOT_FOUND", "Aucune révision en attente.");
  const payload = (revision.payload ?? {}) as Record<string, unknown>;
  const media = (revision.media ?? null) as PendingMedia | null;

  if (input.decision === "rejected") {
    await purgePendingMedia(media);
    await db.delete(productRevisions).where(eq(productRevisions.productId, input.productId));
    await db
      .update(products)
      .set({ updatedAt: new Date() })
      .where(eq(products.id, input.productId));
    return { applied: false };
  }

  // Les liens de la révision (ou ceux en place) doivent toujours
  // respecter les règles de la fiche.
  const links =
    (payload.links as Record<string, string> | undefined) ?? (row.links as Record<string, string>);
  assertLinkRules({
    productType: row.productType,
    audience: row.audience,
    pricingModel: row.pricingModel,
    platforms: row.platforms,
    links,
  });

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  for (const [key, value] of Object.entries(payload)) {
    if (key === "links") {
      patch.links = links;
      continue;
    }
    patch[key] = value;
  }
  // L'orientation approuvée : la galerie bascule ET les captures de
  // l'autre orientation sont purgées (maintenant, pas à l'enregistrement
  // — sinon la galerie publiée se vidait pendant que la révision
  // attendait).
  const orientationApprouvee =
    payload.galleryOrientation === "portrait" || payload.galleryOrientation === "landscape"
      ? (payload.galleryOrientation as "portrait" | "landscape")
      : null;

  // Médias : on remplace (l'ancien logo et les anciennes captures
  // partent à la poubelle, comme à l'édition directe).
  if (media?.logo) {
    const oldKey = r2KeyFromUrl(row.iconUrl);
    if (oldKey) await deleteR2Object(PRODUCT_LOGOS_BUCKET, oldKey).catch(() => {});
    patch.iconUrl = media.logo;
  }
  if (media && media.shots.length > 0) {
    const oldShots = await db
      .select({ url: productScreenshots.url })
      .from(productScreenshots)
      .where(eq(productScreenshots.productId, input.productId));
    await db.delete(productScreenshots).where(eq(productScreenshots.productId, input.productId));
    await db.insert(productScreenshots).values(
      media.shots.map((s, i) => ({
        productId: input.productId,
        url: s.url,
        position: i + 1,
        orientation: s.orientation,
        width: s.width,
        height: s.height,
      })),
    );
    for (const s of oldShots) {
      const key = r2KeyFromUrl(s.url);
      if (key) await deleteR2Object(PRODUCT_SHOTS_BUCKET, key).catch(() => {});
    }
  }

  await db
    .update(products)
    .set(patch as Record<string, never>)
    .where(eq(products.id, input.productId));
  await db.delete(productRevisions).where(eq(productRevisions.productId, input.productId));
  // La galerie bascule avec l'approbation : les captures de l'autre
  // orientation partent (elles ne peuvent pas cohabiter).
  if (orientationApprouvee && orientationApprouvee !== row.galleryOrientation) {
    await purgeScreenshotsOffOrientation(input.productId, orientationApprouvee);
  }
  return { applied: true };
}

// ── Revue (staff) ─────────────────────────────────────────────────────────
/**
 * Tranche une soumission : pending → published (published_at = now) ou
 * rejected (motif OBLIGATOIRE — emailé). Retourne l'identité pour la
 * notification (best-effort, comme appeals).
 */
/**
 * Fiche EFFECTIVE au format du schéma de publication : la fiche en base
 * + les champs modifiés. Les colonnes NULL de la base sont converties
 * en `undefined` (le schéma connaît `optional()`, pas `null`) et les
 * liens vides sont retirés (le schéma refuse une URL vide).
 */
function effectiveProductForPublish(
  row: typeof products.$inferSelect,
  patch: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    name: row.name,
    tagline: row.tagline,
    description: row.description,
    category: row.category,
    categories: row.categories ?? [],
    tags: row.tags ?? [],
    platforms: row.platforms ?? [],
    productType: row.productType,
    pricingModel: row.pricingModel,
    lifecycle: row.lifecycle,
    audience: row.audience,
    license: row.license ?? undefined,
    installCommand: row.installCommand ?? undefined,
    version: row.version ?? undefined,
    requirements: row.requirements ?? [],
    targetCountries: row.targetCountries ?? [],
    languagesSupported: row.languagesSupported ?? [],
    hasAds: row.hasAds,
    hasInAppPurchase: row.hasInAppPurchase,
    sharesData: row.sharesData,
    isChildDirected: row.isChildDirected,
    galleryOrientation: row.galleryOrientation,
    // `changelog` EST un id de lien connu (config/product-links.tsx) :
    // il n'est pas « inconnu » au schéma. Mais il a une double vie —
    // champ MÉTADONNÉE (`changelogUrl`, saisi par le maker) et clé
    // de `links` (où il est stocké). On le sort donc de `links` ici et
    // on le rend via `changelogUrl` : une seule source de vérité, et la
    // revalidation ne peut pas se marcher dessus.
    links: Object.fromEntries(
      Object.entries((row.links ?? {}) as Record<string, string>).filter(
        ([id, v]) => id !== "changelog" && typeof v === "string" && v.trim() !== "",
      ),
    ),
    changelogUrl:
      typeof (row.links as Record<string, string> | null)?.changelog === "string"
        ? (row.links as Record<string, string>).changelog
        : undefined,
    ...patch,
  };
}

export async function reviewProduct(input: {
  isStaff: boolean;
  productId: string;
  decision: "approved" | "rejected";
  reason?: string;
}): Promise<{
  email: string;
  displayName: string;
  productName: string;
  approved: boolean;
  timeZone: string | null;
}> {
  if (!input.isStaff) throw new ProfileError("FORBIDDEN", "Réservé à l'équipe.");
  const [row] = await db.select().from(products).where(eq(products.id, input.productId)).limit(1);
  if (!row) throw new ProfileError("NOT_FOUND", "Produit introuvable.");
  if (row.status !== "pending") {
    throw new ProfileError("CONFLICT", "Seules les soumissions en attente se tranchent.");
  }
  const reason = (input.reason ?? "").trim();
  if (input.decision === "rejected" && reason === "") {
    throw new ProfileError("VALIDATION", "Motif de rejet requis (emailé au maker).");
  }
  if (input.decision === "approved") {
    // L'approbation ne publie QUE si la fiche respecte le contrat de
    // publication. Sans cette garde, une fiche entrée en file par un
    // chemin allégé (brouillon sans plateforme, tagline, description…)
    // était publiée telle quelle — l'annuaire se remplissait de fiches
    // sans plateforme, que le staff ne voit qu'à l'écran.
    const republished = submitProductSchema.safeParse(effectiveProductForPublish(row));
    if (!republished.success) {
      throw new ProfileError(
        "VALIDATION",
        `Fiche incomplète — ${zodFieldMessage(republished.error)}`,
      );
    }
  }
  // Atomique : seul le premier verdict compte (double-clic, deux onglets,
  // deux staffs la même seconde) — 0 ligne affectée = déjà tranchée, jamais
  // deux emails contradictoires.
  const [decided] = await db
    .update(products)
    .set(
      input.decision === "approved"
        ? {
            status: "published",
            publishedAt: new Date(),
            rejectionReason: null,
            updatedAt: new Date(),
          }
        : { status: "rejected", rejectionReason: reason, updatedAt: new Date() },
    )
    .where(and(eq(products.id, input.productId), eq(products.status, "pending")))
    .returning({ id: products.id });
  if (!decided) {
    throw new ProfileError("CONFLICT", "Déjà tranchée — rechargez la file.");
  }
  const [maker] = await db
    .select({
      email: users.email,
      displayName: users.displayName,
      id: users.id,
      timeZone: users.timeZone,
    })
    .from(users)
    .innerJoin(products, eq(products.makerId, users.id))
    .where(eq(products.id, input.productId))
    .limit(1);
  return {
    email: maker?.email ?? "",
    displayName: maker?.displayName ?? "",
    productName: row.name,
    approved: input.decision === "approved",
    timeZone: maker?.timeZone ?? null,
  };
}

// ── Suppressions ──────────────────────────────────────────────────────────
/** Maker : suppression réelle (RGPD) + objets R2 best-effort.
 * Pas de verrou banni ici : la suppression est un droit inaliénable
 * (même contrat que DELETE /me) — l'ownership suffit. */
export async function deleteMyProduct(viewerId: string, productId: string): Promise<{ ok: true }> {
  const [row] = await db
    .select({ id: products.id, makerId: products.makerId, iconUrl: products.iconUrl })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  if (!row) throw new ProfileError("NOT_FOUND", "Produit introuvable.");
  if (row.makerId !== viewerId) {
    throw new ProfileError("FORBIDDEN", "Suppression du produit d'autrui interdite.");
  }
  const shots = await db
    .select({ url: productScreenshots.url })
    .from(productScreenshots)
    .where(eq(productScreenshots.productId, productId));
  await db.delete(products).where(eq(products.id, productId));
  for (const s of shots) {
    const key = r2KeyFromUrl(s.url);
    if (key) await deleteR2Object(PRODUCT_SHOTS_BUCKET, key).catch(() => {});
  }
  if (row.iconUrl) {
    const key = r2KeyFromUrl(row.iconUrl);
    if (key) await deleteR2Object(PRODUCT_LOGOS_BUCKET, key).catch(() => {});
  }
  // Builds : lignes parties en cascade, objets R2 purgés ici (D6).
  await purgeProductBuildObjects(row.makerId, productId);
  return { ok: true };
}

/** Admin : retrait (même purge R2 best-effort que le maker — jamais
 * d'orphelins facturés ; l'arme lourde reste un confirm + motif).
 * Retourne l'identité pour la notification (best-effort, comme revue). */
export async function deleteProductAsAdmin(input: {
  isStaff: boolean;
  productId: string;
}): Promise<{
  ok: true;
  email: string;
  displayName: string;
  productName: string;
  timeZone: string | null;
}> {
  if (!input.isStaff) throw new ProfileError("FORBIDDEN", "Réservé à l'équipe.");
  const [row] = await db
    .select({
      id: products.id,
      name: products.name,
      makerId: products.makerId,
      iconUrl: products.iconUrl,
    })
    .from(products)
    .where(eq(products.id, input.productId))
    .limit(1);
  if (!row) throw new ProfileError("NOT_FOUND", "Produit introuvable.");
  const [maker] = await db
    .select({ email: users.email, displayName: users.displayName, timeZone: users.timeZone })
    .from(users)
    .where(eq(users.id, row.makerId))
    .limit(1);
  const shots = await db
    .select({ url: productScreenshots.url })
    .from(productScreenshots)
    .where(eq(productScreenshots.productId, input.productId));
  await db.delete(products).where(eq(products.id, input.productId));
  for (const s of shots) {
    const key = r2KeyFromUrl(s.url);
    if (key) await deleteR2Object(PRODUCT_SHOTS_BUCKET, key).catch(() => {});
  }
  if (row.iconUrl) {
    const key = r2KeyFromUrl(row.iconUrl);
    if (key) await deleteR2Object(PRODUCT_LOGOS_BUCKET, key).catch(() => {});
  }
  // Builds : lignes parties en cascade, objets R2 purgés ici (D6).
  await purgeProductBuildObjects(row.makerId, input.productId);
  return {
    ok: true,
    email: maker?.email ?? "",
    displayName: maker?.displayName ?? "",
    productName: row.name,
    timeZone: maker?.timeZone ?? null,
  };
}

function r2KeyFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const segments = new URL(url).pathname.split("/").filter(Boolean);
    if (segments.length === 0) return null;
    // Style racine (défaut : un domaine public par bucket) : la clé est le
    // path COMPLET. Amputer le 1er segment (ancien comportement) supprimait
    // une clé inexistante → orphelins silencieux à chaque remplacement.
    // Path-style legacy (`R2_PUBLIC_PATH_STYLE=true`) : 1er segment = bucket.
    if (process.env.R2_PUBLIC_PATH_STYLE === "true") {
      if (segments.length < 2) return null;
      return segments.slice(1).join("/");
    }
    return segments.join("/");
  } catch {
    return null;
  }
}

// ── Conformité (mentions légales) ─────────────────────────────────────
/**
 * Purge brouillons 90 j : `draft` non touchés depuis 90 j (+ objets R2
 * best-effort, jamais bloquante). Retourne le nombre purgé.
 * Planification avec les crons Phase 3 (pg_cron absent en local et sur
 * certains Postgres — la fonction est testée ici, le schedule vit avec
 * les jobs score/featured). Mensuelle suffit (durée au jour près inutile).
 */
export async function purgeStaleDrafts(input: { olderThanDays?: number } = {}): Promise<{
  purged: number;
}> {
  const days = input.olderThanDays ?? 90;
  const cutoff = new Date(Date.now() - days * 86_400_000);
  const stale = await db
    .select({ id: products.id, iconUrl: products.iconUrl })
    .from(products)
    .where(
      and(eq(products.status, "draft"), lt(products.updatedAt, cutoff), isNull(products.deletedAt)),
    )
    .limit(500);
  if (stale.length === 0) return { purged: 0 };
  const ids = stale.map((s) => s.id);
  const shots = await db
    .select({ url: productScreenshots.url })
    .from(productScreenshots)
    .where(inArray(productScreenshots.productId, ids));
  await db.delete(products).where(inArray(products.id, ids));
  for (const s of shots) {
    const key = r2KeyFromUrl(s.url);
    if (key) await deleteR2Object(PRODUCT_SHOTS_BUCKET, key).catch(() => {});
  }
  for (const s of stale) {
    if (!s.iconUrl) continue;
    const key = r2KeyFromUrl(s.iconUrl);
    if (key) await deleteR2Object(PRODUCT_LOGOS_BUCKET, key).catch(() => {});
  }
  return { purged: stale.length };
}

/**
 * Balayeur d'orphelins R2 : clés dont le préfixe `{productId}` n'a plus
 * de fiche (suppressions, crashs mid-upload, purges SQL) + staging de
 * plus de 24 h (uploads présignés jamais soumis). Garde-fous : seules
 * les clés au format attendu sont candidates, suppressions plafonnées.
 * Complète `purgeStaleDrafts` (qui purge au fil de l'eau) et la purge
 * SQL cron (qui ne peut pas toucher R2).
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function sweepR2Orphans(input: { maxDelete?: number } = {}): Promise<{
  scanned: number;
  deleted: number;
}> {
  if (!r2Configured()) throw new ProfileError("VALIDATION", "Stockage non configuré.");
  const maxDelete = input.maxDelete ?? 500;
  const stagingCutoff = Date.now() - 24 * 3_600_000;
  let scanned = 0;
  let deleted = 0;
  for (const bucket of [PRODUCT_LOGOS_BUCKET, PRODUCT_SHOTS_BUCKET] as const) {
    const keys = await listR2Keys(bucket);
    scanned += keys.length;
    // Préfixes candidats DB : UUID uniquement (staging et ordures exclus
    // AVANT la requête — un "staging" dans un IN UUID = crash cast).
    const prefixes = [
      ...new Set(
        keys
          .map((k) => k.split("/")[0])
          .filter((p): p is string => Boolean(p) && p !== "staging" && UUID_RE.test(p)),
      ),
    ];
    const existing = new Set<string>();
    for (let i = 0; i < prefixes.length; i += 500) {
      const chunk = prefixes.slice(i, i + 500);
      const rows = await db
        .select({ id: products.id })
        .from(products)
        .where(inArray(products.id, chunk));
      for (const r of rows) existing.add(r.id);
    }
    for (const key of keys) {
      if (deleted >= maxDelete) return { scanned, deleted };
      // Staging abandonné : horodatage dans la clé, pas besoin de la DB.
      const staged = key.match(/^staging\/[0-9a-f-]{36}\/(\d+)-[a-z0-9]+\.(png|jpg|webp)$/);
      if (staged) {
        if (Number(staged[1]) < stagingCutoff) {
          await deleteR2Object(bucket, key).catch(() => {});
          deleted++;
        }
        continue;
      }
      const prefix = key.split("/")[0] ?? "";
      if (!prefix || existing.has(prefix)) continue;
      // Format attendu uniquement (jamais de suppression aveugle).
      if (!/^[0-9a-f-]{36}\/(logo|shot-\d+)-/.test(key)) continue;
      await deleteR2Object(bucket, key).catch(() => {});
      deleted++;
    }
  }
  // Builds APK (D6) : `builds/{maker}/{produit}/{stamp}-{rand}.apk` —
  // orphelin si la fiche n'existe plus (même garde-fous : format strict,
  // existence DB par lot, plafond global).
  {
    const buildKeys = await listR2Keys(PRODUCT_BUILDS_BUCKET);
    scanned += buildKeys.length;
    const pids = [
      ...new Set(
        buildKeys
          .map((k) => k.match(/^builds\/[0-9a-f-]{36}\/([0-9a-f-]{36})\/\d+-[a-z0-9]+\.apk$/i)?.[1])
          .filter((p): p is string => Boolean(p)),
      ),
    ];
    const existingBuilds = new Set<string>();
    for (let i = 0; i < pids.length; i += 500) {
      const chunk = pids.slice(i, i + 500);
      const rows = await db
        .select({ id: products.id })
        .from(products)
        .where(inArray(products.id, chunk));
      for (const r of rows) existingBuilds.add(r.id);
    }
    for (const key of buildKeys) {
      if (deleted >= maxDelete) return { scanned, deleted };
      const m = key.match(/^builds\/[0-9a-f-]{36}\/([0-9a-f-]{36})\/\d+-[a-z0-9]+\.apk$/i);
      if (!m || existingBuilds.has(m[1]!)) continue;
      await deleteR2Object(PRODUCT_BUILDS_BUCKET, key).catch(() => {});
      deleted++;
    }
  }
  return { scanned, deleted };
}

// ── Stats ─────────────────────────────────────────────────────────────────
/** Vue fiche (anonyme, best-effort — jamais bloquante). */
export async function logProductView(productId: string): Promise<void> {
  try {
    await db.insert(productPageViews).values({ productId });
  } catch {
    // Compteur non critique : silence (jamais de 500 pour une vue).
  }
}

/**
 * Clic sortant (anonyme, best-effort — jamais bloquant). Fiche publiée
 * exigée (pas de remplissage sur de l'invisible) ; `target` = field-id
 * matrice (website, playstore…) borné. Nourrit le dashboard maker (4C).
 */
export async function logOutboundClick(input: {
  productId: string;
  target: string;
}): Promise<void> {
  try {
    const target = input.target.trim().slice(0, 64);
    if (!target) return;
    const [row] = await db
      .select({ id: products.id })
      .from(products)
      .where(
        and(
          eq(products.id, input.productId),
          eq(products.status, "published"),
          isNull(products.deletedAt),
        ),
      )
      .limit(1);
    if (!row) return;
    await db.insert(productLinkClicks).values({ productId: row.id, target });
  } catch (e) {
    captureError(e instanceof Error ? e : new Error(String(e)), { op: "products.click" });
  }
}

/** Stats maker (own ou staff) : vues + votes. */
export async function getProductStats(input: {
  viewerId: string;
  productId: string;
  isStaff: boolean;
}): Promise<{ views: number; votes: number; upvoteCount: number }> {
  const [row] = await db
    .select({ id: products.id, makerId: products.makerId, upvoteCount: products.upvoteCount })
    .from(products)
    .where(eq(products.id, input.productId))
    .limit(1);
  if (!row) throw new ProfileError("NOT_FOUND", "Produit introuvable.");
  if (row.makerId !== input.viewerId && !input.isStaff) {
    throw new ProfileError("FORBIDDEN", "Statistiques du produit d'autrui interdites.");
  }
  const [[{ value: viewTotal }], [{ value: voteTotal }]] = await Promise.all([
    db
      .select({ value: count() })
      .from(productPageViews)
      .where(eq(productPageViews.productId, input.productId)),
    db.select({ value: count() }).from(votes).where(eq(votes.productId, input.productId)),
  ]);
  return { views: viewTotal, votes: voteTotal, upvoteCount: row.upvoteCount };
}

/**
 * Engagement batch (4C) : vues + clics sortants + téléchargements par
 * produit, requêtes groupées (jamais N×k). Sert le dashboard maker et le
 * profil public. Produits inconnus = absents (l'appelant complète à 0).
 * Les téléchargements viennent des événements (vérité) et non du compteur
 * dénormalisé : ici on veut l'historique (total + 7 j), pas un O(1).
 */
export async function getProductsEngagement(productIds: string[]): Promise<
  Record<
    string,
    {
      views: number;
      clicks: number;
      downloads: number;
      views7d: number;
      clicks7d: number;
      downloads7d: number;
    }
  >
> {
  if (productIds.length === 0) return {};
  const weekAgo = new Date(Date.now() - 7 * 24 * 3_600_000).toISOString();
  const [viewRows, clickRows, downloadRows, view7Rows, click7Rows, download7Rows] =
    await Promise.all([
      db
        .select({ productId: productPageViews.productId, n: sql<number>`count(*)::int` })
        .from(productPageViews)
        .where(inArray(productPageViews.productId, productIds))
        .groupBy(productPageViews.productId),
      db
        .select({ productId: productLinkClicks.productId, n: sql<number>`count(*)::int` })
        .from(productLinkClicks)
        .where(inArray(productLinkClicks.productId, productIds))
        .groupBy(productLinkClicks.productId),
      db
        .select({ productId: productDownloads.productId, n: sql<number>`count(*)::int` })
        .from(productDownloads)
        .where(inArray(productDownloads.productId, productIds))
        .groupBy(productDownloads.productId),
      db
        .select({ productId: productPageViews.productId, n: sql<number>`count(*)::int` })
        .from(productPageViews)
        .where(
          and(
            inArray(productPageViews.productId, productIds),
            sql`${productPageViews.createdAt} >= ${weekAgo}::timestamptz`,
          ),
        )
        .groupBy(productPageViews.productId),
      db
        .select({ productId: productLinkClicks.productId, n: sql<number>`count(*)::int` })
        .from(productLinkClicks)
        .where(
          and(
            inArray(productLinkClicks.productId, productIds),
            sql`${productLinkClicks.createdAt} >= ${weekAgo}::timestamptz`,
          ),
        )
        .groupBy(productLinkClicks.productId),
      db
        .select({ productId: productDownloads.productId, n: sql<number>`count(*)::int` })
        .from(productDownloads)
        .where(
          and(
            inArray(productDownloads.productId, productIds),
            sql`${productDownloads.createdAt} >= ${weekAgo}::timestamptz`,
          ),
        )
        .groupBy(productDownloads.productId),
    ]);
  const out: Record<
    string,
    {
      views: number;
      clicks: number;
      downloads: number;
      views7d: number;
      clicks7d: number;
      downloads7d: number;
    }
  > = {};
  const cell = (id: string) =>
    (out[id] ??= { views: 0, clicks: 0, downloads: 0, views7d: 0, clicks7d: 0, downloads7d: 0 });
  for (const r of viewRows) cell(r.productId).views = r.n;
  for (const r of clickRows) cell(r.productId).clicks = r.n;
  for (const r of downloadRows) cell(r.productId).downloads = r.n;
  for (const r of view7Rows) cell(r.productId).views7d = r.n;
  for (const r of click7Rows) cell(r.productId).clicks7d = r.n;
  for (const r of download7Rows) cell(r.productId).downloads7d = r.n;
  return out;
}

export type MakerPublicProduct = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  iconUrl: string | null;
  categoryId: string;
  pricing: string;
  platforms: string[];
  audienceId: string;
  upvotes: number;
  commentsCount: number;
  ratingAvg: number;
  ratingsCount: number;
  curated: boolean;
  publishedAt: string | null;
};

/**
 * Profil maker public (4C) : identité + produits publiés + totaux réels
 * (produits, votes reçus). Vues = privées (dashboard). MRR : phase
 * revenus, absent ici. Maker banni : profil visible + badge (page),
 * produits published affichés comme partout ailleurs (aucune
 * dépublication auto — décision).
 */
export async function getMakerPublicProfile(username: string): Promise<{
  profile: {
    makerId: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    bio: string | null;
    occupation: string;
    city: string | null;
    country: string | null;
    websiteUrl: string | null;
    socialLinks: Record<string, string>;
    banned: boolean;
  };
  products: MakerPublicProduct[];
  totals: { products: number; upvotes: number; comments: number };
} | null> {
  const row = await getUserProfile(username.toLowerCase());
  if (!row) return null;
  const socialLinks: Record<string, string> = {};
  for (const [k, v] of Object.entries(row.socialLinks ?? {})) {
    if (typeof v === "string" && v !== "") socialLinks[k] = v;
  }
  const prods = await db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      tagline: products.tagline,
      iconUrl: products.iconUrl,
      categoryId: products.category,
      pricing: products.pricingModel,
      platforms: products.platforms,
      audienceId: products.audience,
      upvotes: products.upvoteCount,
      commentsCount: products.commentsCount,
      ratingsSum: products.ratingsSum,
      ratingsCount: products.ratingsCount,
      curated: products.curated,
      publishedAt: products.publishedAt,
    })
    .from(products)
    .where(
      and(
        eq(products.makerId, row.id),
        eq(products.status, "published"),
        isNull(products.deletedAt),
      ),
    )
    .orderBy(desc(products.publishedAt));
  const items: MakerPublicProduct[] = prods.map((p) => ({
    ...p,
    publishedAt: p.publishedAt?.toISOString() ?? null,
    ratingAvg: ratingsAvgOf(p.ratingsSum, p.ratingsCount),
    ratingsCount: p.ratingsCount,
  }));
  return {
    profile: {
      makerId: row.id,
      username: row.username,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
      bio: row.bio,
      occupation: row.occupation,
      city: row.city,
      country: row.country,
      websiteUrl: row.websiteUrl,
      socialLinks,
      banned: row.bannedAt !== null,
    },
    products: items,
    totals: {
      products: items.length,
      upvotes: items.reduce((a, p) => a + p.upvotes, 0),
      comments: items.reduce((a, p) => a + p.commentsCount, 0),
    },
  };
}
