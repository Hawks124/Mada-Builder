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
  measureImage,
  processImage,
} from "@/lib/images";
import {
  isListedProduct,
  parseLinkFields,
  purgeStaleDrafts,
  reviewProduct,
  submitProduct,
  assertLinkRules,
  fetchProductBySlug,
  logOutboundClick,
  logProductView,
  toDashboardApp,
  toEditApp,
  toReviewItem,
  updateProduct,
} from "@/services/products.service";
import { getRelatedProducts } from "@/services/ranking.service";
import { searchProducts } from "@/services/discover.service";
import type { DashboardRow, ReviewQueueRow } from "@/services/products.service";
import { parseProductForm } from "@/app/api/v1/products/product-forms";
import { ProfileError } from "@/services/users.service";
import { deleteAccount } from "@/services/users.service";
import { createAdminClient } from "@/lib/supabase/admin";
import { eq, and, sql } from "drizzle-orm";

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
  const VERIFY_EMAIL = "verify-products@example.com";
  const VERIFY_EMAIL_2 = "verify-products-2@example.com";
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
  let gateRejected = false;
  try {
    await submitProduct({
      viewerId: submitter,
      data: { ...baseData, productType: "saas", galleryOrientation: "portrait" },
      asDraft: true,
    });
  } catch (e) {
    gateRejected =
      e instanceof ProfileError && e.code === "VALIDATION" && e.message.includes("paysage");
  }
  check("saas+portrait refusé (pilotage auto)", gateRejected);
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
  // M1 : orientation changée sans captures → refus AVANT commit.
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
    "orientation refusée avant commit (M1)",
    m1Rejected && m1Row.galleryOrientation === "landscape",
  );
  await db.delete(products).where(eq(products.id, m1.id));
  // M2 : publish sans point d'accès → refus (fichiers fournis mais jamais uploadés).
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
  check(
    "feed p1 : ordre nouveautés",
    feed1.items[0].id === feedIds[0] && feed1.items[1].id === feedIds[1],
  );
  const opaque = encodeKeysetCursor(feed1.nextCursor);
  const feed2 = await getPublicProductsFeed({ limit: 2, cursor: decodeKeysetCursor(opaque) });
  const p1Ids = new Set(feed1.items.map((i) => i.id));
  check(
    "feed p2 : suite sans doublon, fin détectée",
    feed2.items.length >= 1 &&
      feed2.items.every((i) => !p1Ids.has(i.id)) &&
      feed2.items.some((i) => i.id === feedIds[2]),
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
      data: { ...baseData, productType: "app_web", galleryOrientation: "landscape", tagline: "" },
      asDraft: true,
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
  // Parse liens : présents-vides = {} (efface), absents = undefined (conserve).
  const fdLinks = new FormData();
  fdLinks.set("website", "https://example.com");
  fdLinks.set("name", "x");
  check(
    "liens parsés",
    JSON.stringify(parseLinkFields(Object.fromEntries(fdLinks))) ===
      '{"website":"https://example.com"}',
  );
  check("liens absents = conservé", parseLinkFields({ name: "x" }) === undefined);
  check("valeurs non-string ignorées", JSON.stringify(parseLinkFields({ website: 42 })) === "{}");
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

  // 12. Nettoyage makers dédiés (ligne + auth — run suivant hermétique).  // Le maker `verify-backend@example.com` (créé §maker si absent) est
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
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("verify-products-backend crash:", e instanceof Error ? e.message : e);
  process.exit(1);
});
