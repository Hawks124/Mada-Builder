import { z } from "zod";
import { and, count, desc, eq, ilike, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  products,
  productScreenshots,
  productPageViews,
  productLinkClicks,
  votes,
  users,
  adminActions,
} from "@/db/schema";
import type { NewProduct } from "@/db/schema";
import type { DashboardApp } from "@/components/dashboard/dashboard-mock";
import type { ReviewItem } from "@/components/admin/admin-mock";
import { ProfileError, assertNotBanned, getUserProfile } from "@/services/users.service";
import { PRODUCT_TYPES, type GalleryOrientation } from "@/config/product-types";
import { getProductTypeById } from "@/config/product-types";
import { PRODUCT_CATEGORIES } from "@/config/categories";
import { PLATFORMS } from "@/config/platforms";
import { PRICING_MODELS } from "@/config/pricing";
import { AGE_RATINGS } from "@/config/ratings";
import { PRODUCT_LINK_FIELDS } from "@/config/product-links";
import { hasAccessPoint, requiredFor } from "@/config/product-links";
import { isMonetizedPricing } from "@/config/pricing";
import { isCurationAccount } from "@/config/curation";
import { checkUrl, classifyForSubmit, matchStorePattern } from "@/services/url-check.service";
import { checkLimit } from "@/lib/ratelimit";
import { isUniqueViolation } from "@/lib/api/idempotency";
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
import { captureError } from "@/lib/monitoring";

/**
 * Domaine products — même contrat que users.service : jamais de session
 * ici (viewerId/isStaff fournis), Drizzle + Zod + R2, erreurs ProfileError
 * (codes stables → enveloppe API + toasts). RLS deny-all en écriture :
 * tout passe par ces fonctions.
 */

const TYPE_IDS = new Set(PRODUCT_TYPES.map((t) => t.id));
/** Orientation imposée par type ("both" = le maker choisit). */
const TYPE_ORIENTATION = new Map(PRODUCT_TYPES.map((t) => [t.id, t.orientation] as const));

/**
 * Pilotage auto : l'orientation déclarée doit être compatible avec le
 * type (un SaaS desktop en portrait n'existe pas — rejet, pas recadrage).
 */
function assertOrientationAllowed(
  productType: string,
  galleryOrientation: GalleryOrientation,
): void {
  const imposed = TYPE_ORIENTATION.get(productType);
  if (imposed && imposed !== "both" && imposed !== galleryOrientation) {
    const want = imposed === "portrait" ? "portrait" : "paysage";
    throw new ProfileError("VALIDATION", `Captures ${want} requises pour ce type de produit.`);
  }
}
const CATEGORY_IDS = new Set(PRODUCT_CATEGORIES.map((c) => c.id));
const PLATFORM_IDS = new Set(PLATFORMS.map((p) => p.id));
const PRICING_IDS = new Set(PRICING_MODELS.map((p) => p.id));
const AUDIENCE_IDS = new Set(AGE_RATINGS.map((r) => r.id));

/** Types dev-facing : install command requise (miroir du formulaire). */
const DEV_FACING = new Set(["cli", "package", "framework", "plugin"]);

const optionalUrlSchema = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.url().max(2048).optional(),
);

/**
 * Liens : record field-id matrice → URL. Clés inconnues REFUSÉES (pas de
 * champ fantôme en DB) ; chaque valeur = URL valide. La matrice
 * (labels, required, storePattern) vit dans config/product-links.
 */
const KNOWN_LINK_IDS = new Set(Object.keys(PRODUCT_LINK_FIELDS));

/**
 * Champs liens d'un objet brut (FormData converti, multipart mobile) :
 * présents mais vides = {} (effacement explicite) ; aucun champ =
 * undefined (PATCH conserve). Valeurs non-string ignorées (jamais de
 * crash sur un multipart malformé). Exporté : actions web + routes API
 * partagent le même contrat, zéro dérive.
 */
export function parseLinkFields(input: unknown): Record<string, string> | undefined {
  if (typeof input !== "object" || input === null) return undefined;
  const rec = input as Record<string, unknown>;
  const links: Record<string, string> = {};
  let seen = false;
  for (const id of KNOWN_LINK_IDS) {
    if (!(id in rec)) continue;
    seen = true;
    const v = rec[id];
    if (typeof v === "string" && v.trim() !== "") links[id] = v.trim();
  }
  return seen ? links : undefined;
}

/**
 * Variante FormData (web ou mobile multipart) : même contrat, zéro
 * dérive. Vit ici (module serveur pur) car les fichiers "use server"
 * n'exportent que des fonctions async.
 */
