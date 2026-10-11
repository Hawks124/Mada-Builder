import { ZipArchive, type Archiver } from "archiver";
import { Readable } from "node:stream";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  appeals,
  comments,
  productBuilds,
  productScreenshots,
  products,
  reviews,
  users,
  votes,
} from "@/db/schema";
import { PRODUCT_BUILDS_BUCKET, getR2ObjectStream } from "@/lib/r2";
import { createAdminClient } from "@/lib/supabase/admin";
import { APPEALS_BUCKET } from "@/lib/supabase/storage";
import { ProfileError } from "@/services/users.service";

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

/**
 * Export RGPD/portabilité (légal §Mes droits) : TOUTES les données du
 * maker, binaires inclus (logos, captures, APKs, preuves d'appel — sa
 * propriété, `confidentialite.md`). ZIP streamé, zéro buffering :
 * data.json + MANIFEST.txt + /media + /builds + /appeals.
 * Best-effort par fichier (objet manquant = noté, jamais bloquant).
 */

type MediaRef =
  | { kind: "url"; url: string; zipPath: string; label: string }
  | { kind: "r2"; bucket: string; key: string; zipPath: string; label: string }
  | { kind: "appeals"; path: string; zipPath: string; label: string };

function safeSlug(slug: string): string {
  return slug.replace(/[^a-z0-9-]+/gi, "-").slice(0, 60) || "produit";
}

function extOf(keyOrUrl: string, fallback: string): string {
  const m = keyOrUrl.split("?")[0].match(/\.([a-z0-9]{2,5})$/i);
  return m ? `.${m[1].toLowerCase()}` : fallback;
}

