import {
  ApiError,
  apiCatch,
  apiOk,
  corsPreflight,
  iso,
  methodNotAllowed,
  readJson,
} from "@/lib/api/response";
import { apiLimit } from "@/lib/api/ratelimit";
import { db } from "@/db";
import { products } from "@/db/schema";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { getLatestApprovedBuilds } from "@/services/builds.service";

export const OPTIONS = async () => corsPreflight();
export const GET = async () => methodNotAllowed(["POST"]);
export const PATCH = async () => methodNotAllowed(["POST"]);
export const PUT = async () => methodNotAllowed(["POST"]);
export const DELETE = async () => methodNotAllowed(["POST"]);

type Installed = { productId: string; versionCode: number | null };

function parseInstalled(body: unknown): Installed[] {
  if (
    typeof body !== "object" ||
    body === null ||
    !Array.isArray((body as { installed?: unknown }).installed)
  ) {
    throw new ApiError("VALIDATION", 422, "`installed` (tableau) requis.");
  }
  const list = (body as { installed: unknown[] }).installed;
  if (list.length > 50) throw new ApiError("VALIDATION", 422, "Lot max : 50 produits.");
  return list.map((entry) => {
    if (typeof entry !== "object" || entry === null) {
      throw new ApiError("VALIDATION", 422, "Entrée `{ productId, versionCode }` invalide.");
    }
    const { productId, versionCode } = entry as { productId?: unknown; versionCode?: unknown };
    if (typeof productId !== "string" || productId.trim() === "" || productId.length > 128) {
      throw new ApiError("VALIDATION", 422, "Entrée `{ productId, versionCode }` invalide.");
    }
    if (
      versionCode !== null &&
      versionCode !== undefined &&
      (typeof versionCode !== "number" || !Number.isInteger(versionCode))
    ) {
      throw new ApiError("VALIDATION", 422, "Entrée `{ productId, versionCode }` invalide.");
    }
    return {
      productId: productId.trim().toLowerCase(),
      versionCode: typeof versionCode === "number" ? versionCode : null,
    };
  });
}

/**
 * Check-update batch natif : 1 appel pour N apps installées (au lieu d'une
 * fiche par app). Données publiques uniquement (même règle que la fiche) :
 * `updateAvailable` = build approuvé strictement plus récent que l'installé.
 * Inconnu / non publié / sans build → `latestBuild: null` (pas d'oracle).
 */
export async function POST(req: Request): Promise<Response> {
  try {
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || null;
    if (ip) {
      await apiLimit("api:updates:check", ip, { window: "60 s", max: 60 });
    }
    const body = await readJson(req);
    const installed = parseInstalled(body);
    // Slugs → UUID (publiés uniquement) ; UUID passent directs (la requête
    // batch ne voit que des UUID — jamais de cast sauvage).
    const isUuid = (v: string): boolean =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);
    const slugs = [...new Set(installed.map((i) => i.productId).filter((p) => !isUuid(p)))];
    const idBySlug = new Map<string, string>();
    if (slugs.length > 0) {
      const rows = await db
        .select({ id: products.id, slug: products.slug })
        .from(products)
        .where(
          and(
            inArray(products.slug, slugs),
            eq(products.status, "published"),
            isNull(products.deletedAt),
          ),
        );
      for (const r of rows) idBySlug.set(r.slug, r.id);
    }
    const uuids = installed.map((i) =>
      isUuid(i.productId) ? i.productId : (idBySlug.get(i.productId) ?? null),
    );
    const latest = await getLatestApprovedBuilds(uuids.filter((u): u is string => u !== null));
    return apiOk({
      updates: installed.map((entry, idx) => {
        const uuid = uuids[idx];
        const build = uuid ? (latest.get(uuid) ?? null) : null;
        const updateAvailable =
          build !== null &&
          build.versionCode !== null &&
          entry.versionCode !== null &&
          build.versionCode > entry.versionCode;
        return {
          productId: entry.productId,
          updateAvailable,
          latestBuild: build
            ? {
                versionCode: build.versionCode,
                versionName: build.versionName,
                package: build.package,
                minSdk: build.minSdk,
                sha256: build.sha256File,
                sizeBytes: build.sizeBytes,
                whatsnew: build.whatsnew,
                reviewedAt: iso(build.reviewedAt),
              }
            : null,
        };
      }),
    });
  } catch (e) {
    return apiCatch(e, "api.updates.check");
  }
}
