// Seed DEV : catalogue mock → base locale (données FAUSSES pour tester
// les vraies requêtes SQL : leaderboard, recherche, fiche). ATTRIBUTION :
// compte seed "Équipe Mada-Made" — jamais un vrai maker.
// REFUS EN PROD sans `--prod --i-know` (jamais de fausses données
// publiques — le seeding prod est manuel et curaté, voir docs/plans).
// Idempotent par slug (`seed-<id>`). Usage: npx tsx scripts/seed-products.ts
import "./_env";
import { db } from "@/db";
import { products, users } from "@/db/schema";
import { getCatalog } from "@/services/catalog-mock.service";
import { PRODUCT_TYPES } from "@/config/product-types";
import { PRICING_MODELS } from "@/config/pricing";
import type { NewProduct } from "@/db/schema";
import { createAdminClient } from "@/lib/supabase/admin";
import { eq } from "drizzle-orm";

const SEED_EMAIL = "equipe@mada-made.mg";
const TAKE = Number(process.env.SEED_TAKE ?? 40);

function slugify(name: string, id: string): string {
  const base =
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "produit";
  return `seed-${base}-${id.slice(0, 8)}`;
}

async function main(): Promise<void> {
  const prod = process.argv.includes("--prod");
  if ((process.env.VERCEL ?? "") !== "" || prod) {
    if (!(prod && process.argv.includes("--i-know"))) {
      throw new Error("Seed interdit en prod sans --prod --i-know (données fausses).");
    }
  }
  const [maker] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, SEED_EMAIL))
    .limit(1);
  let makerId = maker?.id;
  if (!makerId) {
    // Compte seed inexistant : création Admin (confirmé, sans invitation —
    // le trigger crée la ligne users). Dev uniquement, comme le reste.
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email: SEED_EMAIL,
      email_confirm: true,
      user_metadata: { display_name: "Équipe Mada-Made" },
    });
    if (error || !data.user) {
      throw new Error(`Compte seed incréable : ${error?.message ?? "inconnu"}`);
    }
    makerId = data.user.id;
  }
  const catalog = getCatalog().slice(0, TAKE);
  const typeByLabel = new Map(PRODUCT_TYPES.map((t) => [t.label.toLowerCase(), t.id]));
  const pricingByLabel = new Map(PRICING_MODELS.map((p) => [p.label.toLowerCase(), p.id]));
  // La config est la source (l'enum DB la suit) : un seul cast documenté.
  const validTypes = new Set<string>(PRODUCT_TYPES.map((t) => t.id));
  const validPricing = new Set<string>(PRICING_MODELS.map((p) => p.id));
  const asProductType = (id: string): NewProduct["productType"] =>
    (validTypes.has(id) ? id : "other") as NewProduct["productType"];
  const asPricing = (id: string): NewProduct["pricingModel"] =>
    (validPricing.has(id) ? id : "free") as NewProduct["pricingModel"];
  // Orientation pilotée par le type (même règle que le submit) : seed
  // réaliste, jamais de fiche mixte.
  const orientationByType = new Map(PRODUCT_TYPES.map((t) => [t.id, t.orientation]));
  const asGalleryOrientation = (typeId: string): "portrait" | "landscape" => {
    const o = orientationByType.get(typeId);
    return o === "portrait" ? "portrait" : "landscape";
  };
  let inserted = 0;
  for (const item of catalog) {
    const slug = slugify(item.name, item.id);
    const existing = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.slug, slug))
      .limit(1);
    if (existing.length > 0) continue;
    const typeId = asProductType(typeByLabel.get(item.productType.toLowerCase()) ?? "other");
    await db.insert(products).values({
      slug,
      makerId,
      name: item.name,
      tagline: item.tagline.slice(0, 100),
      description: item.description ?? item.tagline,
      category: item.categoryId,
      platforms: item.platforms,
      links: { website: `https://example.com/${slug}` },
      productType: typeId,
      pricingModel: asPricing(pricingByLabel.get(item.pricing.toLowerCase()) ?? "free"),
      galleryOrientation: asGalleryOrientation(typeId ?? "other"),
      status: "published",
      // Compteurs à zéro (Phase 3) : le signal est 100 % réel dès le
      // premier vote (recount en transaction). Jamais de faux chiffres.
      upvoteCount: 0,
      publishedAt: new Date(),
    });
    inserted++;
  }
  console.log(`seed: ${inserted} produits (sur ${catalog.length}), maker ${SEED_EMAIL}`);
}

main().catch((e) => {
  console.error("seed-products:", e instanceof Error ? e.message : e);
  process.exit(1);
});
