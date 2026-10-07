"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/supabase/server";
import { ProfileError, setDigestOptOut } from "@/services/users.service";
import { captureError } from "@/lib/monitoring";

export type SettingsActionState = { ok: boolean; message: string | null };

/**
 * Préférence récap hebdo (switch settings, effet immédiat) : n'écrit QUE
 * la colonne `digest_opt_out` — jamais le profil complet (sinon chaque
 * toggle réécrirait le profil). In-app toujours actif, seul l'email
 * hebdo est coupé.
 */
export async function updateDigestPref(optOut: boolean): Promise<SettingsActionState> {
  const user = await getSessionUser();
  if (!user) return { ok: false, message: "Connectez-vous pour modifier ce réglage." };
  try {
    await setDigestOptOut(user.id, optOut);
    revalidatePath("/settings");
    return {
      ok: true,
      message: optOut ? "Récap hebdo désactivé." : "Récap hebdo activé.",
    };
  } catch (e) {
    if (e instanceof ProfileError) return { ok: false, message: e.message };
    captureError(e, { op: "settings.digest" });
    return { ok: false, message: "Réglage impossible pour le moment." };
  }
}
