import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { products, productBuilds, productDownloads, users } from "@/db/schema";
import { ProfileError, assertNotBanned } from "@/services/users.service";
import { notifyAdminsReview } from "@/services/notifications.service";
import {
  headR2Object,
  deleteR2Object,
  MAX_BUILD_BYTES,
  PRODUCT_BUILDS_BUCKET,
  r2SliceReader,
} from "@/lib/r2";
import { ApkParseError, extractApkCerts } from "@/lib/apk";

/**
 * Builds APK (D1) : enregistrement post-upload. Le binaire est déjà sur R2
 * (PUT présigné direct, jamais via Vercel) — ici on VÉRIFIE (HEAD : objet
 * présent, taille exacte, quota) puis on insère en `pending` (revue
 * binaire bloquante en D4). Extraction manifest/certs = D2 (champs
 * nullables jusque-là). Partagé web + mobile.
 *
 * Les métadonnées manifest/certs sont DÉCLARÉES par le client (affichage
 * panneau admin) et re-vérifiées serveur en D3 (Range R2) — la revue
 * humaine + l'installation réelle font foi d'ici là.
 */
export async function createBuild(input: {
  viewerId: string;
  productId: string;
  r2Key: string;
  sha256: string;
  sizeBytes: number;
  versionCode?: number | null;
  versionName?: string | null;
  whatsnew?: string | null;
  package?: string | null;
  minSdk?: number | null;
  targetSdk?: number | null;
  permissions?: string[] | null;
  certSha256?: string | null;
  certSha1?: string | null;
  sigScheme?: string | null;
  certSubjectCn?: string | null;
  certSubjectO?: string | null;
  certKeyAlg?: string | null;
  certKeyBits?: number | null;
  certSigAlg?: string | null;
}): Promise<{ id: string }> {
  await assertNotBanned(input.viewerId);
  const [product] = await db
    .select({ id: products.id, makerId: products.makerId })
    .from(products)
    .where(and(eq(products.id, input.productId), isNull(products.deletedAt)))
    .limit(1);
  if (!product) throw new ProfileError("NOT_FOUND", "Produit introuvable.");
  if (product.makerId !== input.viewerId) {
    throw new ProfileError("FORBIDDEN", "Build sur le produit d'autrui interdit.");
  }
  // Confinement : la clé doit vivre sous builds/{maker}/{produit}/.
  const prefix = `builds/${input.viewerId}/${input.productId}/`;
  if (!input.r2Key.startsWith(prefix) || input.r2Key.includes("..")) {
    throw new ProfileError("VALIDATION", "Clé de build invalide.");
  }
  if (!/^[0-9a-f]{64}$/i.test(input.sha256)) {
    throw new ProfileError("VALIDATION", "SHA-256 invalide (64 hex).");
  }
  if (!Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0) {
    throw new ProfileError("VALIDATION", "Taille de build illisible.");
  }
  if (input.sizeBytes > MAX_BUILD_BYTES) {
    throw new ProfileError("VALIDATION", "APK trop lourd (300 Mo maximum).");
  }
  // Règles Update (D4) : la référence de version est le build **EN
  // LIGNE** (status `approved`), pas le dernier build ajouté.
  //
  // Pourquoi : le `versionCode` d'Android se compare à ce qui est
  // INSTALLÉ. Un build rejeté n'a jamais été distribué : l'utiliser comme
  // référence brûlait le numéro de version pour un rejet réparable (le
  // motif de rejet dit pourtant « corrigez et re-soumettre »), et forçait
  // le maker à bumper son APK pour une simple correction de notes. La
  // référence est donc `approved` — et les rejets gardent leur ligne
  // (l'historique), l'index unique est partiel (migration 0047).
  //
  // Sans build approuvé : aucune contrainte (premier build, notes
  // optionnelles).
  const approved = await db
    .select({ versionCode: productBuilds.versionCode })
    .from(productBuilds)
    .where(and(eq(productBuilds.productId, input.productId), eq(productBuilds.status, "approved")));
  const onlineCodes = approved
    .map((r) => r.versionCode)
    .filter((c): c is number => typeof c === "number");
  const maxCode = onlineCodes.length > 0 ? Math.max(...onlineCodes) : null;
  const hasTrack = maxCode !== null;
  const newCode =
    typeof input.versionCode === "number" && Number.isInteger(input.versionCode)
      ? input.versionCode
      : null;
  assertVersionAllowed({ onlineCodes, newCode });
  const whatsnew = typeof input.whatsnew === "string" ? input.whatsnew.trim() : "";
  if (hasTrack && whatsnew === "") {
    throw new ProfileError("VALIDATION", "Notes de version requises (mise à jour).");
  }
  if (whatsnew.length > 1000) {
    throw new ProfileError("VALIDATION", "Notes de version trop longues (1000 signes maximum).");
  }
  // Métadonnées déclarées (affichage admin) : formes saines uniquement.
  const packageName =
    typeof input.package === "string" && /^[a-zA-Z][\w.]{0,254}$/.test(input.package)
      ? input.package
      : null;
  const intOrNull = (v: unknown, max: number): number | null =>
    typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= max ? v : null;
  const permissions = Array.isArray(input.permissions)
    ? input.permissions
        .filter((p): p is string => typeof p === "string" && p.length <= 255)
        .slice(0, 300)
    : [];
  const hexOrNull = (v: unknown, len: number): string | null =>
    typeof v === "string" && new RegExp(`^[0-9a-f]{${len}}$`, "i").test(v) ? v.toLowerCase() : null;
  const sigScheme =
    input.sigScheme === "v1" || input.sigScheme === "v2" || input.sigScheme === "v3"
      ? input.sigScheme
      : null;
  const strOrNull = (v: unknown, max: number): string | null =>
    typeof v === "string" && v.length > 0 && v.length <= max ? v : null;
  // Preuve, pas promesse : l'objet existe et sa taille matche.
  const head = await headR2Object(PRODUCT_BUILDS_BUCKET, input.r2Key);
  if (!head) {
    throw new ProfileError("VALIDATION", "Upload introuvable — réessayez l'envoi.");
  }
  if (head.size !== input.sizeBytes) {
    await deleteR2Object(PRODUCT_BUILDS_BUCKET, input.r2Key).catch(() => {});
    throw new ProfileError("VALIDATION", "Taille déclarée ≠ taille réelle — objet supprimé.");
  }
  // Re-vérif serveur (D3) : le client ne peut pas mentir. On relit
  // l'identité (certs) par tranches Range — jamais le fichier entier.
  // Invariant : une ligne build ⇒ identité serveur-vérifiée.
  // (Manifest : champs déclarés, couverts par revue + install ; le
  // parse serveur du manifest exigerait tout le fichier — différé.)
  const purgeAndReject = async (message: string): Promise<never> => {
    await deleteR2Object(PRODUCT_BUILDS_BUCKET, input.r2Key).catch(() => {});
    throw new ProfileError("VALIDATION", message);
  };
  let serverCertSha: string;
  try {
    const reader = r2SliceReader(PRODUCT_BUILDS_BUCKET, input.r2Key, head.size);
    const head4 = await reader.slice(0, 4);
    if (!(head4[0] === 0x50 && head4[1] === 0x4b && head4[2] === 0x03 && head4[3] === 0x04)) {
      await purgeAndReject("Le fichier n'est pas un APK valide — objet supprimé.");
    }
    const certs = await extractApkCerts(reader);
    if (certs.some((c) => c.debug)) {
      await purgeAndReject("APK de debug refusé — objet supprimé.");
    }
    serverCertSha = certs[0]!.sha256;
  } catch (e) {
    if (e instanceof ProfileError) throw e;
    await purgeAndReject(
      e instanceof ApkParseError
        ? `${e.message} — objet supprimé.`
        : "Signature illisible — objet supprimé.",
    );
  }
  // Divergence : le cert déclaré doit être celui lu sur R2.
  const declaredCert = hexOrNull(input.certSha256, 64);
  if (declaredCert !== null && declaredCert !== serverCertSha!) {
    await purgeAndReject("Divergence signature — renvoyez le fichier d'origine.");
  }
  // Un build en revue peut être REMPLACÉ par un envoi plus récent.
  //
  // Avant, un envoi était refusé tant qu'un build était en revue : le
  // maker était bloqué jusqu'au verdict de l'admin (à l'échelle d'une
  // communauté, une revue à 3 jours = 3 jours d'arrêt sur la version
  // suivante). Le remplacement garde la trace (l'ancien passe «
  // rejeté / remplacé ») et le nouveau part en revue à sa place : la
  // file reste à UN build pending par produit, mais le maker n'est plus
  // bloqué.
  const [stillPending] = await db
    .select({ id: productBuilds.id, r2Key: productBuilds.r2Key })
    .from(productBuilds)
    .where(and(eq(productBuilds.productId, input.productId), eq(productBuilds.status, "pending")))
    .limit(1);
  if (stillPending) {
    await db
      .update(productBuilds)
      .set({
        status: "rejected",
        rejectionReason: "Remplacé par un envoi plus récent.",
        reviewedAt: new Date(),
      })
      .where(eq(productBuilds.id, stillPending.id));
    // Le binaire du build remplacé n'est plus downloadable (seul le
    // build approuvé l'est) : on ne garde pas d'orphelin R2.
    await deleteR2Object(PRODUCT_BUILDS_BUCKET, stillPending.r2Key).catch(() => {});
  }
  try {
    const [row] = await db
      .insert(productBuilds)
      .values({
        productId: input.productId,
        versionCode: input.versionCode ?? null,
        versionName: strOrNull(input.versionName, 64),
        whatsnew: whatsnew === "" ? null : whatsnew,
        package: packageName,
        minSdk: intOrNull(input.minSdk, 50),
        targetSdk: intOrNull(input.targetSdk, 50),
        permissions,
        certSha256: hexOrNull(input.certSha256, 64),
        certSha1: hexOrNull(input.certSha1, 40),
        sigScheme,
        certSubjectCn: strOrNull(input.certSubjectCn, 255),
        certSubjectO: strOrNull(input.certSubjectO, 255),
        certKeyAlg: strOrNull(input.certKeyAlg, 64),
        certKeyBits: intOrNull(input.certKeyBits, 16384),
        certSigAlg: strOrNull(input.certSigAlg, 64),
        sha256File: input.sha256.toLowerCase(),
        sizeBytes: input.sizeBytes,
        r2Key: input.r2Key,
        status: "pending",
      })
      .returning({ id: productBuilds.id });
    // Staff : tout build enregistré part en revue (D6). Fire-and-forget
    // best-effort — le record n'attend pas l'email et n'en dépend pas.
    void notifyAdminsReview({ productId: input.productId, buildId: row.id });
    return { id: row.id };
  } catch (e) {
    // Doublon (produit, version) : l'objet orphelin est purgé (jamais de
    // binaire sans ligne).
    await deleteR2Object(PRODUCT_BUILDS_BUCKET, input.r2Key).catch(() => {});
    throw e instanceof ProfileError
      ? e
      : new ProfileError("VALIDATION", "Build déjà enregistré (produit, version).");
  }
}

