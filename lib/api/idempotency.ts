import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { idempotencyKeys } from "@/db/schema";
import { ApiError } from "@/lib/api/response";
import { captureError } from "@/lib/monitoring";

const KEY_RE = /^[A-Za-z0-9_-]{1,64}$/;
const TTL_HOURS = 24;

export type IdempotentResult<T> = { replayed: boolean; status: number; data: T };

/** Violation d'unicité : Drizzle enveloppe l'erreur driver (`cause`). */
export function isUniqueViolation(e: unknown): boolean {
  if ((e as { code?: unknown })?.code === "23505") return true;
  const cause = (e as { cause?: unknown })?.cause;
  return (cause as { code?: unknown })?.code === "23505";
}

/**
 * Idempotence POST (Phase 6) : `key` absente → exécution directe (opt-in,
 * jamais imposé) ; présente → réservation (conflit = 1re exécution gagnée,
 * concurrence = 409), exécution, stockage `{status, body}`, rejouement à
 * l'identique. Expirées purgées paresseusement. Panne stockage → exécution
 * directe (fail-open : mieux vaut un doublon théorique qu'un refus).
 */
export async function withIdempotency<T extends Record<string, unknown>>(input: {
  userId: string;
  key: string | null;
  run: () => Promise<{ status: number; data: T }>;
}): Promise<IdempotentResult<T>> {
  const key = (input.key ?? "").trim();
  if (!KEY_RE.test(key)) {
    if (key !== "") {
      throw new ApiError(
        "VALIDATION",
        422,
        "Clé d'idempotence invalide (1-64 : lettres, chiffres, -_).",
      );
    }
    const fresh = await input.run();
    return { replayed: false, ...fresh };
  }
  try {
    await db.execute(
      sql`DELETE FROM ${idempotencyKeys} WHERE created_at < NOW() - ${`${TTL_HOURS} hours`}::interval`,
    );
    let reserved = true;
    try {
      await db
        .insert(idempotencyKeys)
        .values({ userId: input.userId, key, status: null, body: null });
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
      reserved = false;
    }
    if (!reserved) {
      const [row] = await db
        .select({ status: idempotencyKeys.status, body: idempotencyKeys.body })
        .from(idempotencyKeys)
        .where(and(eq(idempotencyKeys.userId, input.userId), eq(idempotencyKeys.key, key)))
        .limit(1);
      if (!row || row.status === null || !row.body) {
        // En vol par un concurrent : 409 franc, le retry recevra le replay.
        throw new ApiError("CONFLICT", 409, "Requête en cours — réessayez dans un instant.");
      }
      return { replayed: true, status: row.status, data: row.body as T };
    }
    const fresh = await input.run();
    await db
      .update(idempotencyKeys)
      .set({ status: fresh.status, body: fresh.data })
      .where(and(eq(idempotencyKeys.userId, input.userId), eq(idempotencyKeys.key, key)));
    return { replayed: false, ...fresh };
  } catch (e) {
    if (e instanceof ApiError) throw e;
    captureError(e instanceof Error ? e : new Error(String(e)), { op: "api.idempotency" });
    const fresh = await input.run();
    return { replayed: false, ...fresh };
  }
}

/** Lit le header (insensible à la casse, `Headers` l'est déjà). */
export function idempotencyKeyFrom(req: Request): string | null {
  const v = req.headers.get("idempotency-key");
  return v && v.trim() !== "" ? v.trim() : null;
}
