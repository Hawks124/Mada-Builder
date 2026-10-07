/**
 * Curseurs keyset (listes mobiles, Phase 6) : opaques (base64url), tolérants
 * (ordure → première page, jamais d'erreur), stables (`at` ISO + id en
 * tie-break). Offset conservé pour les pages web numérotées ; keyset pour
 * tout ce qui défile sans fin côté mobile.
 */
export function encodeKeysetCursor(payload: { at: string; id: string } | null): string | null {
  if (!payload) return null;
  return Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
}

export function decodeKeysetCursor(raw: unknown): { at: Date; id: string } | null {
  if (typeof raw !== "string" || raw.trim() === "") return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, "base64url").toString("utf-8"));
    if (typeof parsed !== "object" || parsed === null) return null;
    const { at, id } = parsed as { at?: unknown; id?: unknown };
    if (typeof at !== "string" || typeof id !== "string") return null;
    const date = new Date(at);
    if (Number.isNaN(date.getTime()) || id === "") return null;
    return { at: date, id };
  } catch {
    return null;
  }
}
