// Crée les buckets R2 produits s'ils manquent (idempotent) + CORS du
// bucket builds (idempotent, écrasé à chaque run).
// R2 n'a pas de RLS : buckets publics en lecture, enforcement 100 %
// applicatif (ownership + validation côté services). Domaine custom
// configuré côté Cloudflare (R2_PUBLIC_BASE), jamais ici.
//
// CORS `*` sur product-builds : premier upload navigateur→R2 direct du
// projet (les logos passent par le serveur, le staging par le natif
// mobile — aucun n'avait besoin de CORS). `*` est sûr ici : l'URL
// présignée EST l'autorisation (15 min, clé confinée builds/{maker}/,
// jamais de cookies/credentials dans les requêtes navigateur).
// Usage: npx tsx scripts/r2-setup.ts (clés R2_* requises)
import "./_env";
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const BUCKETS = ["product-logos", "product-shots", "product-builds"];

async function main(): Promise<void> {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("R2_* manquantes (.env.local, voir .env.example)");
  }
  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  for (const bucket of BUCKETS) {
    try {
      await s3.send(new HeadBucketCommand({ Bucket: bucket }));
      console.log(`OK: bucket ${bucket} (existant)`);
    } catch {
      await s3.send(new CreateBucketCommand({ Bucket: bucket }));
      console.log(`OK: bucket ${bucket} (créé)`);
    }
  }
  await s3.send(
    new PutBucketCorsCommand({
      Bucket: "product-builds",
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: ["*"],
            AllowedMethods: ["PUT", "GET", "HEAD"],
            AllowedHeaders: ["content-type", "content-length", "x-amz-*"],
            ExposeHeaders: ["ETag"],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    }),
  );
  console.log("OK: CORS product-builds (PUT/GET/HEAD, origins *, 1 h)");
}

main().catch((e) => {
  console.error("r2-setup:", e instanceof Error ? e.message : e);
  process.exit(1);
});
