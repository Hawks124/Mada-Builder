import "./_env";
import { db } from "@/db";
import { contactMessages } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import {
  contactSubjectLabel,
  listContactMessages,
  setContactStatus,
  submitContact,
} from "@/services/contact.service";
import {
  contactNotifyHtml,
  contactNotifySubject,
  contactNotifyText,
} from "@/lib/email-templates/contact-notify";

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

async function countAll(): Promise<number> {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(contactMessages);
  return row?.n ?? -1;
}

async function main(): Promise<void> {
  const before = await countAll();

  // 1. Validation (messages FR, rien créé).
  const bad = [
    await submitContact({
      name: "A",
      email: "a@x.mg",
      subject: "support",
      message: "x".repeat(50),
    }),
    await submitContact({
      name: "Aina",
      email: "pas-un-email",
      subject: "support",
      message: "x".repeat(50),
    }),
    await submitContact({
      name: "Aina",
      email: "a@x.mg",
      subject: "nope",
      message: "x".repeat(50),
    }),
    await submitContact({ name: "Aina", email: "a@x.mg", subject: "support", message: "court" }),
    await submitContact({
      name: "Aina",
      email: "a@x.mg",
      subject: "support",
      message: "x".repeat(50),
      productUrl: "ftp://x",
    }),
  ];
  check(
    "validation (5 cas rejetés, motif FR)",
    bad.every((r) => !r.ok) && bad.every((r) => !r.ok && r.message.length > 0),
  );
  check("validation : rien créé", (await countAll()) === before);

  // 2. Honeypot rempli = succès silencieux, rien créé.
  const honey = await submitContact({
    name: "Bot",
    email: "bot@x.mg",
    subject: "support",
    message: "x".repeat(50),
    company: "CryptoPromo",
  });
  check("honeypot (succès silencieux, rien créé)", honey.ok && (await countAll()) === before);

  // 3. Envoi valide → ligne `new` complète.
  const email = `verify-contact-${Date.now()}@example.com`;
  const sent = await submitContact({
    name: "Aina Vérif",
    email,
    subject: "sponsoring",
    message: "Bonjour, je veux sponsoriser la plateforme. Détails à suivre par email.",
    productUrl: "https://example.mg/produit",
  });
  check("envoi valide", sent.ok);
  const [row] = await db
    .select()
    .from(contactMessages)
    .where(eq(contactMessages.email, email))
    .limit(1);
  check(
    "ligne new complète",
    !!row &&
      row.status === "new" &&
      row.name === "Aina Vérif" &&
      row.subject === "sponsoring" &&
      row.productUrl === "https://example.mg/produit",
  );

  // 4. File staff : filtre + transitions.
  const all = await listContactMessages({ isStaff: true, status: "all" });
  check(
    "file staff (voit la ligne)",
    all.some((m) => m.id === row.id),
  );
  check(
    "file new (ligne présente)",
    (await listContactMessages({ isStaff: true, status: "new" })).some((m) => m.id === row.id),
  );
  check("transition read", await setContactStatus({ isStaff: true, id: row.id, status: "read" }));
  check(
    "transition replied",
    await setContactStatus({ isStaff: true, id: row.id, status: "replied" }),
  );
  const replied = await listContactMessages({ isStaff: true, status: "replied" });
  check(
    "file replied (ligne présente)",
    replied.some((m) => m.id === row.id),
  );
  let staffDenied = false;
  try {
    await listContactMessages({ isStaff: false });
  } catch {
    staffDenied = true;
  }
  check("file non-staff refusée", staffDenied);

  // 5. Gabarit staff (sujet + échappement XSS).
  const evil = '<script>alert("x")</script>';
  const info = {
    name: "Aina",
    email: "a@x.mg",
    subjectLabel: contactSubjectLabel("sponsoring"),
    message: evil,
    productUrl: null,
    inboxUrl: "https://x.test/admin/contact",
    origin: "https://x.test",
  };
  check(
    "gabarit (sujet + message repris + script échappé)",
    contactNotifySubject("Sponsoring", "Aina") === "Contact Sponsoring — Aina" &&
      contactNotifyHtml(info).includes("&lt;script&gt;") &&
      !contactNotifyHtml(info).includes("<script>") &&
      contactNotifyText(info).includes(evil),
  );

  // 6. Route mobile : 201 / 422 / 405.
  const { POST, GET } = await import("@/app/api/v1/contact/route");
  const okRes = await POST(
    new Request("http://x/api/v1/contact", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Mobile Vérif",
        email: `verify-contact-m-${Date.now()}@example.com`,
        subject: "partenariat",
        message: "Demande de partenariat depuis l'app mobile, avec assez de détails.",
      }),
    }),
  );
  const okBody = (await okRes.json()) as { ok: boolean; data: { sent: boolean } };
  check(
    "mobile 201 {sent:true}",
    okRes.status === 201 && okBody.ok === true && okBody.data.sent === true,
  );
  const koRes = await POST(
    new Request("http://x/api/v1/contact", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "X", email: "bad", subject: "nope", message: "court" }),
    }),
  );
  const koBody = (await koRes.json()) as { ok: boolean; code: string };
  check(
    "mobile 422 VALIDATION",
    koRes.status === 422 && koBody.ok === false && koBody.code === "VALIDATION",
  );
  check("mobile GET = 405", (await GET()).status === 405);

  // Cleanup.
  await db.delete(contactMessages).where(eq(contactMessages.email, email));
  const mobiles = await db
    .select({ id: contactMessages.id })
    .from(contactMessages)
    .where(sql`${contactMessages.email} like 'verify-contact-m-%@example.com'`);
  for (const m of mobiles) {
    await db.delete(contactMessages).where(eq(contactMessages.id, m.id));
  }
  check("cleanup (retour au compte initial)", (await countAll()) === before);

  console.log(`contact: ${pass} OK, ${fail} KO`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("verify-contact crash:", e instanceof Error ? e.message : e);
  process.exit(1);
});
