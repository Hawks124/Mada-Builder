import { db } from "@/db";
import { adminActions, type AdminActionType } from "@/db/schema";
import { captureError } from "@/lib/monitoring";

/**
 * Audit trail modération — écrit APRÈS l'opération, JAMAIS avant :
 * l'audit ne doit pas bloquer une modération (fail-soft + log Sentry).
 * Échec silencieux assumé et documenté (mieux qu'une exception qui
 * annulerait un ban/déban déjà décidé).
 */
export async function logAdminAction(input: {
  actorId: string;
  targetId: string;
  action: AdminActionType;
  note?: string | null;
}): Promise<void> {
  try {
    await db.insert(adminActions).values({
      actorId: input.actorId,
      targetId: input.targetId,
      action: input.action,
      note: input.note ?? null,
    });
  } catch (e) {
    captureError(e, { op: "admin.audit" });
  }
}
