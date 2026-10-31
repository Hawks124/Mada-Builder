import type { Metadata } from "next";
import { SubmitClient } from "./submit-client";
import { getSessionUser } from "@/lib/supabase/server";
import { fetchMyProducts, getEditMedia, toEditApp } from "@/services/products.service";
import { getProductsBuildStatus } from "@/services/builds.service";

export const metadata: Metadata = {
  title: "Soumettre un produit",
  robots: { index: false, follow: false },
};

export type EditMedia = Awaited<ReturnType<typeof getEditMedia>> | null;

// Soumission + édition : ?edit=<id> charge la fiche de l'auteur
// (tout statut — le service d'update conserve le vrai statut) + médias
// existants (affichage seul : absents = conservés).
export default async function SubmitProductPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit } = await searchParams;
  let editApp = null;
  let editMedia: EditMedia = null;
  let hasTrack = false;
  // Revision en attente : la fiche reste en ligne avec son contenu
  // valide, la modification attend un regard admin. Le maker doit le
  // savoir (sinon il croit que son edit a ete perdu).
  let pendingRevisionAt: Date | null = null;
  if (edit) {
    const user = await getSessionUser();
    if (user) {
      const { items: rows } = await fetchMyProducts(user.id);
      const found = rows.find((r) => r.id === edit);
      if (found) {
        editApp = toEditApp(found);
        editMedia = await getEditMedia(user.id, found.id).catch(() => null);
        // Track binaire (D6) : sans track → section APK inline dans le
        // form ; avec track → lien vers Update (verrou versionné).
        hasTrack =
          (await getProductsBuildStatus([found.id]).catch(() => null))?.[found.id]?.hasBuilds ??
          false;
        pendingRevisionAt = found.revisionAt ?? null;
      }
    }
  }
  return (
    <SubmitClient
      editId={edit ?? null}
      editApp={editApp}
      editMedia={editMedia}
      hasTrack={hasTrack}
      pendingRevisionAt={pendingRevisionAt}
    />
  );
}
