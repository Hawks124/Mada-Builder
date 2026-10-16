"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/supabase/server";
import { revokeRevenueConnection, setRevenueDisplayMode } from "@/services/revenue/connections";
import { ProfileError } from "@/services/users.service";
import { captureError } from "@/lib/monitoring";

export type RevenueActionState = { ok: boolean; message: string | null };

/** Révocation maker (clé purgée, snapshots conservés) + revalidation shell. */
export async function revokeRevenueAction(input: {
  connectionId: string;
}): Promise<RevenueActionState> {
  const user = await getSessionUser();
  if (!user) return { ok: false, message: "Connectez-vous." };
  try {
    await revokeRevenueConnection(user.id, input.connectionId);
    revalidatePath("/dashboard/api");
    return { ok: true, message: "Clé supprimée — sync coupée." };
  } catch (e) {
    if (e instanceof ProfileError) return { ok: false, message: e.message };
    captureError(e instanceof Error ? e : new Error(String(e)), { op: "revenue.revoke" });
    return { ok: false, message: "Suppression impossible pour le moment." };
  }
}

/** Bascule d'affichage (sans toucher à la clé) + revalidation shell. */
export async function setRevenueDisplayModeAction(input: {
  connectionId: string;
  displayMode: "full" | "badge_only";
}): Promise<RevenueActionState> {
  const user = await getSessionUser();
  if (!user) return { ok: false, message: "Connectez-vous." };
  if (input.displayMode !== "full" && input.displayMode !== "badge_only") {
    return { ok: false, message: "Mode invalide." };
  }
  try {
    await setRevenueDisplayMode(user.id, input.connectionId, input.displayMode);
    revalidatePath("/dashboard/api");
    return { ok: true, message: "Affichage mis à jour." };
  } catch (e) {
    if (e instanceof ProfileError) return { ok: false, message: e.message };
    captureError(e instanceof Error ? e : new Error(String(e)), { op: "revenue.display" });
    return { ok: false, message: "Modification impossible pour le moment." };
  }
}
