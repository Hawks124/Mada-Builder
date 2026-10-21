// Backend products : CRUD, statuts, RLS, compteurs, R2 (put/get/delete
// de test + nettoyage après soi). Règles médias/orientation testées au
// niveau service (portes réellement empruntées par le submit). Échecs R2
// (clés absentes) = skip documenté, jamais rouge (le stockage se vérifie
// avec r2-setup). Usage: npm run db:setup (une fois) puis
// npx tsx scripts/verify-products-backend.ts
import "./_env";
import sharp from "sharp";
import { db } from "@/db";
import {
  products,
  productScreenshots,
  productLinkClicks,
  productDownloads,
  votes,
  productPageViews,
  users,
} from "@/db/schema";
import {
  putR2Object,
  deleteR2Object,
  listR2Keys,
  r2Configured,
  r2Key,
  PRODUCT_LOGOS_BUCKET,
  PRODUCT_SHOTS_BUCKET,
} from "@/lib/r2";
import {
  ImageRejectedError,
  classifyShotOrientation,
  detectImageKind,
  extForKind,
  measureImage,
  processImage,
} from "@/lib/images";
import {
  countPendingRevisions,
  isListedProduct,
  parseLinkFields,
  purgeStaleDrafts,
  reviewProduct,
  submitProduct,
  assertLinkRules,
  fetchProductBySlug,
  fetchProductForPreview,
  logOutboundClick,
  logProductView,
  toDashboardApp,
  toEditApp,
  toReviewItem,
  updateProduct,
  reviewRevision,
} from "@/services/products.service";
import { hasAccessPoint } from "@/config/product-links";
import {
  classerFeatured,
  featuredPriorite,
  getFeatured,
  getRelatedProducts,
  type FeaturedCandidate,
} from "@/services/ranking.service";
import { searchProducts } from "@/services/discover.service";
import type { DashboardRow, ReviewQueueRow } from "@/services/products.service";
import { parseProductForm } from "@/app/api/v1/products/product-forms";
import { ProfileError } from "@/services/users.service";
import { deleteAccount } from "@/services/users.service";
import { createAdminClient } from "@/lib/supabase/admin";
import { eq, and, isNull, sql } from "drizzle-orm";
import { assertVersionAllowed, diffBuildIdentity } from "@/services/builds.service";
import { countPublishedByCategory, getRealCounts } from "@/services/catalog-counts.service";
import { safeJsonLd } from "@/lib/safe-json-ld";
import { productBuilds, productRevisions } from "@/db/schema";
import { KNOWN_LINK_IDS } from "@/services/products.service";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    pass++;
  } else {
    fail++;
    console.error(`FAIL: ${name}`);
  }
}

const TAG = `verify-${Date.now()}`;

/**
 * Purge des compteurs de rate-limit des comptes de test.
 *
 * Le quota produit est 10 soumissions/h par compte, et ce script en crée
 * davantage : sans cette purge, le run se heurte « Trop de soumissions »
 * au milieu et crashe. On ne touche PAS au quota produit (il est juste,
 * 10/h convient à un humain) — c'est l'état du limiteur des comptes
 * factices qu'on remet à zéro, comme on purge leurs fiches.
 */
async function resetVerifyLimits(uids: string[]): Promise<void> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return; // non configuré : rate-limit désactivé, rien à faire
  try {
    const { Redis } = await import("@upstash/redis");
    const redis = new Redis({ url, token });
    // Clés réelles = `builder:<namespace>:<id>:<bucket>` (fenêtre glissante :
    // Upstash suffixe chaque seau). On SCAN donc sur le motif du compte,
    // jamais de DEL aveugle — les autres namespaces sont intacts.
    for (const uid of uids) {
      const pattern = `builder:products:submit:${uid}:*`;
      let cursor = "0";
      do {
        const res = (await redis.scan(cursor, { match: pattern, count: 100 })) as unknown;
        const [next, keys] = Array.isArray(res)
          ? (res as [string, string[]])
          : [
              String((res as { cursor?: string })?.cursor ?? "0"),
              (res as { keys?: string[] })?.keys ?? [],
            ];
        if (keys.length > 0) await redis.del(...keys);
        cursor = String(next ?? "0");
      } while (cursor !== "0");
    }
  } catch {
    // Best-effort : si Redis est injoignable, le limiteur fail-open (§16).
  }
}

/** Comptes factices du script — purge garantie (filet de fin + filet de crash). */
const VERIFY_EMAILS = [
  "verify-products@example.com",
  "verify-products-2@example.com",
  "verify-backend@example.com",
] as const;

/**
 * Garde anti-pollution : ce script écrit de VRAIES lignes (comptes,
 * produits, votes, captures R2) dans la base du projet. Aucune base de
 * test dédiée n'est configurée : il refuse donc de tourner sur une base
 * Supabase managée (données réelles) sans opt-in explicite.
 * Relance : `VERIFY_ALLOW_PROD=1 npx tsx scripts/verify-products-backend.ts`
 */