/**
 * Règle de version d'un build.
 *
 * La référence est le build **EN LIGNE** (approuvé) : c'est lui que
 * l'utilisateur a installé, donc lui seul fixe ce qu'un « nouveau »
 * `versionCode` doit dépasser. Un build REJETÉ n'a jamais été
 * distribué : l'utiliser comme référence brûlait le numéro de version
 * pour un rejet réparable (le motif de rejet dit pourtant « corrigez et
 * re-soumettre ») et forçait le maker à bumper son APK pour une simple
 * correction de notes.
 *
 * Pure (pas de DB) : la règle est testable hors réseau.
 */
export function assertVersionAllowed(input: {
  /** Codes des builds EN LIGNE (approuvés). */
  onlineCodes: number[];
  /** Code du build soumis (null = illisible). */
  newCode: number | null;
}): void {
  const maxCode = input.onlineCodes.reduce<number | null>((m, c) => Math.max(m ?? -1, c), null);
  if (maxCode === null) return;
  if (input.newCode === null || input.newCode <= maxCode) {
    throw new ProfileError(
      "VALIDATION",
      `Le code de version doit être supérieur à ${maxCode} (le build en ligne).`,
    );
  }
}

export type BuildListItem = typeof productBuilds.$inferSelect;

// L'identité d'un build (certificat/package) est calculée dans `lib/`
// (module pur) : la fiche de revue admin est un composant client, elle ne
// peut pas importer ce service (qui tire la connexion Postgres).
export { diffBuildIdentity } from "@/lib/build-identity";

