import "./_env";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, ilike } from "drizzle-orm";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteAccount } from "@/services/users.service";
import { requestEmailCode } from "@/services/otp.service";
import { siteUrl } from "@/lib/site-url";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    pass++;
  } else {
    fail++;
    console.error(`FAIL: ${name}`);
  }
}

// Emails FIXES (jamais de Date.now() : un identifiant unique par run rend
// les résidus de crash irrattrapables — c'est comme ça que des comptes
// factices ont pollué la DB). Purge AVANT + APRÈS + purge du préfixe en
// début de run : idempotent, zéro résidu même en cas de crash.
// Note : 60 s minimum entre deux runs (throttle OTP par email).
const EMAIL = "verify-otp-mobile@example.com";
const EMAIL_2 = "verify-otp-mobile-b@example.com";

async function purgeOne(email: string): Promise<void> {
  const [stale] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (stale) await deleteAccount(stale.id, stale.id);
  try {
    const admin = createAdminClient();
    const listed = await admin.auth.admin.listUsers({ perPage: 100 });
    const ghost = listed.data.users.find((u) => u.email?.toLowerCase() === email);
    if (ghost) await admin.auth.admin.deleteUser(ghost.id);
  } catch {
    // best-effort
  }
}

async function purge(): Promise<void> {
  // Résidus historiques (emails timestampés d'anciennes versions) : balayés
  // à chaque run pour ne jamais laisser de trace.
  const legacy = await db
    .select({ email: users.email })
    .from(users)
    .where(ilike(users.email, "verify-otp-mobile%@example.com"));
  for (const row of legacy) {
    if (row.email !== EMAIL && row.email !== EMAIL_2) await purgeOne(row.email);
  }
  await purgeOne(EMAIL);
  await purgeOne(EMAIL_2);
}

async function main(): Promise<void> {
  await purge();
  const { POST: requestRoute } = await import("@/app/api/v1/auth/otp/request/route");
  const { POST: verifyRoute } = await import("@/app/api/v1/auth/otp/verify/route");
  const req = (body: unknown): Request =>
    new Request("http://localhost/api/v1/auth/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  // 1. Email invalide → 422 sans envoi (route request, zéro Resend).
  const bad = await requestRoute(
    new Request("http://localhost/api/v1/auth/otp/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "pas-un-email" }),
    }),
  );
  check("email invalide → 422", bad.status === 422);

  // 2. Code via service (pas d'email), échange via route → session JSON.
  const redirectTo = `${siteUrl()}/auth/callback?next=${encodeURIComponent("/")}`;
  const issued = await requestEmailCode({ email: EMAIL, redirectTo });
  check("code émis (service)", issued.code.length === 6);
  const okRes = await verifyRoute(req({ email: EMAIL, code: issued.code }));
  const okBody = (await okRes.json().catch(() => null)) as {
    ok?: boolean;
    data?: { access_token?: string; refresh_token?: string; user?: { id?: string } };
  } | null;
  check(
    "échange → session JSON",
    okRes.status === 200 &&
      okBody?.ok === true &&
      typeof okBody.data?.access_token === "string" &&
      typeof okBody.data?.refresh_token === "string" &&
      typeof okBody.data?.user?.id === "string",
  );

  // 3. Rejeu du même code → 422 générique (single-use).
  const replay = await verifyRoute(req({ email: EMAIL, code: issued.code }));
  const replayBody = (await replay.json().catch(() => null)) as { message?: string } | null;
  check(
    "rejeu refusé (générique)",
    replay.status === 422 && replayBody?.message === "Code incorrect ou expiré.",
  );

  // 4. Faux code → 422 générique (anti-oracle). Email distinct (throttle).
  const issued2 = await requestEmailCode({ email: EMAIL_2, redirectTo });
  void issued2;
  const wrong = await verifyRoute(req({ email: EMAIL_2, code: "000000" }));
  const wrongBody = (await wrong.json().catch(() => null)) as { message?: string } | null;
  check(
    "faux code → générique",
    wrong.status === 422 && wrongBody?.message === "Code incorrect ou expiré.",
  );

  await purge();
  console.log(`otp-mobile: ${pass} OK, ${fail} KO`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("verify-otp-mobile crash:", e instanceof Error ? e.message : e);
  process.exit(1);
});
