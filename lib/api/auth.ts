import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError } from "@/lib/api/response";

/**
 * Auth Bearer de l'API v1 — AUCUN import `next/*` (testable tsx pur).
 *
 * Contrat : `Authorization: Bearer <access_token>` (émis par Supabase
 * Auth — packages natifs Flutter, jamais par nous). Vérification via
 * `auth.getUser(token)` côté serveur à chaque appel (v1 : simplicité
 * et révocation immédiate ; la vérif locale JWKS est la piste d'optim
 * documentée, pas implémentée).
 *
 * Edge cases :
 * - header absent/malformé → 401 UNAUTHORIZED (jamais de redirect HTML :
 *   le proxy ne couvre pas /api/*, et les routes ne redirigent jamais) ;
 * - token expiré/invalide/révoqué → 401 UNAUTHORIZED "Session invalide ou
 *   expirée." (le client rafraîchit via supabase_flutter ; échec du
 *   refresh → écran login) ;
 * - ligne users absente (compte supprimé, race) → 401 (plus de compte,
 *   plus de session utile) ;
 * - banni → 403 BANNED + motif (pas 401 : le client affiche l'écran
 *   suspendu, pas le login). Lecture seule (`allowBanned`) pour les
 *   chemins que le web autorise aux bannis : GET /me (droit d'accès
 *   RGPD + écran suspendu), DELETE /me (suppression inaliénable),
 *   appels (seul chemin d'écriture — le service tranche).
 */
export type ApiUser = {
  id: string;
  email: string;
  bannedAt: Date | null;
  banReason: string | null;
};

export async function requireApiUser(
  req: Request,
  opts?: { allowBanned?: boolean },
): Promise<ApiUser> {
  const header = req.headers.get("authorization");
  const token =
    header && /^bearer\s+/i.test(header)
      ? header.replace(/^bearer\s+/i, "").trim()
      : null;
  if (!token) {
    throw new ApiError(
      "UNAUTHORIZED",
      401,
      "Authentification requise.",
    );
  }

  let authId: string;
  let authEmail: string | undefined;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user) throw error ?? new Error("no-user");
    authId = data.user.id;
    authEmail = data.user.email;
  } catch (e) {
    // Invité vs incident (même règle que le proxy) : 400/401/403/404 =
    // token invalide → 401 (le client rafraîchit ou se reconnecte) ;
    // panne réseau/timeout/5xx = incident → 503 (le client RETRY en
    // gardant sa session — jamais de logout sur un hoquet infra).
    const status = (e as { status?: unknown })?.status;
    if (
      typeof status === "number" &&
      (status === 400 || status === 401 || status === 403 || status === 404)
    ) {
      throw new ApiError("UNAUTHORIZED", 401, "Session invalide ou expirée.");
    }
    throw new ApiError(
      "INTERNAL",
      503,
      "Service d'authentification momentanément indisponible.",
    );
  }

  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      bannedAt: users.bannedAt,
      banReason: users.banReason,
    })
    .from(users)
    .where(eq(users.id, authId))
    .limit(1);
  // Ligne absente : compte supprimé (ou lag trigger — le client retry
  // après onboarding, même règle que le web).
  if (!row) {
    throw new ApiError("UNAUTHORIZED", 401, "Compte introuvable.");
  }

  if (row.bannedAt && !opts?.allowBanned) {
    throw new ApiError("BANNED", 403, "Compte suspendu.", {
      banReason: row.banReason,
    });
  }

  return {
    id: row.id,
    email: authEmail ?? row.email,
    bannedAt: row.bannedAt,
    banReason: row.banReason,
  };
}
