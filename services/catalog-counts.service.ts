import { and, eq, isNull, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { products } from "@/db/schema";

/**
 * Compteurs RÉELS des produits publiés, par axe de taxonomie.
 *
 * Avant, la page `/categories` affichait les compteurs codés en dur dans
 * les configs (`count: 78` pour SaaS…) et leur somme : « 691 produits »
 * alors que la base en compte 11. C'était un mock : la page mentait sur
 * la taille du catalogue — et le pied de page avait déjà tranché le
 * débat (« les compteurs sont bas et décourageants » → on neles montre
 * pas). Ici on les COMPTE, et la page assume la vérité.
 *
 * Une requête par axe (5 axes) : chacune compte les produits publiés.
 * Le résultat est un `Map` d'id → nombre ; les entrées sans produit
 * published sont masquées à l'affichage (une catégorie vide n'est pas
 * une catégorie).
 */
export type RealCounts = {
  /** Catégorie primaire → nombre de produits publiés. */
  byCategory: Map<string, number>;
  /** Type de produit → nombre. */
  byType: Map<string, number>;
  /** Plateforme → nombre (un produit peut viser plusieurs plateformes). */
  byPlatform: Map<string, number>;
  /** Modèle économique → nombre. */
  byPricing: Map<string, number>;
  /** Avancement → nombre. */
  byLifecycle: Map<string, number>;
  /** Âge → nombre. */
  byAudience: Map<string, number>;
  /** Total des produits publiés. */
  total: number;
};

async function compter(colonne: AnyPgColumn): Promise<Map<string, number>> {
  const rows = await db
    .select({ cle: sql<string>`${colonne}`.as("cle"), n: sql<number>`count(*)::int` })
    .from(products)
    .where(and(eq(products.status, "published"), isNull(products.deletedAt)))
    .groupBy(colonne);
  return new Map(rows.map((r) => [String(r.cle), Number(r.n)]));
}

/** Plateformes : un produit peut en viser plusieurs → `unnest`. */
async function compterPlateformes(): Promise<Map<string, number>> {
  const rows = await db
    .select({ cle: sql<string>`unnest(${products.platforms})`, n: sql<number>`count(*)::int` })
    .from(products)
    .where(and(eq(products.status, "published"), isNull(products.deletedAt)))
    .groupBy(sql`unnest(${products.platforms})`);
  return new Map(rows.map((r) => [String(r.cle), Number(r.n)]));
}

/**
 * Compteur par CATÉGORIE — TOUTES les catégories d'un produit (pas
 * seulement la principale).
 *
 * Règle : le compteur doit annoncer ce que la page va montrer. Or la
 * page `/categories/[slug]` liste les produits dont le tableau
 * `categories` CONTIENT le slug (comme le filtre du flux) → un produit
 * à 3 catégories appartient à 3 pages. Compter seulement la principale
 * promettait « 1 produit » sur une page qui en liste 7.
 *
 * Le tableau `categories` contient toujours la principale en première
 * position (le service de création l'impose : `category = categories[0]`)
 * → aucun produit ne perd sa propre catégorie.
 *
 * Conséquence : la SOMME des compteurs dépasse le nombre de produits
 * (un produit à 3 catégories compte 3 fois). C'est le comportement d'une
 * taxonomie à facettes, et c'est pourquoi le total affiché reste le
 * nombre DISTINCT de produits publiés, jamais la somme.
 */
export async function countPublishedByCategory(): Promise<Map<string, number>> {
  const rows = (await db.execute(sql`
    select c as cle, count(*)::int n
    from products p, unnest(p.categories) c
    where p.status = 'published' and p.deleted_at is null
    group by c
  `)) as unknown as { cle: string; n: number }[];
  return new Map(rows.map((r) => [String(r.cle), Number(r.n)]));
}

export async function getRealCounts(): Promise<RealCounts | null> {
  try {
    const [byCategory, byType, byPlatform, byPricing, byLifecycle, byAudience, totalRow] =
      await Promise.all([
        countPublishedByCategory(),
        compter(products.productType),
        compterPlateformes(),
        compter(products.pricingModel),
        compter(products.lifecycle),
        compter(products.audience),
        db
          .select({ n: sql<number>`count(*)::int` })
          .from(products)
          .where(and(eq(products.status, "published"), isNull(products.deletedAt))),
      ]);
    return {
      byCategory,
      byType,
      byPlatform,
      byPricing,
      byLifecycle,
      byAudience,
      total: Number(totalRow[0]?.n ?? 0),
    };
  } catch {
    // Incident DB : on ne renvoie PAS de zéros (la page masquerait alors
    // toutes les catégories au lieu d'afficher les compteurs de repli) —
    // `null` signale « compteurs indisponibles ».
    return null;
  }
}
