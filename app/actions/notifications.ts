"use server";

import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/supabase/server";
import { captureError } from "@/lib/monitoring";
import { markNotificationsRead } from "@/services/notifications.service";

export type NotificationsActionState = { ok: boolean; message: string | null };

/** Tout marquer comme lu (cloche + page). */
export async function markAllNotificationsRead(): Promise<NotificationsActionState> {
  const user = await getSessionUser();
  if (!user) return { ok: false, message: "Connectez-vous." };
  try {
    await markNotificationsRead(user.id);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/notifications");
    return { ok: true, message: "Notifications marquées comme lues." };
  } catch (e) {
    captureError(e instanceof Error ? e : new Error(String(e)), { op: "notifications.read" });
    return { ok: false, message: "Opération impossible." };
  }
}
