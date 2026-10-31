import { ApiError } from "@/lib/api/response";

/**
 * Garde commun des routes cron (`/api/cron/*`) : Bearer `CRON_SECRET`
 * strict, sans repli. Sans secret configuré → 503 franche (fail closed —
 * jamais de job sans garde, pattern des deux routes historiques).
 */
export function checkCron(req: Request): void {
  const expected = (process.env.CRON_SECRET ?? "").trim();
  if (expected === "") throw new ApiError("INTERNAL", 503, "Cron non configuré.");
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${expected}`) throw new ApiError("FORBIDDEN", 403, "Interdit.");
}
