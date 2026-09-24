// Suite de vérification backend profil — REQUIERT DATABASE_URL pooler
// (IPv4) + clés service_role. Nettoie ses propres données de test.
// Usage: npm run db:setup (une fois) puis npx tsx scripts/verify-profile-backend.ts
import "./_env";
import { createClient } from "@supabase/supabase-js";
import { eq, like } from "drizzle-orm";
import {
  buildUsernameCandidate,
  fetchUserProfile,
  usernameSchema,
} from "../services/users.service";
import { db } from "../db";
import { users } from "../db/schema";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean) {
  console.log(`${cond ? "PASS" : "FAIL"} — ${name}`);
  if (cond) pass++;
  else {
    fail++;
    process.exitCode = 1;
  }
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
    throw new Error("Env Supabase incomplet (.env.local, voir STACK.md).");
  }
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });
  const anon = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
  });
  const createdIds: string[] = [];
  const testTag = `verify-${Date.now()}`;

  // 1. Trigger : création via Auth Admin API → ligne public.users + slug.
  const email1 = `${testTag}-1@mail.com`;
  const { data: u1, error: e1 } = await admin.auth.admin.createUser({
    email: email1,
    email_confirm: true,
    user_metadata: { display_name: "Vérif Testeur" },
  });
  if (e1) throw new Error(`createUser: ${e1.message}`);
  createdIds.push(u1.user.id);
  const row1 = await db.select().from(users).where(eqId(u1.user.id));
  check("trigger crée public.users", row1.length === 1);
  check("username slugifié", row1[0]?.username.startsWith("verif-testeur") ?? false);
  check("role défaut user", row1[0]?.role === "user");
  check("email stocké", row1[0]?.email === email1);

  // 2. Collision username → suffixe -1.
  const email2 = `${testTag}-2@mail.com`;
  const { data: u2, error: e2 } = await admin.auth.admin.createUser({
    email: email2,
    email_confirm: true,
    user_metadata: { display_name: "Vérif Testeur" },
  });
  if (e2) throw new Error(`createUser#2: ${e2.message}`);
  createdIds.push(u2.user.id);
  const row2 = await db.select().from(users).where(eqId(u2.user.id));
  check("collision → suffixe", (row2[0]?.username ?? "").match(/verif-testeur-\d+$/) !== null);

  // 3. Lecture publique : allowlist (email ABSENT du payload).
  // NOTE : fetchUserProfile (pur) — getUserProfile (caché Next) en app.
  const pub = await fetchUserProfile(row1[0].username);
  check("profil public lu", pub?.username === row1[0].username);
  check("email jamais exposé", pub !== null && !("email" in (pub as object)));

  // 4. RLS négatif : anon ne peut ni insérer ni modifier.
  const anonInsert = await anon.from("users").insert({
    username: `${testTag}-evil`,
    display_name: "Evil",
    email: `${testTag}-evil@mail.com`,
  });
  check("anon INSERT refusé", anonInsert.error !== null);
  // NOTE RLS : un UPDATE filtré par USING renvoie 200 + 0 ligne, PAS
  // d'erreur (comportement PostgREST). Le test correct : relire et vérifier
  // que rien n'a bougé.
  await anon.from("users").update({ bio: "hack" }).eq("id", u1.user.id);
  const afterHack = await db.select().from(users).where(eqId(u1.user.id));
  check("anon UPDATE sans effet", (afterHack[0] as { bio: string | null }).bio !== "hack");

  // 5. Storage avatars : upload service_role, lecture publique, refus anon.
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  );
  const testPath = `${u1.user.id}/verify-${Date.now()}.png`;
  const up = await admin.storage.from("avatars").upload(testPath, png, {
    contentType: "image/png",
  });
  check("upload bucket avatars", !up.error);
  const { data: pub1 } = admin.storage.from("avatars").getPublicUrl(testPath);
  check("URL publique générée", pub1.publicUrl.includes("/avatars/"));
  const anonWrite = await anon.storage
    .from("avatars")
    .upload(`${testTag}-evil.png`, png, { contentType: "image/png" });
  check("anon WRITE refusé", anonWrite.error !== null);
  await admin.storage.from("avatars").remove([testPath]);

  // 6. RLS cross-user : un authentifié ne lit QUE sa ligne.
  // (magiclink → session → client authentifié → SELECT users.)
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: email1,
  });
  if (linkError || !linkData.properties?.email_otp) {
    throw new Error("generateLink a échoué.");
  }
  const { data: sessionData, error: otpError } = await anon.auth.verifyOtp({
    email: email1,
    token: linkData.properties.email_otp,
    type: "email",
  });
  if (otpError || !sessionData.session) {
    throw new Error(`verifyOtp a échoué : ${otpError?.message}`);
  }
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${sessionData.session.access_token}`,
      },
    },
  });
  // NOTE : own-row lit TOUTES les colonnes (y compris son email) — c'est
  // pourquoi le SERVICE n'expose qu'une allowlist (test §3). Ici on vérifie
  // l'isolation des lignes : soi visible, autrui invisible.
  const crossRead = await userClient.from("users").select("id");
  const seesOnlySelf =
    crossRead.error === null && crossRead.data.length === 1 && crossRead.data[0].id === u1.user.id;
  check("authentifié ne voit que sa ligne", seesOnlySelf);
  const seesOther = (crossRead.data ?? []).some((r) => r.id === u2.user.id);
  check("autre user invisible", !seesOther);

  // 7. Règles username (pures, sans DB).
  check("username valide", usernameSchema.safeParse("kaliana-r").success);
  // Les majuscules sont NORMALISÉES (pas rejetées) : meilleure UX, même
  // sécurité (valeur stockée toujours minuscule).
  const upper = usernameSchema.safeParse("Kaliana");
  check("username majuscules normalisées", upper.success && upper.data === "kaliana");
  check("username réservé rejeté", !usernameSchema.safeParse("admin").success);
  check(
    "candidat slugifié (20 chars max)",
    buildUsernameCandidate("Andry Rakoto Ramarolahy", "x@y.z") === "andry-rakoto-ramarol",
  );

  // 7. Nettoyage — aucune trace de test.
  for (const id of createdIds) {
    await admin.auth.admin.deleteUser(id);
    await db.delete(users).where(eqId(id));
  }
  const leftovers = await db.select({ id: users.id }).from(users).where(likeEmail(testTag));
  check("nettoyage complet", leftovers.length === 0);

  console.log(`\n${pass} pass, ${fail} fail.`);

  // Ferme le pool Drizzle — sinon le process ne termine jamais
  // et la sortie pipée est perdue (stdout pipe = bufferisé).
  const client = db as unknown as { $client: { end(): Promise<void> } };
  await client.$client.end();
  process.exitCode = fail > 0 ? 1 : 0;
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exitCode = 1;
});

// Helpers typés Drizzle.
function eqId(id: string) {
  return eq(users.id, id);
}
function likeEmail(tag: string) {
  return like(users.email, `%${tag}%`);
}