function assertVerifyTarget(): void {
  const isManaged =
    /supabase\.(co|com)/.test(process.env.DATABASE_URL ?? "") ||
    /supabase\.(co|com)/.test(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  if (!isManaged) return; // base locale : aucun risque, pas de garde
  if (process.env.VERIFY_ALLOW_PROD === "1") return;
  console.error(
    "verify-products-backend : refus de tourner sur une base Supabase managée.\n" +
      "  Les fixtures (comptes factices + produits) touchent la base réelle.\n" +
      "  Relance avec VERIFY_ALLOW_PROD=1 si c'est intentionnel.",
  );
  process.exit(2);
}

/**
 * Filet de CRASH. `main()` purge ses fixtures en fin de parcours, mais ce
 * texte est du code inliné : le moindre `throw` en amont (R2, réseau)
 * court-circuite la purge et laissait les comptes factices en base. Ce
 * filet referme par email — lignes `users` d'abord (cascade produits),
 * puis fantômes `auth` — quoi qu'il arrive. Best-effort : une erreur de
 * purge ne masque jamais le crash d'origine.
 */
async function purgeVerifyAccounts(): Promise<void> {
  const admin = createAdminClient();
  for (const email of VERIFY_EMAILS) {
    try {
      const stale = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      if (stale[0]) await deleteAccount(stale[0].id, stale[0].id);
      const listed = await admin.auth.admin.listUsers({ perPage: 100 });
      const ghost = listed.data.users.find((u) => u.email?.toLowerCase() === email);
      if (ghost) await admin.auth.admin.deleteUser(ghost.id);
    } catch {
      // best-effort : la purge de fin de run (si elle a lieu) fera le tour.
    }
  }
}

assertVerifyTarget();

async function main(): Promise<void> {
  // Maker dédié (hermétique, purge seeds compatible) : le compte seed
  // historique a été purgé — ce script crée le sien si absent.
  let [maker] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, "verify-backend@example.com"))
    .limit(1);
  if (!maker) {
    const admin = createAdminClient();
    const created = await admin.auth.admin.createUser({
      email: "verify-backend@example.com",
      email_confirm: true,
      user_metadata: { display_name: "Vérif Backend" },
    });
    if (created.error || !created.data.user) throw new Error("Maker verify incréable");
    [maker] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, created.data.user.id))
      .limit(1);
    if (!maker) throw new Error("Ligne maker absente (trigger ?)");
  }

  // 1. CRUD draft → pending → published + slug unique.
  const slug = `verify-produit-${TAG}`;
  const [created] = await db
    .insert(products)
    .values({
      slug,
      makerId: maker.id,
      name: "Produit Vérif",
      tagline: "Tagline de vérification.",
      description: "Description.",
      category: "outils",
      status: "draft",
    })
    .returning({ id: products.id });
  check("création draft", Boolean(created?.id));
  const productId = created.id;

  await db.update(products).set({ status: "pending" }).where(eq(products.id, productId));
  await db
    .update(products)
    .set({ status: "published", publishedAt: new Date() })
    .where(eq(products.id, productId));
  const [pub] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
  check("statuts + published_at", pub.status === "published" && pub.publishedAt !== null);

  let dup = false;
  try {
    await db.insert(products).values({
      slug,
      makerId: maker.id,
      name: "Doublon",
      tagline: "x",
      description: "x",
      category: "outils",
    });
  } catch {
    dup = true;
  }
  check("slug unique", dup);

  // 2. Screenshots ordonnés.
  await db.insert(productScreenshots).values([
    { productId, url: "https://example.com/2.png", position: 2 },
    { productId, url: "https://example.com/1.png", position: 1 },
  ]);
  const shots = await db
    .select()
    .from(productScreenshots)
    .where(eq(productScreenshots.productId, productId))
    .orderBy(productScreenshots.position);
  check("screenshots ordonnés", shots.length === 2 && shots[0].position === 1);

  // 3. Vote unique + compteur dénormalisé (transaction).
  await db.transaction(async (tx) => {
    await tx.insert(votes).values({ userId: maker.id, productId, weight: 1 });
    await tx
      .update(products)
      .set({ upvoteCount: sql`${products.upvoteCount} + 1` })
      .where(eq(products.id, productId));
  });
  let dupVote = false;
  try {
    await db.insert(votes).values({ userId: maker.id, productId });
  } catch {
    dupVote = true;
  }
  check("vote unique", dupVote);
  const [counted] = await db
    .select({ upvoteCount: products.upvoteCount })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  check("compteur +1", counted.upvoteCount === 1);

  // 4. Vues anonymes.
  await db.insert(productPageViews).values({ productId });
  const views = await db
    .select({ id: productPageViews.id })
    .from(productPageViews)
    .where(eq(productPageViews.productId, productId));
  check("vue anonyme", views.length === 1);

  // 5. R2 (skip si non configuré).
  if (!r2Configured()) {
    console.log("SKIP: R2 non configuré (voir r2-setup)");
  } else {
    const key = `${productId}/verify-${TAG}.webp`;
    const url = await putR2Object(
      PRODUCT_LOGOS_BUCKET,
      key,
      Buffer.from("RIFF....WEBP"),
      "image/webp",
    );
    check("R2 put → URL publique (racine par bucket)", url.endsWith(`/${key}`));
    await deleteR2Object(PRODUCT_LOGOS_BUCKET, key);
    check("R2 delete (best-effort)", true);
  }

  // 6. Nettoyage après soi (ordre FK : vues, votes, shots, produit).
  await db.delete(productPageViews).where(eq(productPageViews.productId, productId));
  await db.delete(votes).where(and(eq(votes.productId, productId), eq(votes.userId, maker.id)));
  await db.delete(productScreenshots).where(eq(productScreenshots.productId, productId));
  await db.delete(products).where(eq(products.id, productId));
  const [gone] = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);
  check("nettoyage total", !gone);

  // 7. Pipeline images (offline — PNG générés, jamais de fixtures).
  const portraitPng = await sharp({
    create: { width: 400, height: 800, channels: 3, background: { r: 10, g: 120, b: 200 } },
  })
    .png()
    .toBuffer();
  const measured = await measureImage(portraitPng);
  check("mesure 400x800", measured.width === 400 && measured.height === 800);
  check("classé portrait", classifyShotOrientation(400, 800, "landscape") === "portrait");
  check("carré hérite", classifyShotOrientation(500, 500, "portrait") === "portrait");
  const shotOut = await processImage(portraitPng, {
    maxInputBytes: 10 * 1024 * 1024,
    minPx: 400,
    outPx: 1600,
    outQuality: 80,
    maxOutBytes: 4 * 1024 * 1024,
    fit: "inside",
    maxLongEdge: 1600,
  });
  const shotMeta = await sharp(shotOut).metadata();
  check("inside préserve le ratio", shotMeta.width === 400 && shotMeta.height === 800);
  check(
    "sortie webp",
    shotOut.subarray(0, 4).toString("ascii") === "RIFF" &&
      shotOut.subarray(8, 12).toString("ascii") === "WEBP",
  );
  const logoPng = await sharp({
    create: {
      width: 800,
      height: 400,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
  const logoOut = await processImage(logoPng, {
    maxInputBytes: 10 * 1024 * 1024,
    minPx: 256,
    outPx: 512,
    outQuality: 82,
    maxOutBytes: 2 * 1024 * 1024,
    fit: "contain-square",
  });
  const logoMeta = await sharp(logoOut).metadata();
  check("logo contain 512x512 (jamais coupé)", logoMeta.width === 512 && logoMeta.height === 512);
  // GIF (lot 4) : détecté, validé, mais JAMAIS ré-encodé — une conversion
  // WebP aplatit l'animation, qui est le contenu même d'une capture.
  const gif = await sharp({
    create: { width: 400, height: 800, channels: 3, background: { r: 0, g: 200, b: 100 } },
  })
    .gif()
    .toBuffer();
  check("GIF détecté", detectImageKind(gif) === "gif");
  const gifOut = await processImage(gif, {
    maxInputBytes: 10 * 1024 * 1024,
    minPx: 400,
    outPx: 1600,
    outQuality: 80,
    maxOutBytes: 4 * 1024 * 1024,
    fit: "inside",
    maxLongEdge: 1600,
    allowGif: true,
  });
  check("GIF passthrough (GIF89a conservé)", gifOut.subarray(0, 3).toString("ascii") === "GIF");
  check("GIF octets identiques (animation intacte)", gifOut.equals(gif));
  check("extension GIF", extForKind(detectImageKind(gif)!) === "gif");

  // GIF petit : un export d'animation fait naturellement 240x480 — le
  // seuil de 400 px (côté court) le refusait à tort. Les GIF ont
  // leur propre plancher (200 px), les images fixes gardent 400.
  const smallGif = await sharp({
    create: { width: 240, height: 480, channels: 3, background: { r: 5, g: 90, b: 160 } },
  })
    .gif()
    .toBuffer();
  let smallGifOk = false;
  try {
    await processImage(smallGif, {
      maxInputBytes: 10 * 1024 * 1024,
      minPx: 400,
      outPx: 1600,
      outQuality: 80,
      maxOutBytes: 4 * 1024 * 1024,
      fit: "inside",
      maxLongEdge: 1600,
      allowGif: true,
    });
    smallGifOk = true;
  } catch {
    smallGifOk = false;
  }
  check("GIF 240x480 accepté (règle côté long)", smallGifOk);

  // La règle doit être la MÊME en portrait et en paysage : un GIF
  // 480x240 (paysage) est accepté comme un 240x480 (portrait). C'est
  // le côté LONG qui compte pour un GIF, pas le court.
  const smallGifLandscape = await sharp({
    create: { width: 480, height: 240, channels: 3, background: { r: 5, g: 90, b: 160 } },
  })
    .gif()
    .toBuffer();
  let smallGifLandscapeOk = false;
  try {
    await processImage(smallGifLandscape, {
      maxInputBytes: 10 * 1024 * 1024,
      minPx: 400,
      outPx: 1600,
      outQuality: 80,
      maxOutBytes: 4 * 1024 * 1024,
      fit: "inside",
      maxLongEdge: 1600,
      allowGif: true,
    });
    smallGifLandscapeOk = true;
  } catch {
    smallGifLandscapeOk = false;
  }
  check("GIF 480x240 accepté (même règle en paysage)", smallGifLandscapeOk);

  // GIF petit dans LES DEUX sens : refusé (rien à l'écran).
  let tinyGifRejected = false;
  try {
    await processImage(
      await sharp({
        create: { width: 240, height: 240, channels: 3, background: { r: 9, g: 9, b: 9 } },
      })
        .gif()
        .toBuffer(),
      {
        maxInputBytes: 10 * 1024 * 1024,
        minPx: 400,
        outPx: 1600,
        outQuality: 80,
        maxOutBytes: 4 * 1024 * 1024,
        fit: "inside",
        maxLongEdge: 1600,
        allowGif: true,
      },
    );
  } catch (e) {
    tinyGifRejected = e instanceof Error && e.message.includes("côté long");
  }
  check("GIF 240x240 refusé (trop petit dans les deux sens)", tinyGifRejected);

  // Le logo n'accepte PAS le GIF (animation inutile, pas de recadrage carré).
  let logoGifRejected = false;
  try {
    await processImage(gif, {
      maxInputBytes: 10 * 1024 * 1024,
      minPx: 256,
      outPx: 512,
      outQuality: 82,
      maxOutBytes: 2 * 1024 * 1024,
      fit: "contain-square",
    });
  } catch (e) {
    logoGifRejected = e instanceof Error && e.message.includes("GIF refusés");
  }
  check("logo : GIF refusé", logoGifRejected);

  // Même dimension en PNG : refusé (les images fixes gardent 400 px).
  let smallPngRejected = false;
  try {
    await processImage(
      await sharp({
        create: { width: 240, height: 480, channels: 3, background: { r: 1, g: 2, b: 3 } },
      })
        .png()
        .toBuffer(),
      {
        maxInputBytes: 10 * 1024 * 1024,
        minPx: 400,
        outPx: 1600,
        outQuality: 80,
        maxOutBytes: 4 * 1024 * 1024,
        fit: "inside",
        maxLongEdge: 1600,
        allowGif: true,
      },
    );
  } catch (e) {
    smallPngRejected = e instanceof Error && e.message.includes("400");
  }
  check("PNG 240x480 refusé (400 px inchangé)", smallPngRejected);

  // Avatar : le GIF reste refusé (animation inutile, pas de recadrage carré).
  let avatarGifRejected = false;
  try {
    await processImage(gif, {
      maxInputBytes: 10 * 1024 * 1024,
      minPx: 256,
      outPx: 512,
      outQuality: 82,
      maxOutBytes: 2 * 1024 * 1024,
    });
  } catch (e) {
    avatarGifRejected = e instanceof Error && e.message.includes("GIF refusés");
  }
  check("avatar : GIF refusé", avatarGifRejected);
  const strip = await sharp({
    create: { width: 1200, height: 300, channels: 3, background: { r: 200, g: 50, b: 50 } },
  })
    .png()
    .toBuffer();
  let stripRejected = false;
  try {
    await processImage(strip, {
      maxInputBytes: 10 * 1024 * 1024,
      minPx: 50,
      outPx: 1600,
      outQuality: 80,
      maxOutBytes: 4 * 1024 * 1024,
      fit: "inside",
      maxLongEdge: 1600,
    });
  } catch (e) {
    stripRejected = e instanceof ImageRejectedError;
  }
  check("strip rejeté (aspect 4:1)", stripRejected);
  let tinyRejected = false;
  try {
    await processImage(
      await sharp({
        create: { width: 100, height: 100, channels: 3, background: { r: 0, g: 0, b: 0 } },
      })
        .png()
        .toBuffer(),
      {
        maxInputBytes: 10 * 1024 * 1024,
        minPx: 400,
        outPx: 1600,
        outQuality: 80,
        maxOutBytes: 4 * 1024 * 1024,
        fit: "inside",
        maxLongEdge: 1600,
      },
    );
  } catch (e) {
    tinyRejected = e instanceof ImageRejectedError;
  }
  check("minuscule rejeté (< 400px)", tinyRejected);

  // 8. Porte d'orientation au submit (service, sans fichiers ni réseau —
  // links {} = zéro appel réseau). Maker DÉDIÉ (quota 10/h jamais épuisé
  // entre runs — hermétique) : purge d'un run crashé, création, suppression
  // en fin de section (deleteAccount = ligne publique + cascade produits ;
  // l'utilisateur auth est supprimé explicitement — le service ne le fait
  // pas, c'est l'appelant comme la route DELETE /me).
  const [VERIFY_EMAIL, VERIFY_EMAIL_2] = VERIFY_EMAILS;
  const admin = createAdminClient();
  async function purgeVerifyUser(email: string): Promise<void> {
    const [stale] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (stale) await deleteAccount(stale.id, stale.id);
    // Fantôme auth (run crashé entre les deux suppressions) : balayage.
    try {
      const listed = await admin.auth.admin.listUsers({ perPage: 100 });
      const ghost = listed.data.users.find((u) => u.email?.toLowerCase() === email);
      if (ghost) await admin.auth.admin.deleteUser(ghost.id);
    } catch {
      // best-effort : la création suivante échouera honnêtement si besoin.
    }
  }
  async function createVerifyUser(email: string): Promise<string> {
    await purgeVerifyUser(email);
    const created = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { display_name: "Vérif Products" },
    });
    if (created.error || !created.data.user) {
      throw new Error(`Maker verify incréable : ${created.error?.message ?? "inconnu"}`);
    }
    return created.data.user.id;
  }
  // Deux makers (quota 10/h chacun) : §8 offline (7 submits) + §9 (3 submits).
  const submitter = await createVerifyUser(VERIFY_EMAIL);
  const submitter2 = await createVerifyUser(VERIFY_EMAIL_2);
  // Quota produit = 10 soumissions/h par compte, ce script en fait plus :
  // compteurs remis à zéro (fixtures jetables, cf. resetVerifyLimits).
  await resetVerifyLimits([submitter, submitter2]);
  // ── Brouillon allégé (lot 1) ───────────────────────────────────────────
  // Un brouillon = travail en cours : `name` seul est exigé. Tout le reste
  // est facultatif (miroir `submitDraftSchema`).
  const minimalDraft = await submitProduct({
    viewerId: submitter,
    data: { name: "Brouillon Minimal", productType: "app_web" } as never,
    asDraft: true,
  });
  const [minimalRow] = await db
    .select({
      status: products.status,
      tagline: products.tagline,
      platforms: products.platforms,
      description: products.description,
      orientation: products.galleryOrientation,
      categories: products.categories,
    })
    .from(products)
    .where(eq(products.id, minimalDraft.id));
  check("draft minimal : statut draft", minimalRow?.status === "draft");
  check("draft minimal : pas de tagline", minimalRow?.tagline === "");
  check("draft minimal : pas de description", minimalRow?.description === "");
  check("draft minimal : plateformes vides", (minimalRow?.platforms ?? []).length === 0);
  // `both` sans toggle touché → orientation déduite du type (app_web).
  check("draft minimal : orientation dérivée du type", minimalRow?.orientation === "landscape");
  check("draft minimal : catégorie de repli présente", (minimalRow?.categories ?? []).length === 1);

  let minimalNameRejected = false;
  try {
    await submitProduct({
      viewerId: submitter,
      data: { name: "x", productType: "app_web" } as never,
      asDraft: true,
    });
  } catch (e) {
    minimalNameRejected = e instanceof ProfileError && e.code === "VALIDATION";
  }
  check("draft sans nom : refusé", minimalNameRejected);

  // ── Plateformes ET configuration requise PERSISTÉES (régression) ───────
  // L'objet inserté de `submitProduct` ne portait NI `platforms` NI
  // `requirements` : l'INSERT les omettait, le défaut SQL ([]) s'était
  // appliqué. Les plateformes étaient donc validées puis JETÉES à la
  // création (fiches réelles sans plateforme en base). Ces deux
  // champs sont désormais dans l'INSERT.
  const withPlatforms = await submitProduct({
    viewerId: submitter,
    data: {
      name: "Produit Plateformes",
      productType: "app_mobile",
      tagline: "Tagline de vérification.",
      description: "Description assez longue pour passer la validation.",
      category: "dev-tools",
      platforms: ["ios", "android", "web"],
      requirements: ["Node 20+"],
      pricingModel: "free",
      lifecycle: "live",
      audience: "all",
      galleryOrientation: "portrait",
      links: { website: "https://example.com/platformes" },
    } as never,
    asDraft: true,
  });
  const [platformRow] = await db
    .select({ platforms: products.platforms, requirements: products.requirements })
    .from(products)
    .where(eq(products.id, withPlatforms.id));
  check(
    "création : plateformes persistées",
    JSON.stringify(platformRow?.platforms) === JSON.stringify(["ios", "android", "web"]),
  );
  check(
    "création : configuration requise persistée",
    JSON.stringify(platformRow?.requirements) === JSON.stringify(["Node 20+"]),
  );
  await db.delete(products).where(eq(products.id, withPlatforms.id));

  // ── APERÇU : garde propriétaire / staff / tiers ──────────────────────────
  // L'aperçu montre une fiche PAS (encore) publiée : il ne doit être
  // visible que par son propriétaire ou par un staff. Un tiers → `null`
  // (la route répond 404, jamais 403 : on ne confirme pas l'existence
  // d'une fiche non publiée).
  const previewOwner = await submitProduct({
    viewerId: submitter,
    data: {
      name: "Fiche Apercu Test",
      tagline: "Tagline de vérification.",
      description: "Description assez longue pour passer la validation.",
      category: "dev-tools",
      categories: ["dev-tools"],
      platforms: ["web"],
      productType: "app_web",
      pricingModel: "free",
      lifecycle: "live",
      audience: "all",
      galleryOrientation: "landscape",
      links: { website: "https://example.com/apercu" },
    } as never,
    asDraft: true,
  });
  const asOwner = await fetchProductForPreview(submitter, previewOwner.id);
  check("aperçu : le propriétaire voit sa fiche", asOwner !== null);
  const asStaff = await fetchProductForPreview(submitter2, previewOwner.id, { isStaff: true });
  check("aperçu : un staff voit la fiche", asStaff !== null);
  const asThird = await fetchProductForPreview(submitter2, previewOwner.id);
  check("aperçu : un tiers ne voit rien", asThird === null);
  const asUnknown = await fetchProductForPreview(submitter, "00000000-0000-0000-0000-000000000000");
  check("aperçu : id inconnu → rien", asUnknown === null);
  await db.delete(products).where(eq(products.id, previewOwner.id));

  // Publication depuis l'édition : le contrat de PUBLICATION est
  // revalidé sur la fiche effective (une fiche sans plateforme ne peut
  // pas partir en file).
  const draftNoPlatform = await submitProduct({
    viewerId: submitter,
    data: { name: "Brouillon Sans Plateforme", productType: "app_web" } as never,
    asDraft: true,
  });
  let publishFromEditRejected = false;
  try {
    await updateProduct(
      submitter,
      draftNoPlatform.id,
      {},
      {
        logo: new File([logoPng], "logo.png", { type: "image/png" }),
        screenshots: [new File([portraitPng], "shot.png", { type: "image/png" })],
      },
      { publish: true },
    );
  } catch (e) {
    publishFromEditRejected = e instanceof ProfileError && e.code === "VALIDATION";
  }
  check("publication depuis l'édition sans plateformes : refusée", publishFromEditRejected);
  await db.delete(products).where(eq(products.id, draftNoPlatform.id));

  let publishNoPlatform = false;
  try {
    await submitProduct({
      viewerId: submitter,
      data: {
        name: "Publish Sans Plateforme",
        productType: "app_web",
        tagline: "Tagline de vérification.",
        description: "Description assez longue pour passer la validation.",
        category: "dev-tools",
        platforms: [],
        pricingModel: "free",
        lifecycle: "live",
        audience: "all",
        galleryOrientation: "landscape",
        links: { website: "https://example.com" },
      } as never,
      asDraft: false,
    });
  } catch (e) {
    publishNoPlatform = e instanceof ProfileError && e.code === "VALIDATION";
  }
  check("publish sans plateforme : refusé", publishNoPlatform);

  // ── installCommand n'est plus requis (lot 2/D) ──────────────────────────
  let devNoInstallOk = true;
  try {
    await submitProduct({
      viewerId: submitter,
      data: {
        name: "CLI Sans Commande",
        productType: "cli",
        tagline: "Tagline de vérification.",
        description: "Description assez longue pour passer la validation.",
        category: "dev-tools",
        platforms: ["cli"],
        pricingModel: "free",
        lifecycle: "live",
        audience: "all",
        galleryOrientation: "landscape",
        links: { registry: "https://www.npmjs.com/package/verify-cli" },
      } as never,
      asDraft: true,
    });
  } catch {
    devNoInstallOk = false;
  }
  check("CLI sans installCommand : accepté", devNoInstallOk);

  const baseData = {
    name: "Produit Vérif Orientation",
    tagline: "Tagline de vérification.",
    description: "Description assez longue pour passer la validation.",
    category: "dev-tools",
    platforms: ["web"],
    pricingModel: "free",
    lifecycle: "live",
    audience: "all",
    links: {},
  };
  // Le type ne verrouille plus l'orientation : un SaaS en portrait est
  // ACCEPTE (le type suggere paysage, le maker choisit librement). La
  // barriere reste sur les CAPTURES, pas sur la declaration.
  const saasPortrait = await submitProduct({
    viewerId: submitter,
    data: { ...baseData, productType: "saas", galleryOrientation: "portrait" },
    asDraft: true,
  });
  const [saasPortraitRow] = await db
    .select({ orientation: products.galleryOrientation })
    .from(products)
    .where(eq(products.id, saasPortrait.id));
  check("saas+portrait accepte (orientation libre)", saasPortraitRow?.orientation === "portrait");
  await db.delete(products).where(eq(products.id, saasPortrait.id));
  await resetVerifyLimits([submitter, submitter2]);
  const okDraft = await submitProduct({
    viewerId: submitter,
    data: { ...baseData, productType: "app_mobile", galleryOrientation: "portrait" },
    asDraft: true,
  });
  const [draftRow] = await db
    .select({ galleryOrientation: products.galleryOrientation, links: products.links })
    .from(products)
    .where(eq(products.id, okDraft.id))
    .limit(1);
  check("orientation persistée", draftRow.galleryOrientation === "portrait");
  check("liens persistés (chemin insert)", JSON.stringify(draftRow.links) === "{}");
  await db.delete(products).where(eq(products.id, okDraft.id));

  // 8b. Correctifs review (offline : drafts, rejet avant tout upload/R2).
  // B3 : le changelog mergé survit à l'édition (update nom, links {}).
  await resetVerifyLimits([submitter, submitter2]);
  const b3 = await submitProduct({
    viewerId: submitter,
    data: {
      ...baseData,
      productType: "app_web",
      galleryOrientation: "landscape",
      changelogUrl: "https://example.com/CHANGELOG",
    },
    asDraft: true,
  });
  await updateProduct(submitter, b3.id, { name: "Produit Vérif B3", links: {} });
  const [b3Row] = await db
    .select({ links: products.links })
    .from(products)
    .where(eq(products.id, b3.id))
    .limit(1);
  check(
    "changelog survit à l'édition (B3)",
    b3Row.links.changelog === "https://example.com/CHANGELOG",
  );
  // B3-bis : changelogUrl à l'update = mergé (plus ignoré). Changement
  // = reachability (réseau requis) : skié sans R2 (proxy réseau).
  if (!r2Configured()) {
    console.log("SKIP: changelog update (réseau)");
  } else {
    await updateProduct(submitter, b3.id, { changelogUrl: "https://example.com/CHANGELOG2" });
    const [b3bRow] = await db
      .select({ links: products.links })
      .from(products)
      .where(eq(products.id, b3.id))
      .limit(1);
    check(
      "changelog update mergé (B3)",
      b3bRow.links.changelog === "https://example.com/CHANGELOG2",
    );
  }
  await db.delete(products).where(eq(products.id, b3.id));
  // M1 : bascule libre sur un type "both" (jeu). L'ancien refus
  // "fournissez aussi de nouvelles captures" a disparu : les captures
  // incompatibles sont purgees, donc la galerie reste honogene.
  const m1 = await submitProduct({
    viewerId: submitter,
    data: {
      ...baseData,
      name: "Produit Vérif M1",
      productType: "game",
      galleryOrientation: "landscape",
    },
    asDraft: true,
  });
  let m1Rejected = false;
  try {
    await updateProduct(submitter, m1.id, { galleryOrientation: "portrait" });
  } catch (e) {
    m1Rejected = e instanceof ProfileError && e.code === "VALIDATION";
  }
  const [m1Row] = await db
    .select({ galleryOrientation: products.galleryOrientation })
    .from(products)
    .where(eq(products.id, m1.id))
    .limit(1);
  check(
    "bascule libre sur un type both (M1)",
    !m1Rejected && m1Row.galleryOrientation === "portrait",
  );
  await db.delete(products).where(eq(products.id, m1.id));
  // M2 : publish sans point d'accès → refus (fichiers fournis mais jamais uploadés).
  // Mi-parcours : compteur de quota (10/h) atteint pour ce compte factice —
  // remise à zéro (cf. resetVerifyLimits), sinon le run crashe ici.
  await resetVerifyLimits([submitter, submitter2]);
  const logoProbe = new File([logoPng], "logo.png", { type: "image/png" });
  const shotProbe = new File([portraitPng], "shot.png", { type: "image/png" });
  let m2Rejected = false;
  try {
    await submitProduct({
      viewerId: submitter,
      data: {
        ...baseData,
        name: "Produit Vérif M2",
        productType: "app_mobile",
        galleryOrientation: "portrait",
      },
      logo: logoProbe,
      screenshots: [shotProbe],
      asDraft: false,
    });
  } catch (e) {
    m2Rejected =
      e instanceof ProfileError && e.code === "VALIDATION" && e.message.includes("point d'accès");
  }
  check("publish sans point d'accès refusé (M2)", m2Rejected);
  // M3 : kids sans liens privacy/kidsafety → refus nommé.
  let m3Rejected = false;
  try {
    await submitProduct({
      viewerId: submitter,
      data: {
        ...baseData,
        name: "Produit Vérif M3",
        productType: "app_mobile",
        galleryOrientation: "portrait",
        audience: "kids",
      },
      logo: logoProbe,
      screenshots: [shotProbe],
      asDraft: false,
    });
  } catch (e) {
    m3Rejected = e instanceof ProfileError && e.code === "VALIDATION";
  }
  check("kids sans liens requis refusé (M3)", m3Rejected);
  // shares_data : déclaration persistée (M4).
  const m4 = await submitProduct({
    viewerId: submitter,
    data: {
      ...baseData,
      name: "Produit Vérif M4",
      productType: "app_mobile",
      galleryOrientation: "portrait",
      sharesData: true,
    },
    asDraft: true,
  });
  const [m4Row] = await db
    .select({ sharesData: products.sharesData })
    .from(products)
    .where(eq(products.id, m4.id))
    .limit(1);
  check("shares_data persisté (M4)", m4Row.sharesData === true);
  await db.delete(products).where(eq(products.id, m4.id));
  // 4A-bis : marchés & langues — roundtrip submit → update (draft, offline).
  await resetVerifyLimits([submitter, submitter2]);
  const bis = await submitProduct({
    viewerId: submitter2,
    data: {
      ...baseData,
      name: "Produit Vérif 4A-bis",
      productType: "app_web",
      galleryOrientation: "landscape",
      targetCountries: ["Madagascar", "France"],
      languagesSupported: ["Français", "Malagasy"],
    },
    asDraft: true,
  });
  const [bisRow] = await db
    .select({
      targetCountries: products.targetCountries,
      languagesSupported: products.languagesSupported,
    })
    .from(products)
    .where(eq(products.id, bis.id))
    .limit(1);
  check(
    "pays + langues persistés (4A-bis)",
    JSON.stringify(bisRow.targetCountries) === JSON.stringify(["Madagascar", "France"]) &&
      JSON.stringify(bisRow.languagesSupported) === JSON.stringify(["Français", "Malagasy"]),
  );
  await updateProduct(submitter2, bis.id, {
    targetCountries: ["Madagascar"],
    languagesSupported: ["Français", "Malagasy", "English"],
  });
  const [bisRow2] = await db
    .select({
      targetCountries: products.targetCountries,
      languagesSupported: products.languagesSupported,
    })
    .from(products)
    .where(eq(products.id, bis.id))
    .limit(1);
  check(
    "pays + langues modifiables en édition (4A-bis)",
    JSON.stringify(bisRow2.targetCountries) === JSON.stringify(["Madagascar"]) &&
      bisRow2.languagesSupported.length === 3,
  );
  await db.delete(products).where(eq(products.id, bis.id));
  // 4B : plein texte FR classé (nom > description) + fallback trigram.
  const [rankNom] = await db
    .insert(products)
    .values({
      slug: `verify-rank-nom-${TAG}`,
      makerId: submitter,
      name: "Tanana Deluxe",
      tagline: "Tagline.",
      description: "Description.",
      category: "dev-tools",
      productType: "app_web",
      pricingModel: "free",
      galleryOrientation: "landscape",
      status: "published",
      publishedAt: new Date(),
    })
    .returning({ id: products.id });
  const [rankDesc] = await db
    .insert(products)
    .values({
      slug: `verify-rank-desc-${TAG}`,
      makerId: submitter,
      name: "Autre Produit",
      tagline: "Tagline.",
      description: "Application pensée pour Tanana et ses environs.",
      category: "dev-tools",
      productType: "app_web",
      pricingModel: "free",
      galleryOrientation: "landscape",
      status: "published",
      publishedAt: new Date(),
    })
    .returning({ id: products.id });
  const ranked = await searchProducts({ q: "tanana" });
  const rankedIds = ranked.items.map((i) => i.id);
  check(
    "plein texte trouve nom + description",
    rankedIds.includes(rankNom.id) && rankedIds.includes(rankDesc.id),
  );
  check(
    "nom (poids A) avant description (poids C)",
    rankedIds.indexOf(rankNom.id) < rankedIds.indexOf(rankDesc.id),
  );
  const typo = await searchProducts({ q: "tananna" });
  check(
    "faute de frappe rattrapée (trigram)",
    typo.items.some((i) => i.id === rankNom.id),
  );
  const none = await searchProducts({ q: "zzzqqqxxx" });
  check("sans match → vide", none.items.length === 0 && none.total === 0);
  await db.delete(products).where(eq(products.id, rankNom.id));
  await db.delete(products).where(eq(products.id, rankDesc.id));
  // 4B : sitemap + robots (imports dynamiques — modules app/).
  const { default: sitemapFn } = await import("@/app/sitemap");
  const sm = await sitemapFn();
  check(
    "sitemap statiques + catégories",
    sm.some((e) => e.url.endsWith("/discover")) && sm.some((e) => e.url.includes("/categories/")),
  );
  const { default: robotsFn } = await import("@/app/robots");
  const rb = await robotsFn();
  const disallow = Array.isArray(rb.rules) ? [] : (rb.rules.disallow ?? []);
  const flat = Array.isArray(disallow) ? disallow : [disallow];
  check(
    "robots bloque privé, sitemap déclaré",
    flat.includes("/admin") && flat.includes("/dashboard") && Boolean(rb.sitemap),
  );
  // SEO-max : metadata fiche (canonical absolue, OG générée, twitter
  // large) + ItemList + route OG (200 image, 404 inconnu).
  const [seoProd] = await db
    .insert(products)
    .values({
      slug: `verify-seo-${TAG}`,
      makerId: submitter,
      name: "Produit Vérif SEO",
      tagline: "Tagline SEO.",
      description: "Description SEO.",
      category: "dev-tools",
      productType: "app_web",
      pricingModel: "free",
      galleryOrientation: "landscape",
      status: "published",
      publishedAt: new Date(),
    })
    .returning({ id: products.id });
  const { generateMetadata } = await import("@/app/(site)/products/[slug]/page");
  const meta = await generateMetadata({ params: Promise.resolve({ slug: `verify-seo-${TAG}` }) });
  const canonical = typeof meta.alternates?.canonical === "string" ? meta.alternates.canonical : "";
  check(
    "canonical absolue",
    canonical.startsWith("http") && canonical.endsWith(`/verify-seo-${TAG}`),
  );
  const ogImages =
    meta.openGraph && typeof meta.openGraph === "object" && "images" in meta.openGraph
      ? (meta.openGraph.images as { url: string }[])
      : [];
  check(
    "OG générée par listing",
    ogImages.length > 0 && ogImages[0].url.includes(`/og/verify-seo-${TAG}`),
  );
  check(
    "twitter large image",
    meta.twitter && typeof meta.twitter === "object" && "card" in meta.twitter
      ? (meta.twitter as { card?: string }).card === "summary_large_image"
      : false,
  );
  const { itemListLd } = await import("@/lib/seo");
  const il = itemListLd([{ slug: "a", name: "A" }], "Liste") as {
    "@type": string;
    itemListElement: { position: number; url: string }[];
  };
  check(
    "ItemList (position + url absolue)",
    il["@type"] === "ItemList" &&
      il.itemListElement[0].position === 1 &&
      il.itemListElement[0].url.startsWith("http"),
  );
  const { GET: ogGet } = await import("@/app/og/[slug]/route");
  const ogRes = await ogGet(new Request("http://localhost/"), {
    params: Promise.resolve({ slug: `verify-seo-${TAG}` }),
  });
  check(
    "route OG 200 image",
    ogRes.status === 200 && (ogRes.headers.get("content-type") ?? "").includes("image/"),
  );
  const ogMissing = await ogGet(new Request("http://localhost/"), {
    params: Promise.resolve({ slug: "slug-qui-nexiste-pas-du-tout" }),
  });
  check("route OG 404 inconnu", ogMissing.status === 404);
  await db.delete(products).where(eq(products.id, seoProd.id));
  // 4C : profil maker public (produits + totaux réels) + engagement batch.
  const [subRow] = await db
    .select({ username: users.username })
    .from(users)
    .where(eq(users.id, submitter))
    .limit(1);
  const [makerProd] = await db
    .insert(products)
    .values({
      slug: `verify-maker-${TAG}`,
      makerId: submitter,
      name: "Produit Vérif Maker",
      tagline: "Tagline.",
      description: "Description.",
      category: "dev-tools",
      productType: "app_web",
      pricingModel: "free",
      galleryOrientation: "landscape",
      status: "published",
      publishedAt: new Date(),
    })
    .returning({ id: products.id });
  await logProductView(makerProd.id);
  await logOutboundClick({ productId: makerProd.id, target: "website" });
  const { getMakerPublicProfile, getProductsEngagement } =
    await import("@/services/products.service");
  const makerProfile = await getMakerPublicProfile(subRow.username);
  check(
    "profil maker : produit listé + totaux",
    makerProfile !== null &&
      makerProfile.products.some((p) => p.id === makerProd.id) &&
      makerProfile.totals.products >= 1 &&
      makerProfile.totals.upvotes >= 0,
  );
  check("profil inconnu → null", (await getMakerPublicProfile("zzz-inconnu")) === null);
  const engagement = await getProductsEngagement([
    makerProd.id,
    "00000000-0000-0000-0000-000000000000",
  ]);
  check(
    "engagement batch : vues + clics",
    engagement[makerProd.id]?.views === 1 && engagement[makerProd.id]?.clicks === 1,
  );
  check("engagement vide → {}", Object.keys(await getProductsEngagement([])).length === 0);
  const { generateMetadata: makerMeta } = await import("@/app/(site)/makers/[username]/page");
  const makerMetadata = await makerMeta({ params: Promise.resolve({ username: subRow.username }) });
  const makerCanonical =
    typeof makerMetadata.alternates?.canonical === "string"
      ? makerMetadata.alternates.canonical
      : "";
  check(
    "metadata maker : canonical absolue",
    makerCanonical.startsWith("http") && makerCanonical.endsWith(`/makers/${subRow.username}`),
  );
  await db.delete(products).where(eq(products.id, makerProd.id));
  // 4D : flux public mobile (keyset nouveautés + recherche paginée).
  const feedIds: string[] = [];
  for (let i = 0; i < 3; i++) {
    const [f] = await db
      .insert(products)
      .values({
        slug: `verify-feed-${i}-${TAG}`,
        makerId: submitter,
        name: `Produit Vérif Feed ${i}`,
        tagline: "Tagline.",
        description: "Description.",
        category: "dev-tools",
        productType: "app_web",
        pricingModel: "free",
        galleryOrientation: "landscape",
        status: "published",
        publishedAt: new Date(Date.now() - i * 3600_000),
      })
      .returning({ id: products.id });
    feedIds.push(f.id);
  }
  const { getPublicProductsFeed } = await import("@/services/discover.service");
  const { encodeKeysetCursor, decodeKeysetCursor } = await import("@/lib/api/pagination");
  const feed1 = await getPublicProductsFeed({ limit: 2 });
  check("feed p1 : 2 items + curseur", feed1.items.length === 2 && feed1.nextCursor !== null);
  // ORDRE : on vérifie l'ordre RELATIF de nos trois produits dans le flux,
  // pas qu'ils occupent les deux premiers slots — la base est partagée
  // (un staff peut publier entre-temps : le test échouait alors à tort).
  const pageLarge = await getPublicProductsFeed({ limit: 50 });
  const rang = (id: string): number => pageLarge.items.findIndex((i) => i.id === id);
  check(
    "feed p1 : ordre nouveautés",
    rang(feedIds[0]!) >= 0 &&
      rang(feedIds[1]!) > rang(feedIds[0]!) &&
      rang(feedIds[2]!) > rang(feedIds[1]!),
  );
  const opaque = encodeKeysetCursor(feed1.nextCursor);
  const feed2 = await getPublicProductsFeed({ limit: 2, cursor: decodeKeysetCursor(opaque) });
  const p1Ids = new Set(feed1.items.map((i) => i.id));
  check(
    "feed p2 : suite sans doublon, fin détectée",
    feed2.items.length >= 1 && feed2.items.every((i) => !p1Ids.has(i.id)),
  );
  // Pagination keyset : pas de saut, pas de doublon, et l'ordre relatif
  // est celui de la page large. On ne suppose PLUS que les 3 produits de
  // test tiennent dans les 2 pages : le catalogue est partagé (une
  // publication staffs entre-temps s'intercale) → le test échouait à
  // tort. Ce qui est vérifié, c'est la continuité de l'ordre.
  const vus = [...feed1.items, ...feed2.items].map((i) => i.id);
  check(
    "feed p1+p2 : pagination continue, sans saut ni doublon",
    vus.length === new Set(vus).size &&
      vus.every((id, idx) => {
        const r = rang(id);
        return r >= 0 && (idx === 0 || rang(vus[idx - 1]!) < r);
      }),
  );
  check(
    "curseur ordure → p1",
    (await getPublicProductsFeed({ limit: 2, cursor: decodeKeysetCursor("ordure") })).items
      .length === 2,
  );
  const feedQ = await getPublicProductsFeed({ limit: 10, q: "Feed", page: 1 });
  check(
    "recherche mobile : pertinence + page/total",
    feedQ.nextCursor === null && feedQ.page === 1 && (feedQ.total ?? 0) >= 3,
  );
  const detail = await fetchProductBySlug(`verify-feed-0-${TAG}`);
  check(
    "détail mobile : fiche complète",
    detail !== null &&
      detail.slug === `verify-feed-0-${TAG}` &&
      Array.isArray(detail.screenshots) &&
      typeof detail.makerUsername === "string",
  );
  for (const id of feedIds) await db.delete(products).where(eq(products.id, id));
  // Submit UX : erreurs nommées + publish depuis l'édition + médias édition.
  let namedTagline = false;
  try {
    await submitProduct({
      viewerId: submitter,
      // Publique (et non brouillon) : la tagline est requise au publish —
      // le brouillon, lui, ne l'exige plus (cf. `submitDraftSchema`).
      data: { ...baseData, productType: "app_web", galleryOrientation: "landscape", tagline: "" },
      asDraft: false,
    });
  } catch (e) {
    namedTagline =
      e instanceof ProfileError && e.code === "VALIDATION" && e.message.includes("Tagline");
  }
  check("erreur nommée (Tagline)", namedTagline);
  const draftPub = await submitProduct({
    viewerId: submitter2,
    data: {
      ...baseData,
      name: "Produit Vérif PublishEdit",
      productType: "app_web",
      galleryOrientation: "landscape",
      links: { website: "https://example.com/publish-edit" },
    },
    asDraft: true,
  });
  let publishBlocked = false;
  try {
    await updateProduct(submitter2, draftPub.id, {}, undefined, { publish: true });
  } catch (e) {
    publishBlocked =
      e instanceof ProfileError && e.code === "VALIDATION" && e.message.includes("Logo");
  }
  check("publish sans médias refusé (édition)", publishBlocked);
  const [stillDraft] = await db
    .select({ status: products.status })
    .from(products)
    .where(eq(products.id, draftPub.id))
    .limit(1);
  check("statut conservé après refus", stillDraft.status === "draft");
  const { getEditMedia } = await import("@/services/products.service");
  const editMedia = await getEditMedia(submitter2, draftPub.id);
  check(
    "médias édition (vide = conservés)",
    editMedia.iconUrl === null && editMedia.shots.length === 0,
  );
  let foreignMedia = false;
  try {
    await getEditMedia(submitter, draftPub.id);
  } catch (e) {
    foreignMedia = e instanceof ProfileError && e.code === "FORBIDDEN";
  }
  check("médias d'autrui interdits", foreignMedia);
  // Publish-transition avec fichiers (si R2) : draft → pending.
  const r2KeyFromPublicUrl = (url: string): string | null => {
    try {
      const key = new URL(url).pathname.replace(/^\/+/, "");
      return key !== "" ? key : null;
    } catch {
      return null;
    }
  };
  // Publish-transition avec fichiers (si R2) : draft → pending.
  if (!r2Configured()) {
    console.log("SKIP: publish-transition fichiers sans R2");
  } else {
    const landPng = await sharp({
      create: { width: 800, height: 400, channels: 3, background: { r: 50, g: 200, b: 50 } },
    })
      .png()
      .toBuffer();
    const pubFiles = await updateProduct(
      submitter2,
      draftPub.id,
      {},
      {
        logo: new File([logoPng], "logo.png", { type: "image/png" }),
        screenshots: [new File([landPng], "shot.png", { type: "image/png" })],
      },
      { publish: true },
    );
    check("publish-transition → pending", pubFiles.status === "pending");
    const [pubRow] = await db
      .select({ iconUrl: products.iconUrl })
      .from(products)
      .where(eq(products.id, draftPub.id))
      .limit(1);
    check("logo stocké (transition)", (pubRow.iconUrl ?? "").endsWith(".webp"));
    const mediaAfter = await getEditMedia(submitter2, draftPub.id);
    check(
      "médias visibles après transition",
      mediaAfter.iconUrl !== null && mediaAfter.shots.length === 1,
    );
    check(
      "getEditMedia expose l'orientation mesurée",
      mediaAfter.shots[0]?.orientation === "landscape",
    );
    // Bascule d'orientation (lot 3) : plus aucun refus « fournissez de
    // nouvelles captures » — les captures de l'orientation opposée sont
    // PURGEES (lignes + R2), donc la galerie reste homogène.
    const beforeFlip = await db
      .select({ id: productScreenshots.id })
      .from(productScreenshots)
      .where(eq(productScreenshots.productId, draftPub.id));
    check("capture paysage présente avant bascule", beforeFlip.length === 1);
    const flipped = await updateProduct(submitter2, draftPub.id, {
      productType: "app_web",
      galleryOrientation: "portrait",
    });
    check("bascule portrait acceptée (sans refus)", flipped.status === "pending");
    const [flippedRow] = await db
      .select({ orientation: products.galleryOrientation })
      .from(products)
      .where(eq(products.id, draftPub.id));
    check("orientation enregistrée", flippedRow?.orientation === "portrait");
    const afterFlip = await db
      .select({ url: productScreenshots.url, orientation: productScreenshots.orientation })
      .from(productScreenshots)
      .where(eq(productScreenshots.productId, draftPub.id));
    check("captures hors orientation purgées", afterFlip.length === 0);
    const mediaFlipped = await getEditMedia(submitter2, draftPub.id);
    check("galerie homogène après bascule", mediaFlipped.shots.length === 0);
    // Cleanup R2 (nouveau format racine).
    if (pubRow.iconUrl) {
      const k = r2KeyFromPublicUrl(pubRow.iconUrl);
      if (k) await deleteR2Object(PRODUCT_LOGOS_BUCKET, k).catch(() => {});
    }
    for (const s of mediaAfter.shots) {
      const k = r2KeyFromPublicUrl(s.url);
      if (k) await deleteR2Object(PRODUCT_SHOTS_BUCKET, k).catch(() => {});
    }
  }
  await db.delete(products).where(eq(products.id, draftPub.id));
  // m13 : unicité clés R2 (même milliseconde).
  check("clés R2 uniques", r2Key("p", "logo", "webp") !== r2Key("p", "logo", "webp"));
  // Purge 90 j : précision calendaire (ligne antidatée en SQL brut —
  // $onUpdate interdirait l'antidatage via Drizzle).
  const [purgeRow] = await db
    .insert(products)
    .values({
      slug: `verify-purge-${TAG}`,
      makerId: submitter,
      name: "Produit Vérif Purge",
      tagline: "Tagline.",
      description: "Description.",
      category: "dev-tools",
      status: "draft",
    })
    .returning({ id: products.id });
  await db.execute(
    sql`UPDATE products SET updated_at = NOW() - INTERVAL '100 days' WHERE id = ${purgeRow.id}`,
  );
  const { purged } = await purgeStaleDrafts();
  const [purgeGone] = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.id, purgeRow.id))
    .limit(1);
  check("purge 90 j précise", purged >= 1 && !purgeGone);

  // 9. Submit complet avec fichiers (même skip R2 que §5).
  if (!r2Configured()) {
    console.log("SKIP: submit fichiers sans R2");
  } else {
    const keyFromUrl = (url: string): string | null => {
      try {
        // Format racine par bucket (`{base}/{key}`) : tout après le host.
        const key = new URL(url).pathname.replace(/^\/+/, "");
        return key !== "" ? key : null;
      } catch {
        return null;
      }
    };
    await resetVerifyLimits([submitter, submitter2]);
    const full = await submitProduct({
      viewerId: submitter2,
      data: {
        ...baseData,
        name: "Produit Vérif Fichiers",
        productType: "app_mobile",
        galleryOrientation: "portrait",
        links: { website: "https://example.com/full" },
      },
      logo: new File([logoPng], "logo.png", { type: "image/png" }),
      screenshots: [new File([portraitPng], "shot.png", { type: "image/png" })],
      asDraft: false,
    });
    check("submit pending", full.status === "pending");
    const [fullRow] = await db
      .select({ iconUrl: products.iconUrl, galleryOrientation: products.galleryOrientation })
      .from(products)
      .where(eq(products.id, full.id))
      .limit(1);
    check("logo stocké .webp", fullRow.iconUrl?.endsWith(".webp") ?? false);
    const fullShots = await db
      .select()
      .from(productScreenshots)
      .where(eq(productScreenshots.productId, full.id))
      .orderBy(productScreenshots.position);
    check(
      "capture mesurée + .webp",
      fullShots.length === 1 &&
        fullShots[0].orientation === "portrait" &&
        fullShots[0].width === 400 &&
        fullShots[0].height === 800 &&
        fullShots[0].url.endsWith(".webp"),
    );
    // Quota : 7 captures → refus AVANT tout insert (zéro orphelin).
    const seven = Array.from(
      { length: 7 },
      (_, i) => new File([portraitPng], `s${i}.png`, { type: "image/png" }),
    );
    let quotaRejected = false;
    try {
      await submitProduct({
        viewerId: submitter2,
        data: {
          ...baseData,
          name: "Produit Vérif Quota",
          productType: "app_mobile",
          galleryOrientation: "portrait",
        },
        screenshots: seven,
        asDraft: true,
      });
    } catch (e) {
      quotaRejected = e instanceof ProfileError && e.code === "VALIDATION";
    }
    check("quota 6 refusé au 7e", quotaRejected);
    const [quotaOrphan] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.slug, "produit-verif-quota"))
      .limit(1);
    check("zéro fiche orpheline (quota)", !quotaOrphan);
    // Intrus : capture paysage sur fiche portrait → rejet + rollback total.
    const landPng = await sharp({
      create: { width: 800, height: 400, channels: 3, background: { r: 50, g: 200, b: 50 } },
    })
      .png()
      .toBuffer();
    let mismatchRejected = false;
    try {
      await submitProduct({
        viewerId: submitter2,
        data: {
          ...baseData,
          name: "Produit Vérif Intrus",
          productType: "app_mobile",
          galleryOrientation: "portrait",
        },
        screenshots: [new File([landPng], "land.png", { type: "image/png" })],
        asDraft: true,
      });
    } catch (e) {
      mismatchRejected = e instanceof ProfileError && e.code === "FILE_REJECTED";
    }
    check("intrus paysage rejeté", mismatchRejected);
    const [mismatchOrphan] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.slug, "produit-verif-intrus"))
      .limit(1);
    check("zéro fiche orpheline (intrus)", !mismatchOrphan);
    // M10 : double verdict → un seul compte (second = CONFLICT, jamais
    // deux emails). Liens example.com = 404 → warn (autorisé).
    const m10 = await submitProduct({
      viewerId: submitter2,
      data: {
        ...baseData,
        name: "Produit Vérif M10",
        productType: "app_mobile",
        galleryOrientation: "portrait",
        links: { website: "https://example.com/m10" },
      },
      logo: new File([logoPng], "logo.png", { type: "image/png" }),
      screenshots: [new File([portraitPng], "shot.png", { type: "image/png" })],
      asDraft: false,
    });
    check("m10 pending", m10.status === "pending");
    await reviewProduct({ isStaff: true, productId: m10.id, decision: "approved" });
    let m10Conflict = false;
    try {
      await reviewProduct({
        isStaff: true,
        productId: m10.id,
        decision: "rejected",
        reason: "test",
      });
    } catch (e) {
      m10Conflict = e instanceof ProfileError && e.code === "CONFLICT";
    }
    check("double verdict refusé (M10)", m10Conflict);
    const [m10Row] = await db
      .select({ status: products.status, iconUrl: products.iconUrl })
      .from(products)
      .where(eq(products.id, m10.id))
      .limit(1);
    check("premier verdict gagne (M10)", m10Row.status === "published");
    const m10Shots = await db
      .select({ url: productScreenshots.url })
      .from(productScreenshots)
      .where(eq(productScreenshots.productId, m10.id));
    if (m10Row.iconUrl) {
      const k = keyFromUrl(m10Row.iconUrl);
      if (k) await deleteR2Object(PRODUCT_LOGOS_BUCKET, k);
    }
    for (const s of m10Shots) {
      const k = keyFromUrl(s.url);
      if (k) await deleteR2Object(PRODUCT_SHOTS_BUCKET, k);
    }
    await db.delete(products).where(eq(products.id, m10.id));
    // Nettoyage R2 (best-effort) + ligne (cascade shots).
    const logoKey = fullRow.iconUrl ? keyFromUrl(fullRow.iconUrl) : null;
    if (logoKey) await deleteR2Object(PRODUCT_LOGOS_BUCKET, logoKey);
    for (const s of fullShots) {
      const k = keyFromUrl(s.url);
      if (k) await deleteR2Object(PRODUCT_SHOTS_BUCKET, k);
    }
    await db.delete(products).where(eq(products.id, full.id));
    const [fullGone] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, full.id))
      .limit(1);
    check("nettoyage submit fichiers", !fullGone);
  }

  // 8c. Règles liens serveur (pures — zéro DB/réseau/quota).
  const siteOnly = { website: "https://example.com" };
  let privacyMonetized = false;
  try {
    assertLinkRules({
      productType: "saas",
      audience: "all",
      pricingModel: "paid",
      links: siteOnly,
    });
  } catch (e) {
    privacyMonetized =
      e instanceof ProfileError && e.code === "VALIDATION" && e.message.includes("confidentialité");
  }
  check("privacy requise si monétisé", privacyMonetized);
  let privacyOk = true;
  try {
    assertLinkRules({
      productType: "saas",
      audience: "all",
      pricingModel: "paid",
      links: { ...siteOnly, privacy: "https://example.com/privacy" },
    });
  } catch {
    privacyOk = false;
  }
  check("privacy fournie : passe", privacyOk);
  let kidsOk = true;
  try {
    assertLinkRules({
      productType: "app_mobile",
      audience: "all",
      pricingModel: "free",
      links: siteOnly,
    });
  } catch {
    kidsOk = false;
  }
  check("gratuit grand public : passe", kidsOk);
  let kidsMissing = false;
  try {
    assertLinkRules({
      productType: "app_mobile",
      audience: "kids",
      pricingModel: "free",
      links: siteOnly,
    });
  } catch (e) {
    kidsMissing = e instanceof ProfileError && e.code === "VALIDATION";
  }
  check("kids sans liens requis refusé", kidsMissing);
  // 8d. Anti-contournement binaire : lien direct interdit sur Android.
  const apkDirect = {
    playstore: "https://play.google.com/store/apps/details?id=com.example",
    download: "https://example.com/app.apk",
  };
  let dlBanned = false;
  try {
    assertLinkRules({
      productType: "app_mobile",
      audience: "all",
      pricingModel: "free",
      platforms: ["android"],
      links: apkDirect,
    });
  } catch (e) {
    dlBanned =
      e instanceof ProfileError &&
      e.code === "VALIDATION" &&
      e.message.includes("Téléchargement direct");
  }
  check("android + lien direct refusé", dlBanned);
  let dlOkSansAndroid = true;
  try {
    assertLinkRules({
      productType: "app_mobile",
      audience: "all",
      pricingModel: "free",
      platforms: ["ios"],
      links: apkDirect,
    });
  } catch {
    dlOkSansAndroid = false;
  }
  check("ios + lien direct accepté", dlOkSansAndroid);
  check(
    "android : download seul ne compte pas comme accès",
    hasAccessPoint({ download: "https://example.com/app.apk" }, { ignoreDownload: true }) === false,
  );
  // 8e. Doctrine RLS deny-all : toute table publique a le RLS actif
  // (drizzle-kit ne le met jamais — c'est comme ça que product_builds
  // a fuité en UNRESTRICTED ; aucune policy = refusé via Data API).
  const rlsOff = (await db.execute(sql`
    SELECT relname FROM pg_class
    JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
    WHERE pg_namespace.nspname = 'public' AND relkind = 'r' AND NOT relrowsecurity
  `)) as unknown as Array<{ relname: string }>;
  check("RLS actif sur toutes les tables publiques", rlsOff.length === 0);
  if (rlsOff.length > 0) {
    console.log("  tables sans RLS : " + rlsOff.map((r) => r.relname).join(", "));
  }

  // 10. Mappers présentation + parse mobile (purs, offline — les pages
  // et routes ne font que brancher ces fonctions).
  // 9b. Fiche DB (4A) : published trouvée, draft/inconnu → null.
  const [fiche] = await db
    .insert(products)
    .values({
      slug: `verify-fiche-${TAG}`,
      makerId: maker.id,
      name: "Produit Vérif Fiche",
      tagline: "Tagline fiche.",
      description: "Description fiche assez longue.",
      category: "dev-tools",
      categories: ["dev-tools"],
      productType: "app_web",
      pricingModel: "free",
      galleryOrientation: "landscape",
      status: "published",
      publishedAt: new Date(),
      upvoteCount: 0,
    })
    .returning({ id: products.id, slug: products.slug });
  const found = await fetchProductBySlug(fiche.slug);
  check("fiche published trouvée", found?.id === fiche.id && found.makerUsername !== undefined);
  const [draftFiche] = await db
    .insert(products)
    .values({
      slug: `verify-fiche-draft-${TAG}`,
      makerId: maker.id,
      name: "Brouillon Fiche",
      tagline: "Tagline.",
      description: "Description.",
      category: "dev-tools",
      productType: "app_web",
      pricingModel: "free",
      galleryOrientation: "landscape",
      status: "draft",
      upvoteCount: 0,
    })
    .returning({ id: products.id });
  const draftFound = await fetchProductBySlug(`verify-fiche-draft-${TAG}`);
  check("draft invisible (null)", draftFound === null);
  await db.delete(products).where(eq(products.id, draftFiche.id));
  const unknownFound = await fetchProductBySlug("slug-qui-nexiste-pas-du-tout");
  check("inconnu → null (pas de fuite)", unknownFound === null);
  // Related : même catégorie, hors soi.
  const [fiche2] = await db
    .insert(products)
    .values({
      slug: `verify-fiche-2-${TAG}`,
      makerId: maker.id,
      name: "Produit Vérif Fiche 2",
      tagline: "Tagline.",
      description: "Description.",
      category: "dev-tools",
      productType: "cli",
      pricingModel: "free",
      galleryOrientation: "landscape",
      status: "published",
      publishedAt: new Date(),
      upvoteCount: 0,
    })
    .returning({ id: products.id });
  const related = await getRelatedProducts(fiche.id, "dev-tools", 3);
  check(
    "related même catégorie hors soi",
    related.some((r) => r.id === fiche2.id) && related.every((r) => r.id !== fiche.id),
  );
  await db.delete(products).where(eq(products.id, fiche2.id));
  // Beacon : clic valide enregistré, invalide silencieux.
  await logOutboundClick({ productId: fiche.id, target: "website" });
  const [clickRow] = await db
    .select({ id: productLinkClicks.id })
    .from(productLinkClicks)
    .where(eq(productLinkClicks.productId, fiche.id))
    .limit(1);
  check("clic sortant enregistré", Boolean(clickRow?.id));
  let beaconSilent = true;
  try {
    await logOutboundClick({
      productId: "00000000-0000-0000-0000-000000000000",
      target: "website",
    });
    await logOutboundClick({ productId: fiche.id, target: "   " });
  } catch {
    beaconSilent = false;
  }
  check("beacon jamais bloquant", beaconSilent);
  await db.delete(products).where(eq(products.id, fiche.id));
  const dashRow = {
    id: "0196a2b3-4c5d-7e8f-90a1-b2c3d4e5f600",
    name: "Vatsy Épargne",
    tagline: "Épargne mobile-money.",
    description: "Description longue.",
    categories: ["fintech"],
    category: "fintech",
    productType: "app_mobile",
    platforms: ["ios", "android"],
    audience: "all",
    pricingModel: "free",
    version: "v1.0.0",
    lifecycle: "beta",
    publishedAt: new Date("2026-03-15T12:00:00Z"),
    createdAt: new Date("2026-09-20T12:00:00Z"),
    tags: ["epargne"],
    upvoteCount: 42,
    status: "published",
    rejectionReason: null,
    links: { website: "https://example.com" },
    hasAds: false,
  } as unknown as DashboardRow & { status: "published" };
  const app = toDashboardApp(dashRow);
  check("published→live", app.status === "live");
  check("labels config", app.productType === "App Mobile" && app.pricing === "Gratuit");
  check("date FR", app.launchedAt.includes("mars 2026"));
  check("votes mappés", app.votes === 42);
  check("zéro faux chiffres", app.views === 0 && app.comments === 0 && app.revenue === undefined);
  check(
    "edit prefill",
    app.description === "Description longue." && app.linkValues?.website === "https://example.com",
  );
  check("draft exclu overview", !isListedProduct({ ...dashRow, status: "draft" }));
  const editDraft = toEditApp({ ...dashRow, status: "draft" });
  check("draft éditable (statut conservé côté service)", editDraft.name === "Vatsy Épargne");
  const pendingRow = {
    ...dashRow,
    status: "pending",
    makerId: "0196a2b3-4c5d-7e8f-90a1-b2c3d4e5f601",
    makerUsername: "kaliana",
    makerDisplayName: "Kaliana",
    makerAvatarUrl: null,
    hasAds: false,
    sharesData: false,
  } as unknown as ReviewQueueRow;
  const review = toReviewItem(pendingRow, { shotCount: 2, makerLive: 3, makerBans: 0 });
  check("revue mappée", review.productName === "Vatsy Épargne" && review.screenshots === 2);
  check("compteurs maker", review.makerLiveCount === 3 && review.makerBans === 0);
  check("pas de faux partage", review.sharesData === false && review.revenue === undefined);
  check("attente calculée", review.waitingHours >= 0 && review.waitingText.length > 0);
  // Parse liens : non-vides = valeur, vides = effacement, absents = rien.
  const fdLinks = new FormData();
  fdLinks.set("website", "https://example.com");
  fdLinks.set("name", "x");
  const parsedLinks = parseLinkFields(Object.fromEntries(fdLinks));
  check(
    "liens parsés",
    parsedLinks !== undefined &&
      JSON.stringify(parsedLinks.links) === '{"website":"https://example.com"}' &&
      parsedLinks.cleared.length === 0,
  );
  const parsedVide = parseLinkFields({ website: "" });
  check(
    "liens : un champ vide = effacement explicite",
    parsedVide !== undefined &&
      Object.keys(parsedVide.links).length === 0 &&
      parsedVide.cleared.includes("website"),
  );
  check("liens absents = conservé", parseLinkFields({ name: "x" }) === undefined);
  const parsedNonString = parseLinkFields({ website: 42 });
  check(
    "valeurs non-string ignorées",
    parsedNonString !== undefined &&
      Object.keys(parsedNonString.links).length === 0 &&
      parsedNonString.cleared.includes("website"),
  );
  // Parse mobile : défaut brouillon, publish explicite, partiel PATCH.
  const fdCreate = new FormData();
  fdCreate.set("name", "App Mobile");
  fdCreate.set("productType", "app_mobile");
  const parsedCreate = parseProductForm(fdCreate);
  check("mobile défaut brouillon", parsedCreate.asDraft === true);
  check(
    "mobile logo absent = null",
    parsedCreate.logo === null && parsedCreate.screenshots.length === 0,
  );
  const fdPublish = new FormData();
  fdPublish.set("intent", "publish");
  check("mobile intent publish", parseProductForm(fdPublish).asDraft === false);
  const fdPatch = new FormData();
  fdPatch.set("tagline", "Nouvelle tagline");
  const parsedPatch = parseProductForm(fdPatch);
  check(
    "mobile PATCH partiel",
    parsedPatch.data.tagline === "Nouvelle tagline" &&
      parsedPatch.data.name === undefined &&
      parsedPatch.data.links === undefined &&
      parsedPatch.data.isChildDirected === undefined,
  );

  // 11. Stats plateforme + rangs + notifs + emails + activité (lots admin).
  const { getProductsCount, getTotalUpvotes, getProductViewsTotal, getOutboundClicksTotal } =
    await import("@/services/stats.service");
  const { getProductRanks } = await import("@/services/ranking.service");
  const { getEmailStats, getProductNotifStatus } = await import("@/services/emails.service");
  const { getRecentActivity } = await import("@/services/activity.service");
  const [cPub, cPend, cDraft, totVotes, totViews, totClicks] = await Promise.all([
    getProductsCount("published"),
    getProductsCount("pending"),
    getProductsCount("draft"),
    getTotalUpvotes(),
    getProductViewsTotal(),
    getOutboundClicksTotal(),
  ]);
  check(
    "compteurs plateforme (nombres)",
    cPub >= 0 && cPend >= 0 && cDraft >= 0 && totVotes >= 0 && totViews >= 0 && totClicks >= 0,
  );
  const ranks = await getProductRanks(["00000000-0000-0000-0000-000000000000"]);
  check("rangs inconnus → {}", Object.keys(ranks).length === 0);
  const notifs = await getProductNotifStatus(["00000000-0000-0000-0000-000000000000"]);
  check("notifs inconnues → {}", Object.keys(notifs).length === 0);
  const emailStats = await getEmailStats();
  check(
    "stats emails (forme)",
    emailStats.sent >= 0 && emailStats.delivered >= 0 && emailStats.failed >= 0,
  );
  const activity = await getRecentActivity(10);
  check("activité récente (tableau)", Array.isArray(activity));
  const { getNotifications } = await import("@/services/notifications.service");
  const bellEmpty = await getNotifications(submitter);
  check("cloche sans notifs → vide", bellEmpty.items.length === 0 && bellEmpty.unreadCount === 0);

  // 12. Curation (veille hors jeu) : flag, refus vote/avis, exclusions.
  const { isCurationAccount } = await import("@/config/curation");
  check(
    "compte curation détecté",
    isCurationAccount("open-sources") && !isCurationAccount("nobody"),
  );
  // Comptes assez vieux pour voter/noter (même règle que les votes).
  await db.execute(
    sql`UPDATE users SET created_at = NOW() - INTERVAL '2 hours' WHERE id = ${submitter}`,
  );
  const [curProd] = await db
    .insert(products)
    .values({
      slug: `verify-curated-${TAG}`,
      makerId: submitter,
      name: "Produit Vérif Veille",
      tagline: "Tagline.",
      description: "Description.",
      category: "dev-tools",
      productType: "app_web",
      pricingModel: "free",
      galleryOrientation: "landscape",
      status: "published",
      publishedAt: new Date(),
      curated: true,
    })
    .returning({ id: products.id });
  const { toggleVote } = await import("@/services/votes.service");
  const { upsertReview } = await import("@/services/feedback.service");
  const { getLeaderboard } = await import("@/services/ranking.service");
  let voteRefused = false;
  try {
    await toggleVote({ viewerId: submitter, productId: curProd.id });
  } catch (e) {
    voteRefused =
      e instanceof ProfileError && e.code === "VALIDATION" && e.message.includes("veille");
  }
  check("vote veille refusé", voteRefused);
  let reviewRefused = false;
  try {
    await upsertReview({
      viewerId: submitter,
      productId: curProd.id,
      rating: 5,
      body: "Avis assez long pour passer.",
    });
  } catch (e) {
    reviewRefused =
      e instanceof ProfileError && e.code === "VALIDATION" && e.message.includes("veille");
  }
  check("avis veille refusé", reviewRefused);
  const boardAll = await getLeaderboard({ window: "all", order: "weighted", page: 1 });
  check("veille hors leaderboard", !boardAll.items.some((i) => i.id === curProd.id));
  await db.delete(products).where(eq(products.id, curProd.id));
  // Tagline 220 + web both : tagline longue acceptée, portrait web accepté.
  await resetVerifyLimits([submitter, submitter2]);
  const longTag = await submitProduct({
    viewerId: submitter2,
    data: {
      ...baseData,
      name: "Produit Vérif Long",
      productType: "app_web",
      galleryOrientation: "portrait",
      tagline: "x".repeat(200),
    },
    asDraft: true,
  });
  const [longRow] = await db
    .select({ tagline: products.tagline, galleryOrientation: products.galleryOrientation })
    .from(products)
    .where(eq(products.id, longTag.id))
    .limit(1);
  check(
    "tagline 220 + web portrait",
    longRow.tagline.length === 200 && longRow.galleryOrientation === "portrait",
  );
  await db.delete(products).where(eq(products.id, longTag.id));

  // 13. Remplacement médias en édition : logo + galerie remplacés
  // (total, pas d'ajout), anciens objets R2 purgés, nouvelles clés
  // présentes. Sauté sans R2. Couvre le chemin réel `updateProduct`
  // (textes seuls ne prouvent rien sur les médias).
  if (!r2Configured()) {
    console.log("SKIP: remplacement médias sans R2");
  } else {
    const repl = await submitProduct({
      viewerId: submitter,
      data: {
        ...baseData,
        name: "Produit Vérif Médias",
        productType: "app_web",
        galleryOrientation: "landscape",
      },
      asDraft: true,
    });
    const mediaLandPng = await sharp({
      create: { width: 800, height: 400, channels: 3, background: { r: 90, g: 60, b: 180 } },
    })
      .png()
      .toBuffer();
    const shotLand = (n: string) => new File([mediaLandPng], `${n}.png`, { type: "image/png" });
    await updateProduct(
      submitter,
      repl.id,
      {},
      {
        logo: new File([logoPng], "logo-a.png", { type: "image/png" }),
        screenshots: [shotLand("shot-a1"), shotLand("shot-a2")],
      },
    );
    const [before] = await db
      .select({ iconUrl: products.iconUrl })
      .from(products)
      .where(eq(products.id, repl.id))
      .limit(1);
    const shotsBefore = await db
      .select({ url: productScreenshots.url })
      .from(productScreenshots)
      .where(eq(productScreenshots.productId, repl.id));
    await updateProduct(
      submitter,
      repl.id,
      {},
      {
        logo: new File([logoPng], "logo-b.png", { type: "image/png" }),
        screenshots: [shotLand("shot-b1")],
      },
    );
    const [after] = await db
      .select({ iconUrl: products.iconUrl })
      .from(products)
      .where(eq(products.id, repl.id))
      .limit(1);
    const shotsAfter = await db
      .select({ url: productScreenshots.url })
      .from(productScreenshots)
      .where(eq(productScreenshots.productId, repl.id));
    check(
      "logo remplacé (nouvelle clé)",
      Boolean(after.iconUrl) && after.iconUrl !== before.iconUrl,
    );
    check("galerie remplacée (total, pas d'ajout)", shotsAfter.length === 1);
    const logoKeys = await listR2Keys(PRODUCT_LOGOS_BUCKET);
    const shotKeys = await listR2Keys(PRODUCT_SHOTS_BUCKET);
    const keyOf = (url: string): string | null => {
      try {
        const k = new URL(url).pathname.replace(/^\/+/, "");
        return k !== "" ? k : null;
      } catch {
        return null;
      }
    };
    const oldLogoKey = before.iconUrl ? keyOf(before.iconUrl) : null;
    const oldShotKeys = shotsBefore.map((s) => keyOf(s.url));
    const newLogoKey = after.iconUrl ? keyOf(after.iconUrl) : null;
    const newShotKeys = shotsAfter.map((s) => keyOf(s.url));
    check("ancien logo purgé de R2", oldLogoKey !== null && !logoKeys.includes(oldLogoKey));
    check(
      "anciennes captures purgées de R2",
      oldShotKeys.length === 2 && oldShotKeys.every((k) => k !== null && !shotKeys.includes(k)),
    );
    check(
      "nouveaux objets présents en R2",
      newLogoKey !== null &&
        logoKeys.includes(newLogoKey) &&
        newShotKeys.length === 1 &&
        newShotKeys[0] !== null &&
        shotKeys.includes(newShotKeys[0]),
    );
    // Cleanup : nouveaux objets R2 + lignes + produit (zéro résidu).
    if (newLogoKey) await deleteR2Object(PRODUCT_LOGOS_BUCKET, newLogoKey).catch(() => {});
    for (const k of newShotKeys) {
      if (k) await deleteR2Object(PRODUCT_SHOTS_BUCKET, k).catch(() => {});
    }
    await db.delete(productScreenshots).where(eq(productScreenshots.productId, repl.id));
    await db.delete(products).where(eq(products.id, repl.id));
  }

  // 13-bis. SLA D0 : submitted_at posé à la soumission (jamais la
  // naissance du brouillon), reset à la re-soumission après rejet.
  const slaLandPng = await sharp({
    create: { width: 800, height: 400, channels: 3, background: { r: 30, g: 140, b: 90 } },
  })
    .png()
    .toBuffer();
  const slaDraft = await submitProduct({
    viewerId: submitter,
    data: {
      ...baseData,
      name: "Produit Vérif SLA",
      productType: "app_web",
      galleryOrientation: "landscape",
      links: { website: "https://example.com/sla" },
    },
    logo: new File([logoPng], "logo.png", { type: "image/png" }),
    screenshots: [new File([slaLandPng], "shot.png", { type: "image/png" })],
    asDraft: true,
  });
  const [slaRow0] = await db
    .select({ submittedAt: products.submittedAt })
    .from(products)
    .where(eq(products.id, slaDraft.id))
    .limit(1);
  check("draft = jamais soumis (NULL)", slaRow0.submittedAt === null);
  await updateProduct(submitter, slaDraft.id, {}, undefined, { publish: true });
  const [slaRow1] = await db
    .select({ status: products.status, submittedAt: products.submittedAt })
    .from(products)
    .where(eq(products.id, slaDraft.id))
    .limit(1);
  check(
    "publish pose submitted_at",
    slaRow1.status === "pending" && slaRow1.submittedAt instanceof Date,
  );
  await reviewProduct({
    isStaff: true,
    productId: slaDraft.id,
    decision: "rejected",
    reason: "test SLA",
  });
  await new Promise((r) => setTimeout(r, 1100));
  await updateProduct(submitter, slaDraft.id, {}, undefined, { publish: true });
  const [slaRow2] = await db
    .select({ status: products.status, submittedAt: products.submittedAt })
    .from(products)
    .where(eq(products.id, slaDraft.id))
    .limit(1);
  check(
    "resubmit = nouveau cycle (reset + pending)",
    slaRow2.status === "pending" &&
      slaRow2.submittedAt instanceof Date &&
      (slaRow1.submittedAt === null ||
        slaRow2.submittedAt.getTime() > slaRow1.submittedAt.getTime()),
  );
  await db.delete(productScreenshots).where(eq(productScreenshots.productId, slaDraft.id));
  await db.delete(products).where(eq(products.id, slaDraft.id));

  // 11b. Téléchargements APK : événement + compteur + réparation du cache.
  // Sans R2 : on teste la logique durable (la route elle-même est gardée par
  // les tests builds/D6, elle exige un binaire réellement signable).
  const { recordDownload, recountDownloadCounts } = await import("@/services/builds.service");
  const dl = await submitProduct({
    viewerId: submitter2,
    data: {
      ...baseData,
      name: "Produit Vérif Downloads",
      productType: "app_mobile",
      galleryOrientation: "portrait",
    },
    asDraft: true,
  });
  // Une fiche neuve ne doit jamais hériter d'un total (le cache faussé est
  // testé plus bas, via `recountDownloadCounts`).
  const [fresh] = await db
    .select({ downloadCount: products.downloadCount })
    .from(products)
    .where(eq(products.id, dl.id))
    .limit(1);
  check("download : fiche neuve à 0", fresh.downloadCount === 0);
  // Le compteur part de 0 : une fiche neuve ne doit jamais hériter d'un total.
  await recordDownload(dl.id);
  const [dlRow] = await db
    .select({ downloadCount: products.downloadCount })
    .from(products)
    .where(eq(products.id, dl.id))
    .limit(1);
  const dlEvents = await db
    .select({ id: productDownloads.id })
    .from(productDownloads)
    .where(eq(productDownloads.productId, dl.id));
  check("download : compteur incrémenté", dlRow.downloadCount === 1);
  check("download : 1 événement daté", dlEvents.length === 1);
  const engDl = await getProductsEngagement([dl.id]);
  check(
    "engagement expose les téléchargements",
    (engDl[dl.id]?.downloads ?? -1) === 1 && (engDl[dl.id]?.downloads7d ?? -1) === 1,
  );
  // Réparation : le cache (999) est reconstruit depuis les événements.
  await db.update(products).set({ downloadCount: 999 }).where(eq(products.id, dl.id));
  await recountDownloadCounts();
  const [fixed] = await db
    .select({ downloadCount: products.downloadCount })
    .from(products)
    .where(eq(products.id, dl.id))
    .limit(1);
  check("recount : compteur reconstruit", fixed.downloadCount === 1);
  await db.delete(productDownloads).where(eq(productDownloads.productId, dl.id));
  await db.delete(products).where(eq(products.id, dl.id));

  // 14. Builds : la version, l'index partiel, l'identité (signature +
  //     package), et les liens (mode « merge » de l'API mobile).
  //
  // 14.1 Règle de version : la référence est le build EN LIGNE.
  //   Un build REJETÉ ne verrouille plus son numéro de version.
  const versionRefuse = (codes: number[], code: number | null) => {
    try {
      assertVersionAllowed({ onlineCodes: codes, newCode: code });
      return false;
    } catch {
      return true;
    }
  };
  check("version : refus si le code n'excède pas le build en ligne", versionRefuse([2], 2));
  check("version : refus si le code est illisible", versionRefuse([2], null));
  check("version : pas de contrainte sans build en ligne", !versionRefuse([], 1));
  check(
    "version : un rejet ne verrouille pas le code (re-soumission acceptée)",
    !versionRefuse([2], 3),
  );

  // 14.2 Index unique PARTIEL : un (produit, version_code) réinsérable
  //   après un rejet (l'historique garde le rejet, le code redevient
  //   disponible). C'est le fix de migration 0047.
  const [buildProduct] = await db
    .insert(products)
    .values({
      slug: `verify-builds-${TAG}`,
      makerId: maker.id,
      name: "Produit Builds",
      tagline: "Tagline builds.",
      description: "Description builds assez longue.",
      category: "dev-tools",
      categories: ["dev-tools"],
      productType: "app_mobile",
      pricingModel: "free",
      galleryOrientation: "portrait",
      status: "published",
      publishedAt: new Date(),
      upvoteCount: 0,
    })
    .returning({ id: products.id });
  const buildRow = (versionCode: number, status: string) => ({
    productId: buildProduct.id,
    versionCode,
    versionName: `1.0.${versionCode}`,
    status,
    sha256File: "a".repeat(64),
    sizeBytes: 1024,
    r2Key: `builds/verify/${buildProduct.id}/${versionCode}.apk`,
  });
  await db.insert(productBuilds).values(buildRow(2, "approved"));
  await db.insert(productBuilds).values(buildRow(3, "rejected"));
  let reinsere = true;
  try {
    // Même code que le build REJETÉ : l'index partiel l'autorise.
    await db.insert(productBuilds).values(buildRow(3, "pending"));
  } catch {
    reinsere = false;
  }
  check("builds : le code d'un build rejeté est ré-insérable", reinsere);
  let doublonVif = false;
  try {
    // Deux builds VIFS de même code : interdit (l'index partiel bite).
    await db.insert(productBuilds).values(buildRow(3, "pending"));
  } catch {
    doublonVif = true;
  }
  check("builds : deux builds en revue de même code sont refusés", doublonVif);

  // 14.3 Identité : un APK d'une AUTRE app doit être signalé (package
  //     différent) ; une rotation de clé est signalée à part.
  const identite = diffBuildIdentity(
    { certSha256: "cert-b", package: "com.autre.app" },
    { certSha256: "cert-a", package: "com.riri.atmox" },
  );
  check("builds : package différent = autre app", identite.packageChanged);
  check("builds : certificat différent signalé", identite.certChanged);
  const memeApp = diffBuildIdentity(
    { certSha256: "cert-a", package: "com.riri.atmox" },
    { certSha256: "cert-a", package: "com.riri.atmox" },
  );
  check("builds : même package = pas une autre app", !memeApp.packageChanged);
  check(
    "builds : pas de build en ligne = aucun écart",
    !diffBuildIdentity({}, null).packageChanged,
  );

  // 14.4 Liens : l'API mobile n'envoie qu'un sous-ensemble → les liens
  //     absents sont CONSERVÉS, un champ vidé est effacé.
  const [lienProduct] = await db
    .insert(products)
    .values({
      slug: `verify-liens-${TAG}`,
      makerId: maker.id,
      name: "Produit Liens",
      tagline: "Tagline liens.",
      description: "Description liens assez longue.",
      category: "dev-tools",
      categories: ["dev-tools"],
      productType: "app_web",
      pricingModel: "free",
      galleryOrientation: "landscape",
      status: "draft",
      links: {
        website: "https://example.com",
        source: "https://github.com/verify-cli",
        docs: "https://example.com/CHANGELOG",
      },
      upvoteCount: 0,
    })
    .returning({ id: products.id });
  await updateProduct(maker.id, lienProduct.id, {
    links: { website: "https://example.com/platformes" },
    clearedLinks: [],
  } as never);
  const [lienRow] = await db
    .select({ links: products.links })
    .from(products)
    .where(eq(products.id, lienProduct.id));
  const liens = (lienRow?.links ?? {}) as Record<string, string>;
  check(
    "liens : le lien modifié est mis à jour",
    liens.website === "https://example.com/platformes",
  );
  check(
    "liens : les liens absents de la payload sont conservés (mode merge)",
    liens.source === "https://github.com/verify-cli" &&
      liens.docs === "https://example.com/CHANGELOG",
  );
  await updateProduct(maker.id, lienProduct.id, {
    links: {},
    clearedLinks: ["docs"],
  } as never);
  const [lienRow2] = await db
    .select({ links: products.links })
    .from(products)
    .where(eq(products.id, lienProduct.id));
  const liens2 = (lienRow2?.links ?? {}) as Record<string, string>;
  check("liens : un champ vidé efface le lien", liens2.docs === undefined);
  check("liens : les autres liens survivent à l'effacement", liens2.source !== undefined);

  // 14.5 Les clés de liens présentes en base sont toutes connues de la
  //     config (aucune clé fantôme) — et les ids de la config jamais vus
  //     sont listés (un lien invisible = un id à surveiller).
  const rowsLiens = await db.execute(
    sql`select distinct jsonb_object_keys(links) as cle from products where links is not null and deleted_at is null`,
  );
  const clesDb = [...new Set((rowsLiens as unknown as { cle: string }[]).map((r) => r.cle))];
  const clesInconnues = clesDb.filter((c) => !KNOWN_LINK_IDS.has(c));
  check("liens : aucune clé inconnue en base", clesInconnues.length === 0);
  const jamaisVus = [...KNOWN_LINK_IDS].filter((c) => !clesDb.includes(c)).sort();
  if (jamaisVus.length > 0) {
    console.log(`  (ids de liens jamais vus en base : ${jamaisVus.join(", ")})`);
  }

  // 15. Révisions : le contenu sensible d'une fiche PUBLIÉE ne bouge pas
  //     tout de suite (règle des stores) — il attend un regard admin.
  //     15.1 le nom modifié ne part pas en re-revue « statut » : la fiche
  //          reste publiée, la modification est en attente.
  const [pubProduct] = await db
    .insert(products)
    .values({
      slug: `verify-revision-${TAG}`,
      makerId: maker.id,
      name: "Produit Revision",
      tagline: "Tagline revision.",
      description: "Description revision assez longue.",
      category: "dev-tools",
      categories: ["dev-tools"],
      productType: "app_web",
      platforms: ["web"],
      pricingModel: "free",
      galleryOrientation: "landscape",
      status: "published",
      publishedAt: new Date(),
      upvoteCount: 0,
      links: { website: "https://example.com" },
    })
    .returning({ id: products.id });
  const editResult = await updateProduct(maker.id, pubProduct.id, {
    name: "Produit Revision — nouveau nom",
    tagline: "Nouvelle tagline de revision.",
    description: "Nouvelle description de revision, assez longue pour passer le contrat.",
    links: { website: "https://example.com/platformes" },
  } as never);
  const [pubRow] = await db
    .select({
      status: products.status,
      name: products.name,
      tagline: products.tagline,
      pendingPayload: productRevisions.payload,
      pendingAt: productRevisions.createdAt,
    })
    .from(products)
    .leftJoin(productRevisions, eq(productRevisions.productId, products.id))
    .where(eq(products.id, pubProduct.id));
  check("révision : la fiche reste en ligne", pubRow?.status === "published");
  check("révision : le nom public n'a pas bougé", pubRow?.name === "Produit Revision");
  check("révision : la tagline publique n'a pas bougé", pubRow?.tagline === "Tagline revision.");
  check("révision : la modification est en attente", pubRow?.pendingAt !== null);
  const payload = (pubRow?.pendingPayload ?? {}) as Record<string, unknown>;
  check(
    "révision : le nouveau nom est en attente",
    payload.name === "Produit Revision — nouveau nom" &&
      payload.tagline === "Nouvelle tagline de revision.",
  );
  check("révision : le lien modifié est en attente", payload.links !== undefined);
  check("révision : l'édition est signalée au maker", editResult.rereview === true);

  // 15.1b Le mode des liens est decide par l APPELANT : une PATCH avec
  //      seulement `changelogUrl` (aucun champ lien) ne doit PLUS effacer
  //      les liens de la fiche (sinon la revision devenait inapprovable :
  //      plus de point d acces).
  await updateProduct(maker.id, pubProduct.id, {
    changelogUrl: "https://example.com/CHANGELOG-v2",
    linksMode: "merge",
    clearedLinks: [],
  } as never);
  // Sur une fiche PUBLIEE, les liens sont dans la REVISION (pas appliques) :
  // c est la que le lien du changelog doit se retrouver, avec les autres
  // liens de la fiche conserves.
  const [afterPatch] = await db
    .select({ payload: productRevisions.payload })
    .from(productRevisions)
    .where(eq(productRevisions.productId, pubProduct.id));
  const liensApres =
    ((afterPatch?.payload ?? {}) as { links?: Record<string, string> }).links ?? {};
  check(
    "liens (mode merge) : les liens de la fiche survivent a une PATCH sans champ lien",
    liensApres.website !== undefined && liensApres.changelog === "https://example.com/CHANGELOG-v2",
  );

  // 15.2 Le compteur de la file admin.
  const enAttente = await countPendingRevisions();
  check("révisions : le compteur de la file", enAttente >= 1);

  // 15.3 Un refus garde le contenu validé et jette la modification.
  await reviewRevision({
    isStaff: true,
    productId: pubProduct.id,
    decision: "rejected",
    reason: "Test",
    staffId: maker.id,
  });
  const [afterReject] = await db
    .select({ name: products.name, pendingAt: productRevisions.createdAt })
    .from(products)
    .leftJoin(productRevisions, eq(productRevisions.productId, products.id))
    .where(eq(products.id, pubProduct.id));
  check("révision refusée : le contenu validé reste", afterReject?.name === "Produit Revision");
  check("révision refusée : plus rien en attente", afterReject?.pendingAt === null);

  // 15.4 Une approbation applique la modification.
  await updateProduct(maker.id, pubProduct.id, {
    name: "Produit Revision — nom_approuve",
  } as never);
  await reviewRevision({
    isStaff: true,
    productId: pubProduct.id,
    decision: "approved",
    staffId: maker.id,
  });
  const [afterApprove] = await db
    .select({ name: products.name, pendingAt: productRevisions.createdAt })
    .from(products)
    .leftJoin(productRevisions, eq(productRevisions.productId, products.id))
    .where(eq(products.id, pubProduct.id));
  check(
    "révision approuvée : la modification est appliquée",
    afterApprove?.name === "Produit Revision — nom_approuve",
  );
  check("révision approuvée : plus rien en attente", afterApprove?.pendingAt === null);

  // 15.5 Les règles de la fiche sont rejouées même si les liens ne
  //      changent pas (avant : passer en subscription sans privacy
  //      passait).
  const [regleProduct] = await db
    .insert(products)
    .values({
      slug: `verify-regles-${TAG}`,
      makerId: maker.id,
      name: "Produit Regles",
      tagline: "Tagline regles.",
      description: "Description regles assez longue.",
      category: "dev-tools",
      categories: ["dev-tools"],
      productType: "app_web",
      pricingModel: "free",
      galleryOrientation: "landscape",
      status: "published",
      publishedAt: new Date(),
      upvoteCount: 0,
      links: { website: "https://example.com" },
    })
    .returning({ id: products.id });
  let regleRefusee = false;
  try {
    // Passer en "subscription" sans politique de confidentialité : la
    // règle doit refuser (avant : elle n'était rejouée qu'au changement
    // de liens).
    await updateProduct(maker.id, regleProduct.id, {
      pricingModel: "subscription",
    } as never);
  } catch {
    regleRefusee = true;
  }
  check("règles : monétisé sans privacy refusé", regleRefusee);
  await db.delete(products).where(eq(products.id, regleProduct.id));

  // 16. Compteurs de catégories : le compteur doit annoncer ce que la
  //     PAGE de la catégorie montre (les produits dont le tableau
  //     `categories` contient le slug — principale OU sous-catégorie).
  const [catProduct] = await db
    .insert(products)
    .values({
      slug: `verify-cat-${TAG}`,
      makerId: maker.id,
      name: "Produit Categorie",
      tagline: "Tagline categorie.",
      description: "Description categorie assez longue.",
      category: "dev-tools",
      categories: ["dev-tools", "utilitaires", "ai"],
      productType: "app_web",
      platforms: ["web"],
      pricingModel: "free",
      galleryOrientation: "landscape",
      status: "published",
      publishedAt: new Date(),
      upvoteCount: 0,
      links: { website: "https://example.com" },
    })
    .returning({ id: products.id });
  const counts = await countPublishedByCategory();
  // La page de « dev-tools » liste ce produit (catégorie principale)…
  const pageDevTools = await searchProducts({ cat: "dev-tools" });
  check(
    "compteurs : le compteur = le nombre de produits listés par la page",
    (counts.get("dev-tools") ?? 0) === pageDevTools.total,
  );
  // …et la page d'« utilitaires » aussi, alors que ce n'est PAS la
  // catégorie principale : c'est exactement ce que le compteur doit dire.
  const pageUtilitaires = await searchProducts({ cat: "utilitaires" });
  check(
    "compteurs : une sous-catégorie compte aussi (comme sa page)",
    (counts.get("utilitaires") ?? 0) === pageUtilitaires.total &&
      pageUtilitaires.items.some((i) => i.id === catProduct.id),
  );
  const pageAi = await searchProducts({ cat: "ai" });
  check(
    "compteurs : la troisième catégorie compte aussi",
    (counts.get("ai") ?? 0) === pageAi.total && pageAi.items.some((i) => i.id === catProduct.id),
  );
  // Le total reste le nombre DISTINCT de produits (jamais la somme des
  // compteurs, qui double-compte les produits multi-catégories).
  const real = await getRealCounts();
  const somme = [...(real?.byCategory.values() ?? [])].reduce((a, b) => a + b, 0);
  const tousProduits = await searchProducts({});
  check(
    "compteurs : le total = le nombre de produits publiés (distinct)",
    real !== null && real.total === tousProduits.total,
  );
  check(
    "compteurs : la somme des compteurs peut dépasser le total (facettes)",
    somme >= (real?.total ?? 0),
  );
  await db.delete(products).where(eq(products.id, catProduct.id));

  // 17. Produit du jour : une PRIORITÉ, pas une file d'attente.
  //
  //     L'ancien algo enfilait les produits (jamais-featuré d'abord,
  //     moins-récemment-featuré ensuite, fenêtre de 7 jours) : le slot
  //     pouvait être VIDE et l'ordre dépendait de l'heure d'ajout.
  //     Le calcul est PUR → les propriétés se testent sans base, sans
  //     fixture et sans dépendre des vraies données du catalogue.
  const candidat = (
    id: string,
    signal: number,
    attente: number,
    publishedAt: Date | null = null,
    updatedAt: Date | null = null,
  ): FeaturedCandidate => ({ id, signal, attente, publishedAt, updatedAt });

  // 17.1 La priorité : le service d'abord (l'attente), le signal ensuite.
  //      Et les deux bornes : ni attente ni signal ne sont cumulatifs
  //      sans limite (sinon la file grossit / un produit monopolise).
  const tresVif = candidat("tres-vif", 50, 0);
  const tresAncien = candidat("tres-ancien", 0, 400);
  check(
    "slot : le signal est borné (un produit très vote ne domine pas)",
    featuredPriorite(tresVif) < 40,
  );
  check(
    "slot : l'attente est bornée (la file ne peut pas grossir)",
    featuredPriorite(tresAncien) < 40,
  );
  check(
    "slot : à service égal, le signal départage",
    featuredPriorite(candidat("a", 5, 3)) > featuredPriorite(candidat("b", 1, 3)),
  );
  check(
    "slot : l'attente pèse plus que le signal",
    featuredPriorite(candidat("attente", 1, 7)) > featuredPriorite(candidat("signal", 6, 0)),
  );

  // 17.2 L'ordre n'est PAS l'ordre d'arrivée : deux candidats au même
  //      score, publiés à des moments différents → le plus récent passe.
  const matin = candidat("matin", 0, 0, new Date("2026-01-01T11:00:00Z"));
  const midi = candidat("midi", 0, 0, new Date("2026-01-01T12:00:00Z"));
  const classe = classerFeatured([matin, midi]);
  check(
    "slot : l'ordre n'est pas l'ordre d'arrivée",
    classe[0]?.id === "midi" && classe[1]?.id === "matin",
  );

  // 17.3 L'équité : celui qui n'a pas eu sa part passe avant celui qui
  //      vient d'être servi (personne n'est oublié) — et l'inverse du
  //      « nouveau d'abord » : ce n'est pas la nouveauté qui compte,
  //      c'est l'attente due.
  check(
    "slot : un produit jamais servi passe avant un produit servi hier",
    classerFeatured([candidat("servi-hier", 0, 1), candidat("jamais-servi", 0, 5)])[0]?.id ===
      "jamais-servi",
  );

  // 17.4 Le slot n'est JAMAIS vide tant qu'un produit éligible existe
  //      (le bug : « soyez le premier » alors que le catalogue existait).
  const slotRempli = await getFeatured();
  check("slot : jamais vide", slotRempli !== null);
  const catalogueVide = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(products)
    .where(
      and(
        eq(products.status, "published"),
        isNull(products.deletedAt),
        eq(products.curated, false),
      ),
    );
  check(
    "slot : rempli quand le catalogue a des produits éligibles",
    (catalogueVide[0]?.n ?? 0) === 0 || slotRempli !== null,
  );

  // 18. JSON-LD : l'injection dans la balise <script> est neutralisee.
  //     Le payload d'un profil maker (nom, bio) n'est revu par PERSONNE :
  //     avant, un "</script>" dans le displayName fermait la balise et
  //     injectait du HTML sur une page publique indexable (XSS stocke).
  const payloadXss = safeJsonLd({ name: `x</script><img src=x onerror=alert(1)>` });
  check(
    "JSON-LD : le < est echappe (aucune balise script fermable)",
    !payloadXss.includes("</script>") && payloadXss.includes("\\u003c"),
  );
  check(
    "JSON-LD : le JSON reste lisible a l'identique",
    (JSON.parse(payloadXss) as { name: string }).name === `x</script><img src=x onerror=alert(1)>`,
  );

  await db.delete(productBuilds).where(eq(productBuilds.productId, buildProduct.id));
  await db.delete(products).where(eq(products.id, buildProduct.id));
  await db.delete(products).where(eq(products.id, lienProduct.id));
  await db.delete(products).where(eq(products.id, pubProduct.id));

  // 12. Nettoyage makers dédiés (ligne + auth — run suivant hermétique).
  // Le maker `verify-backend@example.com` (créé §maker si absent) est
  // purgé lui aussi : sans ceci il persistait définitivement (comptes
  // factices en prod — plus jamais).
  let residue = false;
  for (const [uid, mail] of [
    [submitter, VERIFY_EMAIL],
    [submitter2, VERIFY_EMAIL_2],
  ] as const) {
    await deleteAccount(uid, uid);
    await admin.auth.admin.deleteUser(uid).catch(() => {});
    const [gone] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, mail))
      .limit(1);
    if (gone) residue = true;
  }
  const [makerRow] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, "verify-backend@example.com"))
    .limit(1);
  if (makerRow) {
    await deleteAccount(makerRow.id, makerRow.id);
    await admin.auth.admin.deleteUser(makerRow.id).catch(() => {});
    const [makerGone] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, "verify-backend@example.com"))
      .limit(1);
    if (makerGone) residue = true;
  }
  check("nettoyage makers verify", !residue);

  console.log(`products-backend: ${pass} OK, ${fail} KO`);
  // Sortie déléguée à la chaîne en aval (main → catch → finally → exit) :
  // c'est elle qui joue le filet de purge, un `process.exit` ici la
  // court-circuiterait.
}

main()
  .catch((e) => {
    console.error("verify-products-backend crash:", e instanceof Error ? e.message : e);
    fail++;
  })
  .finally(async () => {
    // Filet de crash : `main` purge en fin de parcours, mais un `throw`
    // (R2, réseau) court-circuite cette purge et laissait les comptes
    // factices derrière lui. Ce filet passe après le catch, donc il joue
    // aussi sur le chemin nominal.
    await purgeVerifyAccounts();
  })
  .then(() => process.exit(fail === 0 ? 0 : 1));
