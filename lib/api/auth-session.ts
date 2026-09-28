import { headers } from "next/headers";
import { ApiError } from "@/lib/api/response";
import { requireApiUser, type ApiUser } from "@/lib/api/auth";
import { getSessionUser } from "@/lib/supabase/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Auth double voie (web uniquement) : Bearer d'abord (mobile, inchangé),
 * sinon session cookie Supabase (formulaires web — le navigateur n'envoie
 * pas de Bearer). La voie cookie exige une origine same-origin (Origin,
 * sinon Referer) : sans elle, pas de session (anti-CSRF du chemin cookie
 * — le Bearer, lui, n'en a pas besoin).
 * AUCUNE voie = 401 (jamais de redirect : le proxy ne couvre pas /api/*).
 * Testable : la voie Bearer reste dans lib/api/auth (tsx pur) ; ici seul
 * le repli cookie touche next/headers (couvert par e2e, pas par unit).
 */
export async function requireApiUserOrSession(
  req: Request,
  opts?: { allowBanned?: boolean },
): Promise<ApiUser> {
  if (req.headers.get("authorization")) {
    return requireApiUser(req, opts);
  }

  const host = req.headers.get("x-forwarded-host") ?? new URL(req.url).host;
  const origin = req.headers.get("origin") ?? req.headers.get("referer");
  if (origin) {
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      throw new ApiError("UNAUTHORIZED", 401, "Origine illisible.");
    }
    if (originHost !== host) {
      throw new ApiError("UNAUTHORIZED", 401, "Origine non autorisée.");
    }
  } else {
    // Pas d'origine (curl, scripts) sans Bearer : pas de session.
    throw new ApiError("UNAUTHORIZED", 401, "Authentification requise.");
  }

  // Headers consommés explicitement (next/headers) pour la session cookie.
  await headers();
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    throw new ApiError("UNAUTHORIZED", 401, "Session invalide ou expirée.");
  }
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      bannedAt: users.bannedAt,
      banReason: users.banReason,
    })
    .from(users)
    .where(eq(users.id, sessionUser.id))
    .limit(1);
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
    email: sessionUser.email ?? row.email,
    bannedAt: row.bannedAt,
    banReason: row.banReason,
  };
}