/**
 * Téléchargement APK — événement + compteur dénormalisé.
 *
 * Les routes confient cette promesse à `after()` : les deux écritures sont
 * suivies après la réponse (302 web ou JSON natif), donc elles ne la
 * retiennent jamais tout en survivant à la fin de l'invocation. L'échec
 * d'écriture est avalé, jamais remonté au client.
 *
 * Appelé sur le chemin du presign, jamais dans une réponse servie en cache :
 * le handler doit s'exécuter pour qu'un téléchargement soit compté, et une
 * URL signée est par nature par requête.
 *
 * **Incrément atomique SQL** (`download_count + 1`) et non
 * lecture-modification-écriture en JS : deux téléchargements simultanés sur
 * la même fiche ne peuvent pas s'écraser. L'événement reste la vérité — le
 * compteur se reconstruit (`recountDownloadCounts`).
 */
export async function recordDownload(productId: string): Promise<void> {
  try {
    await db.insert(productDownloads).values({ productId });
    await db
      .update(products)
      .set({ downloadCount: sql`${products.downloadCount} + 1` })
      .where(eq(products.id, productId));
  } catch {
    // Compteur non tenu — la reconstruction (job) rattrape le décalage.
  }
}

/**
 * Reconstruction du compteur depuis les événements (job `scores`) : la
 * colonne est un cache, jamais la source de vérité. Même philosophy que la
 * branche « aucun vote → 0 » de `recomputeScores` : une fiche sans
 * événement doit retomber à 0, pas garder un nombre fantôme.
 */