export function parseProductLinkFields(formData: FormData): Record<string, string> | undefined {
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
  tags: z.array(z.string().trim().min(1).max(30)).max(5).optional(),
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
  requirements: z.string().trim().max(500).optional(),
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
  links: Record<string, string>;
}): void {
  if (!hasAccessPoint(opts.links)) {
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
const LOGO_OPTS = {
  maxInputBytes: 10 * 1024 * 1024,
  minPx: 256,
  outPx: 512,
  outQuality: 82,
  maxOutBytes: 2 * 1024 * 1024,
  fit: "contain-square",
} as const;
// Captures : ratio source préservé (inside, côté long ≤ 1600), côté court
// ≥ 400 px. L'uniformité par fiche est imposée par l'orientation déclarée
// (rejet des intrus, jamais de recadrage) — pas par la sortie.
const SHOT_OPTS = {
  maxInputBytes: 10 * 1024 * 1024,
  minPx: 400,
  outPx: 1600,
  outQuality: 80,
  maxOutBytes: 4 * 1024 * 1024,
  fit: "inside",
  maxLongEdge: 1600,
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
        `Capture ${n} : format non supporté — PNG, JPG ou WebP uniquement.`,
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
        `Capture ${n} : orientation ${gotFr} rejetée — ce produit est déclaré ${declaredFr}.`,
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
      const key = r2Key(productId, `shot-${n}`, "webp");
      const url = await track(
        PRODUCT_SHOTS_BUCKET,
        key,
        putR2Object(PRODUCT_SHOTS_BUCKET, key, processed, "image/webp"),
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

const STAGED_KEY_RE = /^staging\/[0-9a-f-]{36}\/\d+-[a-z0-9]+\.(png|jpg|webp)$/;
const STAGED_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
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
  const parsed = submitProductSchema.safeParse(rawData);
  if (!parsed.success) {
    throw new ProfileError("VALIDATION", zodFieldMessage(parsed.error));
  }
  const data = parsed.data;
  assertOrientationAllowed(data.productType, data.galleryOrientation);
  if (DEV_FACING.has(data.productType) && !data.installCommand) {
    throw new ProfileError("VALIDATION", "Commande d'installation requise pour ce type.");
  }
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
    galleryOrientation: data.galleryOrientation,
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
      const prepared = await uploadProductFiles(row.id, logo, screenshots, data.galleryOrientation);
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
  return { id: row.id, slug: row.slug, status: row.status };
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
    })
    .from(products)
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

function waitingFr(createdAt: Date, now: Date = new Date()): string {
  const days = Math.max(0, Math.floor((now.getTime() - createdAt.getTime()) / 86_400_000));
  if (days <= 0) return "En attente depuis aujourd'hui";
  return `En attente depuis ${days} j`;
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
  return {
    id: row.id,
    name: row.name,
    tagline: row.tagline,
    description: row.description,
    categoryId: row.categories[0] ?? row.category,
    productType: getProductTypeById(row.productType).label,
    productTypeId: row.productType,
    platforms: row.platforms,
    audienceId: row.audience,
    pricing: PRICING_LABEL.get(row.pricingModel) ?? row.pricingModel,
    version: row.version ?? undefined,
    lifecycle,
    launchedAt: monthYearFr(row.publishedAt ?? row.createdAt),
    tags: row.tags,
    waitingText: row.status === "pending" ? waitingFr(row.createdAt) : undefined,
    votes: row.upvoteCount,
    views: 0,
    clicks: 0,
    views7d: 0,
    comments: row.commentsCount ?? 0,
    rating: ratingsAvgOf(row.ratingsSum ?? 0, row.ratingsCount ?? 0),
    ratingsCount: row.ratingsCount ?? 0,
    status,
    rejectionReason: row.rejectionReason ?? undefined,
    revenue: undefined,
    linkValues: row.links,
    categoryIds: row.categories.length > 0 ? row.categories : [row.category],
    license: row.license ?? undefined,
    installCommand: row.installCommand ?? undefined,
    requirements: row.requirements ?? undefined,
    changelogUrl: row.links.changelog,
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
export async function fetchReviewItem(input: { isStaff: boolean; productId: string }) {
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
  if (!row || row.status !== "pending")
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
  extras?: { shotCount?: number; makerLive?: number; makerBans?: number },
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
    revenue: undefined,
  };
}

/** Admin produits : tout, paginé keyset (created_at, id) comme users. */
export async function fetchAdminProducts(input: {
  isStaff: boolean;
  q?: string;
  status?: "all" | "draft" | "pending" | "published" | "rejected";
  cursor?: { createdAt: Date; id: string } | null;
  limit?: number;
}) {
  if (!input.isStaff) throw new ProfileError("FORBIDDEN", "Réservé à l'équipe.");
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);
  const status = input.status ?? "all";
  const q = (input.q ?? "").trim();
  const conditions = [isNull(products.deletedAt)];
  if (status !== "all") conditions.push(eq(products.status, status));
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
  shots: { url: string; width: number | null; height: number | null }[];
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
    })
    .from(productScreenshots)
    .where(eq(productScreenshots.productId, productId))
    .orderBy(productScreenshots.position);
  return { iconUrl: row.iconUrl, shots };
}

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
  // préservé : aucune UI ne l'édite ni ne l'efface — seul changelogUrl
  // l'écrit (B3). Sans ça, toute édition effaçait links.changelog.
  const { changelogUrl: editChangelog, ...restData } = data;
  let mergedLinks: Record<string, string> | undefined;
  if (data.links !== undefined || editChangelog) {
    mergedLinks = { ...(data.links ?? {}) };
    if (editChangelog) {
      mergedLinks.changelog = editChangelog;
    } else if (!("changelog" in mergedLinks) && row.links.changelog) {
      mergedLinks.changelog = row.links.changelog;
    }
  }
  // Type et/ou orientation modifiés : re-valider le couple (l'orientation
  // effective = la nouvelle si fournie, sinon celle stockée).
  if (data.productType !== undefined || data.galleryOrientation !== undefined) {
    assertOrientationAllowed(
      data.productType ?? row.productType,
      data.galleryOrientation ?? (row.galleryOrientation as GalleryOrientation),
    );
  }
  // Guard AVANT tout commit (M1) : orientation changée sans captures
  // compatibles = refus, zéro écriture (jamais de fiche mixte persistée).
  // Staging présigné mergé aux directs (même pipeline, mêmes règles).
  const staged = files?.staged
    ? await resolveStagedMedia(viewerId, files.staged)
    : { logo: null, screenshots: [], stagedKeys: [] };
  const editLogo = files?.logo && files.logo.size > 0 ? files.logo : staged.logo;
  const newShots = [...(files?.screenshots ?? []).filter((f) => f.size > 0), ...staged.screenshots];
  const effectiveOrientation =
    data.galleryOrientation ?? (row.galleryOrientation as GalleryOrientation);
  if (effectiveOrientation !== row.galleryOrientation && newShots.length === 0) {
    throw new ProfileError(
      "VALIDATION",
      "Orientation modifiée — fournissez aussi de nouvelles captures compatibles.",
    );
  }
  if (data.categories !== undefined && data.categories.length === 0) {
    throw new ProfileError("VALIDATION", "Au moins une catégorie.");
  }

  const nameChanged = data.name !== undefined && data.name !== row.name;
  const linksChanged =
    mergedLinks !== undefined && canonicalLinks(mergedLinks) !== canonicalLinks(row.links);
  const rereview = row.status === "published" && (nameChanged || linksChanged);
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
  }

  // Reachability seulement si les liens changent vraiment (pas à chaque
  // édition) ; règles matrice seulement sur fiche en ligne (ni draft ni
  // pending : travail en cours, la revue tranche) — SAUF publication
  // depuis l'édition (mêmes règles que la création publish).
  if (linksChanged && mergedLinks) await assertLinksReachable(mergedLinks);
  if (mergedLinks !== undefined && (row.status === "published" || toQueue)) {
    assertLinkRules({
      productType: data.productType ?? row.productType,
      audience: data.audience ?? row.audience,
      pricingModel: data.pricingModel ?? row.pricingModel,
      links: mergedLinks,
    });
  }
  if (toQueue && mergedLinks === undefined) {
    // Liens intouchés mais publication : valider l'existant stocké.
    assertLinkRules({
      productType: data.productType ?? row.productType,
      audience: data.audience ?? row.audience,
      pricingModel: data.pricingModel ?? row.pricingModel,
      links: row.links as Record<string, string>,
    });
  }
  if (rereview) {
    // Nom/liens d'une fiche publiée : re-revue (anti-squat, anti-lien-piège).
  }

  const patch: Partial<typeof products.$inferInsert> = { updatedAt: new Date() };
  for (const [key, value] of Object.entries(restData)) {
    if (key === "links" || value === undefined) continue;
    (patch as Record<string, unknown>)[key] = value;
  }
  if (mergedLinks !== undefined) patch.links = mergedLinks;
  if (
    data.productType !== undefined &&
    DEV_FACING.has(data.productType) &&
    data.installCommand === undefined &&
    !row.installCommand
  ) {
    throw new ProfileError("VALIDATION", "Commande d'installation requise pour ce type.");
  }
  if (rereview) {
    patch.status = "pending";
    patch.rejectionReason = null;
  }
  if (toQueue) {
    patch.status = "pending";
    patch.rejectionReason = null;
  }
  // Retour en file (publication, re-soumission, re-revue) : nouveau cycle
  // SLA (D0) — la date de (re-)soumission, jamais la naissance du brouillon.
  if (patch.status === "pending") patch.submittedAt = new Date();
  const [updated] = await db
    .update(products)
    .set(patch)
    .where(eq(products.id, productId))
    .returning({ slug: products.slug, status: products.status });

  // Nouveaux médias : remplacement total (logo + galerie), anciens objets
  // R2 purgés best-effort. Absents = conservés (jamais d'effacement vide).
  // (newShots + effectiveOrientation calculés avant tout commit, voir plus haut.)
  if (editLogo || newShots.length > 0) {
    if (!r2Configured()) {
      throw new ProfileError("VALIDATION", "Upload indisponible (stockage non configuré).");
    }
    if (newShots.length > MAX_SHOTS) {
      throw new ProfileError("VALIDATION", `${MAX_SHOTS} captures maximum.`);
    }
    // iconUrl déjà lu sur `row` (pas de re-select) ; R2 purgé best-effort.
    const oldShots =
      newShots.length > 0
        ? await db
            .select({ url: productScreenshots.url })
            .from(productScreenshots)
            .where(eq(productScreenshots.productId, productId))
        : [];
    const prepared = await uploadProductFiles(productId, editLogo, newShots, effectiveOrientation);
    if (prepared.logoUrl) {
      const oldKey = r2KeyFromUrl(row.iconUrl);
      if (oldKey) await deleteR2Object(PRODUCT_LOGOS_BUCKET, oldKey).catch(() => {});
      await db
        .update(products)
        .set({ iconUrl: prepared.logoUrl })
        .where(eq(products.id, productId));
    }
    if (prepared.shots.length > 0) {
      await db.delete(productScreenshots).where(eq(productScreenshots.productId, productId));
      await db.insert(productScreenshots).values(
        prepared.shots.map((s, i) => ({
          productId,
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
    await cleanupStaged(staged.stagedKeys);
  }
  return { slug: updated.slug, status: updated.status, rereview };
}

// ── Revue (staff) ─────────────────────────────────────────────────────────
/**
 * Tranche une soumission : pending → published (published_at = now) ou
 * rejected (motif OBLIGATOIRE — emailé). Retourne l'identité pour la
 * notification (best-effort, comme appeals).
 */
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
  const [row] = await db
    .select({ id: products.id, name: products.name, status: products.status })
    .from(products)
    .where(eq(products.id, input.productId))
    .limit(1);
  if (!row) throw new ProfileError("NOT_FOUND", "Produit introuvable.");
  if (row.status !== "pending") {
    throw new ProfileError("CONFLICT", "Seules les soumissions en attente se tranchent.");
  }
  const reason = (input.reason ?? "").trim();
  if (input.decision === "rejected" && reason === "") {
    throw new ProfileError("VALIDATION", "Motif de rejet requis (emailé au maker).");
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
 * Engagement batch (4C) : vues + clics sortants par produit, 2 requêtes
 * groupées (jamais N×2). Sert le dashboard maker et le profil public.
 * Produits inconnus = absents (l'appelant complète à 0).
 */
export async function getProductsEngagement(
  productIds: string[],
): Promise<Record<string, { views: number; clicks: number; views7d: number; clicks7d: number }>> {
  if (productIds.length === 0) return {};
  const weekAgo = new Date(Date.now() - 7 * 24 * 3_600_000).toISOString();
  const [viewRows, clickRows, view7Rows, click7Rows] = await Promise.all([
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
  ]);
  const out: Record<string, { views: number; clicks: number; views7d: number; clicks7d: number }> =
    {};
  const cell = (id: string) => (out[id] ??= { views: 0, clicks: 0, views7d: 0, clicks7d: 0 });
  for (const r of viewRows) cell(r.productId).views = r.n;
  for (const r of clickRows) cell(r.productId).clicks = r.n;
  for (const r of view7Rows) cell(r.productId).views7d = r.n;
  for (const r of click7Rows) cell(r.productId).clicks7d = r.n;
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
  totals: { products: number; upvotes: number };
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
    },
  };
}
