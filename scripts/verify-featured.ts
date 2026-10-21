import "./_env";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { classerFeatured, featuredPriorite } from "@/services/ranking.service";

/**
 * PARITÉ du produit du jour : la règle SQL (pg_cron, 00:05) et la règle
 * TypeScript (le service, chemin paresseux) doivent choisir LE MÊME
 * produit.
 *
 * POURQUOI un script dédié : c'est le sujet le plus subtil du projet
 * (deux implémentations de la même règle, dans deux langages) et le seul
 * moyen de le prouver est de les exécuter sur le MÊME état et de
 * comparer. Un check dans `verify-products-backend` noierait ça dans
 * 200 assertions sans rapport.
 *
 * Ce que ça vérifie :
 * 1. la formule de priorité (TS) : attente bornée 7 j, signal borné 7,
 *    l'attente pèse double ;
 * 2. l'équité : le moins servi passe avant ;
 * 3. le signal départage à service égal ;
 * 4. la PARITÉ : le choix SQL == le choix TS sur les données réelles.
 *
 * Usage : `npm run verify:featured`
 */

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

const JOUR = 86_400_000;
const ilYA = (j: number) => new Date(Date.now() - j * JOUR);

/** Un candidat de test (les dates sont en UTC, comme la règle SQL). */
function candidat(
  id: string,
  signal: number,
  attente: number,
  updatedAt: Date | null,
  publishedAt: Date | null,
) {
  return { id, signal, attente, updatedAt, publishedAt };
}

