import "./_env";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

const CLAUSE =
  "Compte de curation tenu par l'équipe — logiciels open source INTERNATIONAUX : " +
  "ni créés par des devs malgaches, ni affiliés à Mada-Made. " +
  "Descriptions traduites en français à titre informatif ; auteurs, dépôts et " +
  "licences d'origine liés sur chaque fiche. Produits hors classement.";

async function main(): Promise<void> {
  const [row] = await db
    .select({ id: users.id, username: users.username, role: users.role })
    .from(users)
    .where(eq(users.username, "open-sources"))
    .limit(1);
  if (!row) {
    console.log("SKIP: compte open-sources introuvable.");
    return;
  }
  console.log(`avant: role=${row.role}`);
  // Demote (un compte utilitaire ne modère pas) + clause (la bio porte
  // le message ; l'occupation reste "maker", vocabulaire partagé).
  // + SYNC MIROIR JWT obligatoire (sans elle, le vieux JWT garde l'ancien
  // rôle et le layout laisse entrer — faille réelle vue oct. 2026).
  await db.update(users).set({ role: "user", bio: CLAUSE }).where(eq(users.id, row.id));
  const { syncRoleMirror } = await import("@/services/users.service");
  await syncRoleMirror(row.id, "user");
  console.log("miroir JWT: user");
  const [after] = await db
    .select({ role: users.role, bio: users.bio })
    .from(users)
    .where(eq(users.id, row.id))
    .limit(1);
  console.log(`après: role=${after?.role}`);
  console.log(`bio: ${(after?.bio ?? "").slice(0, 80)}…`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