export async function recountDownloadCounts(): Promise<{ updated: number }> {
  const r = await db.execute(sql`
    UPDATE ${products} p SET download_count = sub.n
    FROM (
      SELECT product_id, COUNT(*)::int AS n FROM ${productDownloads} GROUP BY product_id
    ) sub
    WHERE p.id = sub.product_id
      AND p.download_count <> sub.n
  `);
  const z = await db.execute(sql`
    UPDATE ${products} p SET download_count = 0
    WHERE p.download_count <> 0
      AND NOT EXISTS (SELECT 1 FROM ${productDownloads} d WHERE d.product_id = p.id)
  `);
  const count = (r: unknown) => Number((r as { rowCount?: number }).rowCount ?? 0);
  return { updated: count(r) + count(z) };
}

export type AdminBuildRow = {
  id: string;
  productId: string;
  productName: string;
  slug: string;
  productStatus: string;
  makerDisplayName: string;
  makerUsername: string;
  /** Logo fiche (la tuile initiales reste le repli). */
  iconUrl: string | null;
  versionCode: number | null;
  versionName: string | null;
  sizeBytes: number;
  status: string;
  createdAt: Date;
  /** Heures d'attente (SLA 24 h) — calculé service, jamais au rendu. */
  waitingHours: number;
};

/**
 * Tous les builds (section admin D6) : pending d'abord, puis récents.
 * Jointure produit (slug, statut) + maker — le lien par ligne en découle :
 * build pending → cockpit revue ; approved → fiche publique ; rejected →
 * cockpit si fiche en revue, sinon fiche publique.
 */
export async function listAllBuildsForAdmin(limit = 100): Promise<AdminBuildRow[]> {
  const rows = await db
    .select({
      id: productBuilds.id,
      productId: productBuilds.productId,
      productName: products.name,
      slug: products.slug,
      productStatus: products.status,
      makerDisplayName: users.displayName,
      makerUsername: users.username,
      iconUrl: products.iconUrl,
      versionCode: productBuilds.versionCode,
      versionName: productBuilds.versionName,
      sizeBytes: productBuilds.sizeBytes,
      status: productBuilds.status,
      createdAt: productBuilds.createdAt,
    })
    .from(productBuilds)
    .innerJoin(products, eq(products.id, productBuilds.productId))
    .innerJoin(users, eq(users.id, products.makerId))
    .orderBy(
      sql`CASE WHEN ${productBuilds.status} = 'pending' THEN 0 ELSE 1 END`,
      desc(productBuilds.createdAt),
    )
    .limit(Math.max(1, Math.min(200, limit)));
  return rows.map((r) => ({
    ...r,
    waitingHours: Math.max(0, Math.floor((Date.now() - r.createdAt.getTime()) / 3_600_000)),
  }));
}

export type RecentBuildUpdate = {
  productId: string;
  slug: string;
  productName: string;
  tagline: string;
  iconUrl: string | null;
  categoryId: string;
  makerUsername: string;
  makerDisplayName: string;
  makerAvatarUrl: string | null;
  votes: number;
  commentsCount: number;
  pricing: string;
  platforms: string[];
  audienceId: string;
  ratingsSum: number;
  ratingsCount: number;
  curated: boolean;
  publishedAt: Date | null;
  versionCode: number | null;
  versionName: string | null;
  sizeBytes: number;
  whatsnew: string | null;
  reviewedAt: Date;
};