async function main() {
  // 1. La formule : les deux bornes + le poids de l'attente.
  const fort = candidat("fort", 50, 0, null, null);
  const ancien = candidat("ancien", 0, 400, null, null);
  check("priorité : le signal est borné", featuredPriorite(fort) < 40);
  check("priorité : l'attente est bornée", featuredPriorite(ancien) < 40);
  check(
    "priorité : l'attente pèse double sur le signal",
    featuredPriorite(candidat("a", 1, 7, ilYA(0), ilYA(0))) >
      featuredPriorite(candidat("b", 6, 0, ilYA(0), ilYA(0))),
  );

  // 2. L'équité : le moins servi passe avant (le grand écart de signal
  //    ne fait pas passer un déjà-servi devant un jamais-servi).
  const classe = classerFeatured([
    candidat("deja-servi-3x", 9, 0, ilYA(0), ilYA(0)),
    candidat("jamais-servi", 1, 5, ilYA(0), ilYA(0)),
  ]);
  check("équité : le jamais-servi passe avant", classe[0]?.id === "jamais-servi");

  // 3. Le signal départage à service égal.
  const classeSignal = classerFeatured([
    candidat("calme", 1, 3, ilYA(0), ilYA(0)),
    candidat("vif", 5, 3, ilYA(0), ilYA(0)),
  ]);
  check("signal : à service égal, le plus vif passe", classeSignal[0]?.id === "vif");

  // 4. La PARITÉ avec la fonction SQL, sur les données réelles.
  //    On rejoue la règle SQL dans une requête (sans écrire la ligne du
  //    jour) et on compare avec le choix du service TypeScript.
  const rows = await db.execute(sql`
    WITH candidats AS (
      SELECT p.id,
             p.published_at,
             p.updated_at,
             LEAST(7, COALESCE(
               (CURRENT_DATE - MAX(f.featured_on))::int,
               (CURRENT_DATE - p.published_at::date)::int
             )) AS attente,
             LEAST(7,
               COALESCE(p.ratings_sum::numeric / NULLIF(p.ratings_count, 0), 0)
               + COALESCE((SELECT SUM(v.weight)::numeric FROM public.votes v
                            WHERE v.product_id = p.id AND v.created_at >= now() - INTERVAL '7 days'), 0)
               + 2 * (SELECT COUNT(*)::numeric FROM public.comments c
                        WHERE c.product_id = p.id AND c.created_at >= now() - INTERVAL '7 days')
               + 3 * (SELECT COUNT(*)::numeric FROM public.reviews r
                        WHERE r.product_id = p.id AND r.created_at >= now() - INTERVAL '7 days')
             ) AS signal
        FROM public.products p
        LEFT JOIN public.featured_products f ON f.product_id = p.id
       WHERE p.status = 'published' AND p.deleted_at IS NULL AND p.curated = false
       GROUP BY p.id
    )
    SELECT c.id::text AS id,
           (LEAST(7, c.signal) + 2 * c.attente) AS priorite
      FROM candidats c
     ORDER BY LEAST(7, c.signal) + 2 * c.attente DESC,
              c.updated_at DESC,
              c.published_at DESC,
              c.id ASC
     LIMIT 1
  `);
  const choisiSql = (rows as unknown as { id: string; priorite: number }[])[0];

  // Le même calcul, en TypeScript, sur les mêmes données.
  const data = await db.execute(sql`
    SELECT p.id::text AS id,
           p.published_at,
           p.updated_at,
           p.ratings_sum::int AS ratings_sum,
           p.ratings_count::int AS ratings_count,
           (SELECT COALESCE(SUM(v.weight), 0)::int FROM public.votes v
             WHERE v.product_id = p.id AND v.created_at >= now() - INTERVAL '7 days') AS votes7,
           (SELECT COUNT(*)::int FROM public.comments c
             WHERE c.product_id = p.id AND c.created_at >= now() - INTERVAL '7 days') AS comm7,
           (SELECT COUNT(*)::int FROM public.reviews r
             WHERE r.product_id = p.id AND r.created_at >= now() - INTERVAL '7 days') AS avis7,
           (SELECT MAX(f.featured_on)::text FROM public.featured_products f
             WHERE f.product_id = p.id) AS dernier
      FROM public.products p
     WHERE p.status = 'published' AND p.deleted_at IS NULL AND p.curated = false
  `);
  const lignes = data as unknown as {
    id: string;
    published_at: Date;
    updated_at: Date;
    ratings_sum: number;
    ratings_count: number;
    votes7: number;
    comm7: number;
    avis7: number;
    dernier: string | null;
  }[];
  const aujourdhui = (now: Date) => now.toISOString().slice(0, 10);
  const joursDepuis = (iso: string | null, fallback: Date) => {
    if (!iso) return Math.floor((Date.now() - fallback.getTime()) / JOUR);
    return Math.max(0, Math.floor((Date.now() - Date.parse(`${iso}T00:00:00Z`)) / JOUR));
  };
  const candidatsTs = lignes.map((l) => {
    const reference = l.dernier ?? aujourdhui(l.published_at);
    const attente = Math.min(joursDepuis(l.dernier, l.published_at), 7);
    const note = l.ratings_count > 0 ? l.ratings_sum / l.ratings_count : 0;
    const signal = note + l.votes7 + 2 * l.comm7 + 3 * l.avis7;
    return {
      id: l.id,
      signal,
      attente,
      updatedAt: l.updated_at,
      publishedAt: l.published_at,
      reference,
    };
  });
  const choisiTs = classerFeatured(candidatsTs)[0];
  check(
    "parité : le service TypeScript et la règle SQL choisissent le même produit",
    choisiSql !== undefined && choisiTs !== undefined && choisiSql.id === choisiTs.id,
  );
  if (choisiSql && choisiTs && choisiSql.id !== choisiTs.id) {
    console.error(
      `   SQL : ${choisiSql.id} (priorité ${choisiSql.priorite}) · TS : ${choisiTs.id} (priorité ${featuredPriorite(choisiTs)})`,
    );
  }
  check(
    "priorité : la même valeur des deux côtés",
    choisiSql !== undefined &&
      choisiTs !== undefined &&
      Math.abs(Number(choisiSql.priorite) - featuredPriorite(choisiTs)) < 0.001,
  );

  console.log(`verify:featured — ${pass} OK, ${fail} KO`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("verify:featured crash:", e);
  process.exit(1);
});
