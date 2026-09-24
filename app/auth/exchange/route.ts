import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { authOtp } from "@/db/schema";
import { exchangeHashForSession } from "@/lib/supabase/exchange";
import { withToast } from "@/lib/toast";

/**
 * GET /auth/exchange?h=<hash>&next=… — fallback cliquable du mail OTP.
 * Contrairement à l'action_link Supabase direct, ce point de passage
 * applique NOS règles d'abord : ligne existante + non expirée + inutilisée
 * (notre TTL 10 min borne aussi le lien — fini le gap 24 h), delete-on-use,
 * puis échange server-side. Jamais de navigation navigateur vers Supabase.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const hash = searchParams.get("h") ?? "";
  const rawNext = searchParams.get("next") ?? "/dashboard";
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//")
      ? rawNext
      : "/dashboard";

  const failUrl = (reason: string) => {
    const url = new URL("/signin", origin);
    url.searchParams.set("next", next);
    url.searchParams.set("error", reason);
    return url;
  };
  const okUrl = () => {
    return new URL(
      withToast(next, "ok", "Connexion réussie. Bienvenue !"),
      origin,
    );
  };

  if (hash.trim() === "") {
    return NextResponse.redirect(failUrl("no_code"));
  }

  // Retrouve la ligne par hash (jamais loggé ni exposé) : notre TTL
  // 10 min borne aussi ce lien, contrairement à l'action_link brut.
  const [match] = await db
    .select({ id: authOtp.id, expiresAt: authOtp.expiresAt })
    .from(authOtp)
    .where(and(eq(authOtp.tokenHash, hash), isNull(authOtp.usedAt)))
    .limit(1);
  if (!match) {
    return NextResponse.redirect(failUrl("exchange_failed"));
  }
  if (match.expiresAt.getTime() <= Date.now()) {
    await db.delete(authOtp).where(eq(authOtp.id, match.id));
    return NextResponse.redirect(failUrl("exchange_failed"));
  }

  const exchanged = await exchangeHashForSession(hash);
  if (!exchanged.ok) {
    return NextResponse.redirect(failUrl("exchange_failed"));
  }
  await db.delete(authOtp).where(eq(authOtp.id, match.id));
  return NextResponse.redirect(okUrl());
}
