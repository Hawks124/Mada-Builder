import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/supabase/server";
import { fetchMyProducts } from "@/services/products.service";
import { listProductBuilds } from "@/services/builds.service";
import { presignBuildDownload } from "@/lib/r2";
import { UpdateClient } from "./update-client";

export const metadata: Metadata = {
  title: "Mettre à jour le binaire",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

// Update binaire (D4) : propriété prouvée (fiche du maker), Android
// uniquement. Page dédiée, séparée d'Éditer. Track (≥1 build) → APK +
// notes requis + versionCode strictement supérieur ; sans track →
// rattrapage (notes optionnelles).
export default async function UpdateProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/signin?next=/dashboard/products");
  const { items } = await fetchMyProducts(user.id);
  const row = items.find((r) => r.id === id);
  if (!row || !row.platforms.includes("android")) notFound();
  const builds = await listProductBuilds(id).catch(() => []);
  const coded = builds.flatMap((b) =>
    typeof b.versionCode === "number" ? [{ code: b.versionCode, name: b.versionName }] : [],
  );
  const latest = coded.length > 0 ? coded.reduce((a, b) => (b.code > a.code ? b : a)) : null;
  // Historique (D6) : statuts + notes + lien de test (URLs signées courtes
  // au rendu — jamais de r2Key sérialisée au client). Métadonnées
  // manifest/certs incluses pour le tableau du dernier build.
  const history = await Promise.all(
    builds.map(async (b) => {
      let downloadUrl: string | null = null;
      try {
        downloadUrl = await presignBuildDownload(b.r2Key);
      } catch {
        downloadUrl = null;
      }
      return {
        id: b.id,
        versionCode: b.versionCode,
        versionName: b.versionName,
        status: b.status,
        sizeBytes: b.sizeBytes,
        createdAt: b.createdAt.toISOString(),
        whatsnew: b.whatsnew,
        rejectionReason: b.rejectionReason,
        downloadUrl,
        package: b.package,
        minSdk: b.minSdk,
        targetSdk: b.targetSdk,
        permissions: b.permissions,
        certSha256: b.certSha256,
        certSha1: b.certSha1,
        sigScheme: b.sigScheme,
        certSubjectCn: b.certSubjectCn,
        certSubjectO: b.certSubjectO,
        certKeyAlg: b.certKeyAlg,
        certKeyBits: b.certKeyBits,
        certSigAlg: b.certSigAlg,
      };
    }),
  );
  return (
    <UpdateClient
      productId={id}
      productName={row.name}
      productIconUrl={row.iconUrl ?? null}
      hasTrack={builds.length > 0}
      latestVersionCode={latest?.code ?? null}
      latestVersionName={latest?.name ?? null}
      history={history}
    />
  );
}