export async function collectExportBundle(userId: string): Promise<{
  data: Record<string, unknown>;
  media: MediaRef[];
  counts: {
    products: number;
    votes: number;
    reviews: number;
    comments: number;
    builds: number;
    files: number;
  };
}> {
  const [profile] = await db
    .select({
      username: users.username,
      displayName: users.displayName,
      email: users.email,
      avatarUrl: users.avatarUrl,
      bio: users.bio,
      occupation: users.occupation,
      websiteUrl: users.websiteUrl,
      socialLinks: users.socialLinks,
      country: users.country,
      city: users.city,
      timeZone: users.timeZone,
      providers: users.providers,
      digestOptOut: users.digestOptOut,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .limit(1);
  if (!profile) throw new ProfileError("NOT_FOUND", "Compte introuvable.");

  const [myProducts, myVotes, myReviews, myComments, myAppeals] = await Promise.all([
    db
      .select()
      .from(products)
      .where(eq(products.makerId, userId))
      .orderBy(desc(products.createdAt)),
    db
      .select({ productId: votes.productId, weight: votes.weight, createdAt: votes.createdAt })
      .from(votes)
      .where(eq(votes.userId, userId)),
    db
      .select({
        productId: reviews.productId,
        rating: reviews.rating,
        body: reviews.body,
        makerResponse: reviews.makerResponse,
        createdAt: reviews.createdAt,
        updatedAt: reviews.updatedAt,
      })
      .from(reviews)
      .where(eq(reviews.userId, userId)),
    db
      .select({
        productId: comments.productId,
        parentId: comments.parentId,
        body: comments.body,
        score: comments.score,
        createdAt: comments.createdAt,
        updatedAt: comments.updatedAt,
      })
      .from(comments)
      .where(eq(comments.userId, userId)),
    db
      .select({
        seq: appeals.seq,
        banReason: appeals.banReason,
        explanation: appeals.explanation,
        evidencePaths: appeals.evidencePaths,
        status: appeals.status,
        reviewedAt: appeals.reviewedAt,
        createdAt: appeals.createdAt,
      })
      .from(appeals)
      .where(eq(appeals.userId, userId)),
  ]);

  const productIds = myProducts.map((p) => p.id);
  const shotsByProduct = new Map<string, { url: string }[]>();
  const buildsByProduct = new Map<
    string,
    {
      versionName: string | null;
      versionCode: number | null;
      r2Key: string;
      sha256File: string;
      certSha256: string | null;
      sizeBytes: number;
      status: string;
      createdAt: Date;
      reviewedAt: Date | null;
    }[]
  >();
  await Promise.all(
    productIds.map(async (pid) => {
      const [shots, builds] = await Promise.all([
        db
          .select({ url: productScreenshots.url })
          .from(productScreenshots)
          .where(eq(productScreenshots.productId, pid)),
        db
          .select({
            versionName: productBuilds.versionName,
            versionCode: productBuilds.versionCode,
            r2Key: productBuilds.r2Key,
            sha256File: productBuilds.sha256File,
            certSha256: productBuilds.certSha256,
            sizeBytes: productBuilds.sizeBytes,
            status: productBuilds.status,
            createdAt: productBuilds.createdAt,
            reviewedAt: productBuilds.reviewedAt,
          })
          .from(productBuilds)
          .where(eq(productBuilds.productId, pid)),
      ]);
      shotsByProduct.set(pid, shots);
      buildsByProduct.set(pid, builds);
    }),
  );

  const media: MediaRef[] = [];
  const productsOut = myProducts.map((p) => {
    const slug = safeSlug(p.slug);
    if (p.iconUrl) {
      media.push({
        kind: "url",
        url: p.iconUrl,
        zipPath: `media/${slug}-logo${extOf(p.iconUrl, ".webp")}`,
        label: `logo ${slug}`,
      });
    }
    (shotsByProduct.get(p.id) ?? []).forEach((s, i) => {
      media.push({
        kind: "url",
        url: s.url,
        zipPath: `media/${slug}-shot-${i + 1}${extOf(s.url, ".webp")}`,
        label: `capture ${slug} #${i + 1}`,
      });
    });
    (buildsByProduct.get(p.id) ?? []).forEach((b) => {
      const v =
        b.versionCode === null && !b.versionName
          ? "initial"
          : `v${b.versionName ?? "?"}-${b.versionCode ?? "?"}`;
      media.push({
        kind: "r2",
        bucket: PRODUCT_BUILDS_BUCKET,
        key: b.r2Key,
        zipPath: `builds/${slug}-${v}.apk`,
        label: `binaire ${slug} ${v} (${b.status})`,
      });
    });
    return {
      ...p,
      createdAt: iso(p.createdAt),
      updatedAt: iso(p.updatedAt),
      publishedAt: iso(p.publishedAt),
      submittedAt: iso(p.submittedAt),
    };
  });
  myAppeals.forEach((a, i) => {
    (a.evidencePaths ?? []).forEach((path, j) => {
      media.push({
        kind: "appeals",
        path,
        zipPath: `appeals/appel-${a.seq}-preuve-${j + 1}${extOf(path, ".bin")}`,
        label: `preuve appel #${a.seq} (${i + 1})`,
      });
    });
  });

  const data = {
    exporteLe: new Date().toISOString(),
    profil: { ...profile, createdAt: iso(profile.createdAt) },
    produits: productsOut,
    votes: myVotes.map((v) => ({ ...v, createdAt: iso(v.createdAt) })),
    avis: myReviews.map((r) => ({
      ...r,
      createdAt: iso(r.createdAt),
      updatedAt: iso(r.updatedAt),
    })),
    commentaires: myComments.map((c) => ({
      ...c,
      createdAt: iso(c.createdAt),
      updatedAt: iso(c.updatedAt),
    })),
    appels: myAppeals.map((a) => ({
      ...a,
      reviewedAt: iso(a.reviewedAt),
      createdAt: iso(a.createdAt),
    })),
    binairesMeta: [...buildsByProduct.entries()].flatMap(([pid, builds]) =>
      builds.map((b) => ({
        productId: pid,
        versionName: b.versionName,
        versionCode: b.versionCode,
        sha256: b.sha256File,
        certSha256: b.certSha256,
        sizeBytes: b.sizeBytes,
        status: b.status,
        createdAt: iso(b.createdAt),
        reviewedAt: iso(b.reviewedAt),
      })),
    ),
  };
  return {
    data,
    media,
    counts: {
      products: myProducts.length,
      votes: myVotes.length,
      reviews: myReviews.length,
      comments: myComments.length,
      builds: data.binairesMeta.length,
      files: media.length,
    },
  };
}

function manifestTxt(username: string, counts: Record<string, number>, skipped: string[]): string {
  return [
    `Export Mada-Made — @${username}`,
    `Généré le ${new Date().toISOString()}`,
    ``,
    `Contenu : ${counts.products} produit(s), ${counts.votes} vote(s), ${counts.reviews} avis, ${counts.comments} commentaire(s), ${counts.builds} binaire(s), ${counts.files} fichier(s) média.`,
    `data.json = vos données structurées. /media = logos et captures. /builds = vos APK (tous statuts). /appeals = preuves d'appel.`,
    skipped.length > 0
      ? `\nFichiers indisponibles au moment de l'export (notés, non bloquants) :\n${skipped.map((s) => `- ${s}`).join("\n")}`
      : `\nTous les fichiers ont été inclus.`,
    ``,
  ].join("\n");
}

async function appendMedia(archive: Archiver, ref: MediaRef, skipped: string[]): Promise<void> {
  try {
    if (ref.kind === "url") {
      const res = await fetch(ref.url);
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      archive.append(Readable.fromWeb(res.body as never), {
        name: ref.zipPath,
      });
    } else if (ref.kind === "r2") {
      const stream = await getR2ObjectStream(ref.bucket, ref.key);
      archive.append(stream, { name: ref.zipPath });
    } else {
      const admin = createAdminClient();
      const { data, error } = await admin.storage.from(APPEALS_BUCKET).download(ref.path);
      if (error || !data) throw error ?? new Error("objet vide");
      archive.append(Buffer.from(await data.arrayBuffer()), { name: ref.zipPath });
    }
  } catch {
    skipped.push(ref.label);
  }
}

/**
 * Archive ZIP streamée (pipe R2/HTTP → ZIP → réponse, zéro buffering
 * fichier : même 300 Mo ne tiennent jamais en RAM). Toujours servie en
 * direct — pas de file, pas d'email (l'email ne peut de toute façon pas
 * porter des binaires ; le jour d'un vrai timeout constaté, ajouter une
 * file async avec lien signé, pas une pièce jointe).
 */
export async function streamUserExport(
  userId: string,
): Promise<{ filename: string; stream: ReadableStream<Uint8Array> }> {
  const { data, media, counts } = await collectExportBundle(userId);
  const username = (data.profil as { username: string }).username;
  const archive = new ZipArchive({ zlib: { level: 1 } });
  const skipped: string[] = [];
  // Les erreurs d'append sont des events, jamais des throws : sans ce
  // listener, un fichier illisible ferait crasher le worker.
  archive.on("error", () => {
    try {
      archive.abort();
    } catch {
      /* déjà terminé */
    }
  });
  // Finalize en tâche de fond : les erreurs média sont notées, jamais
  // bloquantes (le manifeste reste exact sur les données).
  void (async () => {
    try {
      archive.append(JSON.stringify(data, null, 2), { name: "data.json" });
      for (const ref of media) {
        await appendMedia(archive, ref, skipped);
      }
      archive.append(manifestTxt(username, counts, skipped), { name: "MANIFEST.txt" });
      await archive.finalize();
    } catch {
      try {
        archive.abort();
      } catch {
        /* déjà terminé */
      }
    }
  })();
  const safe = username.replace(/[^a-z0-9-]+/gi, "-").toLowerCase() || "export";
  return {
    filename: `mada-made-export-${safe}.zip`,
    stream: Readable.toWeb(archive) as ReadableStream<Uint8Array>,
  };
}
