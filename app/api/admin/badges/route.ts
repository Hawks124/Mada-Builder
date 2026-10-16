import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getViewer } from "@/lib/supabase/server";
import { ApiError, CACHE_PRIVATE, apiCatch, apiError, apiOk, withCache } from "@/lib/api/response";
import { getPendingCountCached, getRejectedCountCached } from "@/services/stats.service";
import { getBuildStats } from "@/services/builds.service";
import { countNewContactMessages } from "@/services/contact.service";

export const dynamic = "force-dynamic";

export type BadgeKey = "pending" | "rejected" | "builds" | "contact";
export type BadgeState = { value: number; ok: boolean; at: number };
export type BadgesResponse = Record<BadgeKey, BadgeState>;

const ALL_KEYS: BadgeKey[] = ["pending", "rejected", "builds", "contact"];

const COUNTERS: Record<BadgeKey, () => Promise<number>> = {
  pending: () => getPendingCountCached(),
  rejected: () => getRejectedCountCached(),
  builds: () => getBuildStats().then((s) => s.pending),
  contact: () => countNewContactMessages(),
};

/**
 * Agrégation pure (testée) : chaque clé converge ou échoue SEULE.
 * `ok: false` = inconnu (jamais 0) ; `at` = âge du chiffre, pour que
 * l'UI ne montre jamais un nombre sans savoir de quand il date.
 */
export function collectBadges(
  settled: Partial<Record<BadgeKey, PromiseSettledResult<number>>>,
  now: number = Date.now(),
): Partial<Record<BadgeKey, BadgeState>> {
  const out: Partial<Record<BadgeKey, BadgeState>> = {};
  for (const key of ALL_KEYS) {
    const r = settled[key];
    if (!r) continue;
    out[key] =
      r.status === "fulfilled" && Number.isFinite(r.value) && r.value >= 0
        ? { value: Math.floor(r.value), ok: true, at: now }
        : { value: 0, ok: false, at: now };
  }
  return out;
}

/**
 * Pastilles admin (cockpit) : batché, indépendant par clé. Le shell les
 * charge en lazy après mount — une stat lente/morte ne retient ni les
 * autres clés ni la page. `?keys=pending,contact` = retry ciblé (on ne
 * re-paie pas les réussis). Staff seul (401/403 JSON, jamais de
 * redirect en API). Privé, jamais caché en partagé.
 */
export async function GET(req: Request): Promise<Response> {
  try {
    const viewer = await getViewer().catch(() => ({ status: "error" as const }));
    if (viewer.status !== "authed") {
      return apiError("UNAUTHORIZED", "Connexion requise.", 401);
    }
    const [row] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, viewer.user.id))
      .limit(1)
      .catch(() => []);
    if (!row || (row.role !== "admin" && row.role !== "moderateur")) {
      return apiError("FORBIDDEN", "Réservé à l'équipe.", 403);
    }
    const sp = new URL(req.url).searchParams;
    const wanted = (sp.get("keys") ?? "")
      .split(",")
      .map((k) => k.trim())
      .filter((k): k is BadgeKey => (ALL_KEYS as string[]).includes(k));
    const keys = wanted.length > 0 ? wanted : ALL_KEYS;
    const settled = await Promise.all(
      keys.map(async (key) => {
        try {
          return { key, result: { status: "fulfilled", value: await COUNTERS[key]() } } as const;
        } catch {
          return { key, result: { status: "rejected", reason: null } } as const;
        }
      }),
    );
    const partial: Partial<Record<BadgeKey, PromiseSettledResult<number>>> = {};
    for (const s of settled) partial[s.key] = s.result;
    const data = collectBadges(partial) as BadgesResponse;
    return withCache(apiOk(data), CACHE_PRIVATE);
  } catch (e) {
    return apiCatch(e, "api.admin.badges");
  }
}

export async function POST(): Promise<Response> {
  return apiCatch(new ApiError("METHOD_NOT_ALLOWED", 405, "GET uniquement."), "api.admin.badges");
}
export async function PATCH(): Promise<Response> {
  return apiCatch(new ApiError("METHOD_NOT_ALLOWED", 405, "GET uniquement."), "api.admin.badges");
}
export async function PUT(): Promise<Response> {
  return apiCatch(new ApiError("METHOD_NOT_ALLOWED", 405, "GET uniquement."), "api.admin.badges");
}
export async function DELETE(): Promise<Response> {
  return apiCatch(new ApiError("METHOD_NOT_ALLOWED", 405, "GET uniquement."), "api.admin.badges");
}
