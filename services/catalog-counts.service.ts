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

export async function getRealCounts(): Promise<RealCounts | null> {
  try {
    const [byCategory, byType, byPlatform, byPricing, byLifecycle, byAudience, totalRow] =
      await Promise.all([
        compter(products.category),
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