/**
 * Mises à jour récentes (D6, home) : derniers builds approuvés de
 * fiches PUBLIÉES (jamais de pending/rejeté/dépublié en public).
 * Jointure fiche complète : les lignes se rendent comme des cartes
 * produit (`ProductCard`), pas comme des lignes custom.
 */
export async function getRecentApprovedBuilds(limit = 6): Promise<RecentBuildUpdate[]> {
  // DISTINCT ON exige l'ordre sur la colonne distinctive d'abord : la
  // récence globale se rejoue donc en requête externe (sous-requête),
  // sinon LIMIT trancherait par productId, pas par date. Un produit =
  // UNE carte (son dernier build approuvé) : sans ça, 2 builds approuvés
  // = 2 cartes = clés React dupliquées.
  const latestPerProduct = db
    .selectDistinctOn([productBuilds.productId], {
      productId: productBuilds.productId,
      slug: products.slug,
      productName: products.name,
      tagline: products.tagline,
      iconUrl: products.iconUrl,
      categoryId: products.category,
      makerUsername: users.username,
      makerDisplayName: users.displayName,
      makerAvatarUrl: users.avatarUrl,
      votes: products.upvoteCount,
      commentsCount: products.commentsCount,
      pricing: products.pricingModel,
      platforms: products.platforms,
      audienceId: products.audience,
      ratingsSum: products.ratingsSum,
      ratingsCount: products.ratingsCount,
      curated: products.curated,
      publishedAt: products.publishedAt,
      versionCode: productBuilds.versionCode,
      versionName: productBuilds.versionName,
      sizeBytes: productBuilds.sizeBytes,
      whatsnew: productBuilds.whatsnew,
      reviewedAt: productBuilds.reviewedAt,
    })
    .from(productBuilds)
    .innerJoin(products, eq(products.id, productBuilds.productId))
    .innerJoin(users, eq(users.id, products.makerId))
    .where(
      and(
        eq(productBuilds.status, "approved"),
        eq(products.status, "published"),
        isNull(products.deletedAt),
      ),
    )
    .orderBy(productBuilds.productId, desc(productBuilds.reviewedAt))
    .as("latest_per_product");
  const rows = await db
    .select()
    .from(latestPerProduct)
    .orderBy(desc(latestPerProduct.reviewedAt))
    .limit(Math.max(1, Math.min(20, limit)));
  return rows.flatMap((r) =>
    r.reviewedAt === null
      ? []
      : [
          {
            productId: r.productId,
            slug: r.slug,
            productName: r.productName,
            tagline: r.tagline,
            iconUrl: r.iconUrl,
            categoryId: r.categoryId,
            makerUsername: r.makerUsername,
            makerDisplayName: r.makerDisplayName,
            makerAvatarUrl: r.makerAvatarUrl,
            votes: r.votes,
            commentsCount: r.commentsCount,
            pricing: r.pricing,
            platforms: r.platforms,
            audienceId: r.audienceId,
            ratingsSum: r.ratingsSum,
            ratingsCount: r.ratingsCount,
            curated: r.curated,
            publishedAt: r.publishedAt,
            versionCode: r.versionCode,
            versionName: r.versionName,
            sizeBytes: r.sizeBytes,
            whatsnew: r.whatsnew,
            reviewedAt: r.reviewedAt,
          },
        ],
  );
}

/**
 * Compteurs builds (D6, shell admin) : file actionnable d'un coup d'œil.
 */
export async function getBuildStats(): Promise<{
  pending: number;
  approved: number;
  rejected: number;
}> {
  const rows = await db
    .select({ status: productBuilds.status, value: sql<number>`count(*)::int` })
    .from(productBuilds)
    .groupBy(productBuilds.status);
  const out = { pending: 0, approved: 0, rejected: 0 };
  for (const r of rows) {
    if (r.status === "pending" || r.status === "approved" || r.status === "rejected") {
      out[r.status] = r.value;
    }
  }
  return out;
}

/**
 * Builds APPROUVÉS d'un produit (fiche publique D5, mobile) : plus
 * récents d'abord. `r2Key` inclus MAIS réservé serveur (jamais sérialisé
 * client — le download passe par la route qui signe à la demande).
 */
