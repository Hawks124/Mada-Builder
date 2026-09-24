"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSessionUser, getViewer } from "@/lib/supabase/server";
import {
  ProfileError,
  completeProfile,
  getOnboardingStatus,
} from "@/services/users.service";
import { withToast } from "@/lib/toast";
import { captureError } from "@/lib/monitoring";

export type OnboardingState = { ok: boolean; message: string | null };

/** ?next= validé same-origin (même règle que callback/auth). */
function sanitizeNext(raw: string | null | undefined): string {
  if (typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//")) {
    return raw;
  }
  return "/dashboard";
}

/**
 * Complète le profil (nom et/ou email manquants) — puis redirect ?next=.
 * Bannis exclus en amont (gate racine : banni d'abord, voir layout).
 */
export async function completeMyProfile(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const user = await getSessionUser();
  if (!user) redirect("/signin");
  const next = sanitizeNext(
    typeof formData.get("next") === "string"
      ? (formData.get("next") as string)
      : null,
  );
  const input: { displayName?: string; email?: string; occupation?: string } = {};
  const rawName = formData.get("displayName");
  const rawEmail = formData.get("email");
  const rawOccupation = formData.get("occupation");
  if (typeof rawName === "string" && rawName.trim() !== "") {
    input.displayName = rawName;
  }
  if (typeof rawEmail === "string" && rawEmail.trim() !== "") {
    input.email = rawEmail;
  }
  if (typeof rawOccupation === "string" && rawOccupation.trim() !== "") {
    input.occupation = rawOccupation;
  }
  try {
    const { username } = await completeProfile(user.id, user.id, input);
    revalidatePath(`/makers/${username}`);
    revalidatePath("/");
    redirect(withToast(next, "ok", "Profil complété. Bienvenue !"));
  } catch (e) {
    if (e instanceof ProfileError) return { ok: false, message: e.message };
    captureError(e, { op: "onboarding.complete" });
    return { ok: false, message: "Enregistrement impossible." };
  }
}

/**
 * Gate inbypassable (layouts) : "/bienvenue" si incomplet, null sinon.
 * Flag d'abord (cas nominal post-migration), heuristique placeholder/nom
 * en filet (data sale antérieure — jamais de faux négatif).
 * Banni d'abord CÔTÉ APPELANT (le layout dashboard rend l'écran verrouillé
 * avant d'appeler ici — un banni ne va jamais à /bienvenue par la gate).
 * Sans session : null (coût zéro pour les invités). Ligne absente
 * (lag trigger) : gate (la page crée au submit).
 * ERREUR → null (jamais de redirect sur du non-vérifié : c'est ce qui
 * produisait la boucle /bienvenue ↔ /signin sous hoquet réseau).
 */
export async function getOnboardingRedirect(): Promise<string | null> {
  const viewer = await getViewer().catch(() => ({ status: "error" as const }));
  if (viewer.status !== "authed") return null;
  try {
    // Prédicat UNIQUE partagé avec la page (jamais de logique dupliquée).
    const { done } = await getOnboardingStatus(viewer.user.id);
    return done ? null : "/bienvenue";
  } catch {
    // Erreur DB → laisser passer (jamais bloquer sur un incident de lecture).
    return null;
  }
}

/**
 * Mode dégradé (bandeau "démonstration") : vrai quand la session n'a pas
 * pu être VÉRIFIÉE (ni invitée prouvée, ni authentifiée). getViewer étant
 * mémoïsé par requête, cet appel est gratuit après la gate.
 */
export async function isViewerDegraded(): Promise<boolean> {
  const viewer = await getViewer().catch(() => ({ status: "error" as const }));
  return viewer.status === "error";
}