export async function getApprovedBuilds(productId: string): Promise<BuildListItem[]> {
  return db
    .select()
    .from(productBuilds)
    .where(and(eq(productBuilds.productId, productId), eq(productBuilds.status, "approved")))
    .orderBy(desc(productBuilds.createdAt));
}

/**
 * Dernier build approuvé par produit (check-update mobile : 1 requête quel
 * que soit le lot). `DISTINCT ON` : versionCode max d'abord (NULL en
 * dernier = enregistrements bruts D1), départage création. Fiches non
 * publiées exclues (jamais de fuite pre-revue). Sous-ensemble sérialisable
 * (jamais la clé R2).
 */
export type LatestApprovedBuild = Pick<
  BuildListItem,
  | "productId"
  | "versionCode"
  | "versionName"
  | "package"
  | "minSdk"
  | "targetSdk"
  | "sha256File"
  | "sizeBytes"
  | "whatsnew"
  | "reviewedAt"
>;

export async function getLatestApprovedBuilds(
  productIds: string[],
): Promise<Map<string, LatestApprovedBuild>> {
  const map = new Map<string, LatestApprovedBuild>();
  const ids = [...new Set(productIds)].slice(0, 50);
  if (ids.length === 0) return map;
  // `db.execute` brut = snake_case : mapping explicite vers BuildListItem
  // (seuls les champs lus par le mobile sont repris, jamais la clé R2).
  const rows = (await db.execute(sql`
    SELECT DISTINCT ON (b.product_id)
      b.product_id, b.version_code, b.version_name, b.package, b.min_sdk,
      b.target_sdk, b.sha256_file, b.size_bytes, b.whatsnew, b.reviewed_at
    FROM product_builds b
    JOIN products p ON p.id = b.product_id
    WHERE b.product_id IN (${sql.join(
      ids.map((id) => sql`${id}::uuid`),
      sql`, `,
    )})
      AND b.status = 'approved'
      AND p.status = 'published'
      AND p.deleted_at IS NULL
    ORDER BY b.product_id, b.version_code DESC NULLS LAST, b.created_at DESC
  `)) as unknown as {
    product_id: string;
    version_code: number | null;
    version_name: string | null;
    package: string | null;
    min_sdk: number | null;
    target_sdk: number | null;
    sha256_file: string;
    size_bytes: number;
    whatsnew: string | null;
    reviewed_at: Date | null;
  }[];
  for (const row of rows) {
    // `db.execute` brut : timestamptz arrive en string — normalisé en Date
    // ici (jamais de `.toISOString` sauvage chez les appelants).
    const reviewedAt = row.reviewed_at ? new Date(row.reviewed_at as unknown as string) : null;
    map.set(row.product_id, {
      productId: row.product_id,
      versionCode: row.version_code,
      versionName: row.version_name,
      package: row.package,
      minSdk: row.min_sdk,
      targetSdk: row.target_sdk,
      sha256File: row.sha256_file,
      sizeBytes: Number(row.size_bytes),
      whatsnew: row.whatsnew,
      reviewedAt,
    });
  }
  return map;
}

/**
 * Statut binaire par produit (dashboard : bouton Update vs rattrapage) :
 * track existe ? + max versionCode + nombre de builds. Une requête.
 */
export async function getProductsBuildStatus(productIds: string[]): Promise<
  Record<
    string,
    {
      hasBuilds: boolean;
      latestVersionCode: number | null;
      buildCount: number;
      hasPendingBuild: boolean;
      /** Nombre de binaires EN REVUE (pas le nombre de produits). */
      pendingBuildCount: number;
    }
  >
> {
  const out: Record<
    string,
    {
      hasBuilds: boolean;
      latestVersionCode: number | null;
      buildCount: number;
      hasPendingBuild: boolean;
      /** Nombre de binaires EN REVUE (pas le nombre de produits). */
      pendingBuildCount: number;
    }
  > = {};
  for (const id of productIds)
    out[id] = {
      hasBuilds: false,
      latestVersionCode: null,
      buildCount: 0,
      hasPendingBuild: false,
      pendingBuildCount: 0,
    };
  if (productIds.length === 0) return out;
  const rows = await db
    .select({
      productId: productBuilds.productId,
      versionCode: productBuilds.versionCode,
      status: productBuilds.status,
    })
    .from(productBuilds)
    .where(inArray(productBuilds.productId, productIds));
  for (const r of rows) {
    const entry = out[r.productId];
    if (!entry) continue;
    entry.hasBuilds = true;
    entry.buildCount += 1;
    if (r.status === "pending") {
      entry.hasPendingBuild = true;
      entry.pendingBuildCount += 1;
    }
    if (typeof r.versionCode === "number") {
      entry.latestVersionCode = Math.max(entry.latestVersionCode ?? -1, r.versionCode);
    }
  }
  return out;
}

const UPDATE_BADGE_DAYS = 14;

/**
 * Badge discovery « Mis à jour » (D6) : dernier build approuvé revu il
 * y a < 14 j → libellé de version. Un appel pour N produits (home).
 * Jointure `published` : la garantie ne dépend d'aucun appelant (un
 * badge sur fiche rejetée serait un mensonge public).
 */
export async function getProductsUpdateBadges(
  productIds: string[],
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (productIds.length === 0) return out;
  const since = new Date(Date.now() - UPDATE_BADGE_DAYS * 86_400_000);
  const dated: Record<string, { at: Date; label: string }> = {};
  const rows = await db
    .select({
      productId: productBuilds.productId,
      versionCode: productBuilds.versionCode,
      versionName: productBuilds.versionName,
      reviewedAt: productBuilds.reviewedAt,
      createdAt: productBuilds.createdAt,
    })
    .from(productBuilds)
    .innerJoin(products, eq(products.id, productBuilds.productId))
    .where(
      and(
        inArray(productBuilds.productId, productIds),
        eq(productBuilds.status, "approved"),
        eq(products.status, "published"),
        isNull(products.deletedAt),
      ),
    );
  for (const r of rows) {
    const stamped = r.reviewedAt ?? r.createdAt;
    if (!stamped || stamped < since) continue;
    const label =
      r.versionCode === null && !r.versionName
        ? "nouvelle version"
        : `v${r.versionName ?? "?"} (${r.versionCode ?? "?"})`;
    const prev = dated[r.productId];
    if (!prev || stamped > prev.at) dated[r.productId] = { at: stamped, label };
  }
  for (const [id, v] of Object.entries(dated)) out[id] = v.label;
  return out;
}

/**
 * Builds d'un produit (staff : panneau revue ; maker : dashboard D6) :
 * pending d'abord, puis plus récents. Inclut `r2Key` (le CALLER génère
 * l'URL signée courte côté serveur — jamais exposée telle quelle).
 */
export async function listProductBuilds(productId: string): Promise<BuildListItem[]> {
  return db
    .select()
    .from(productBuilds)
    .where(eq(productBuilds.productId, productId))
    .orderBy(
      sql`CASE WHEN ${productBuilds.status} = 'pending' THEN 0 ELSE 1 END`,
      desc(productBuilds.createdAt),
    );
}

/**
 * Revue binaire (staff) : pending → approved | rejected (+ motif
 * obligatoire au rejet, emailé). Symétrique à la revue fiche — deux
 * axes indépendants (matrice 2×2).
 */
export async function reviewBuild(input: {
  buildId: string;
  decision: "approved" | "rejected";
  reason?: string;
  staffId: string;
}): Promise<{ productId: string; versionCode: number | null; versionName: string | null }> {
  const [build] = await db
    .select({
      id: productBuilds.id,
      productId: productBuilds.productId,
      status: productBuilds.status,
      versionCode: productBuilds.versionCode,
      versionName: productBuilds.versionName,
    })
    .from(productBuilds)
    .where(eq(productBuilds.id, input.buildId))
    .limit(1);
  if (!build) throw new ProfileError("NOT_FOUND", "Build introuvable.");
  if (build.status !== "pending") {
    throw new ProfileError("VALIDATION", "Build déjà tranché.");
  }
  const reason = (input.reason ?? "").trim();
  if (input.decision === "rejected" && reason === "") {
    throw new ProfileError("VALIDATION", "Motif requis (emailé au maker).");
  }
  await db
    .update(productBuilds)
    .set({
      status: input.decision === "approved" ? "approved" : "rejected",
      rejectionReason: input.decision === "rejected" ? reason : null,
      reviewedAt: new Date(),
      reviewedBy: input.staffId,
    })
    .where(eq(productBuilds.id, input.buildId));
  return {
    productId: build.productId,
    versionCode: build.versionCode,
    versionName: build.versionName,
  };
}
