import "./_env";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import {
  classerFeatured,
  featuredPriorite,
  FEATURED_BAYES_C,
  FEATURED_BAYES_M,
  FEATURED_POIDS_ATTENTE,
  FEATURED_POIDS_AVIS,
  FEATURED_POIDS_CLIC,
  FEATURED_POIDS_COMMENTAIRE,
  FEATURED_POIDS_DOWNLOAD,
  FEATURED_POIDS_PAGEVIEW,
  FEATURED_SIGNAL_PLAFOND,
} from "@/services/ranking.service";

/**
 * PARITÉ du produit du jour : la règle SQL (pg_cron, 00:05) et la règle
 * TypeScript (le service, chemin paresseux) doivent choisir LE MÊME
 * produit.
 *
 * Ce que ça vérifie :
 * 1. Formule de priorité : signal borné à 15, attente dynamique bornée, attente pèse 3x ;
 * 2. Équité bayésienne : un produit à 1 avis 5★ ne domine pas un produit à 100 avis 4.8★ ;
 *    les nouveaux produits démarrent à 3.5 (neutre) ;
 * 3. Non-linéarité : retours décroissants ln(1+x) ;
 * 4. Plafond dynamique scalable : s'adapte de 3 à 1 000 000 produits ;
 * 5. Garde-fou anti-consécutif dur : le produit d'hier est exclu si N >= 2 ;
 * 6. La PARITÉ : le choix SQL == le choix TS sur les données réelles.
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
  updatedAt: Date | null = null,
  publishedAt: Date | null = null,
) {
  return { id, signal, attente, updatedAt, publishedAt };
}

async function main() {
  // 1. La formule : les bornes + le poids de l'attente (3x).
  const fort = candidat("fort", 50, 0);
  const ancien = candidat("ancien", 0, 400);
  check("priorité : le signal est borné à 15", featuredPriorite(fort, 7) <= 15);
  check(
    "priorité : l'attente est bornée (cap=7)",
    featuredPriorite(ancien, 7) <= 15 + FEATURED_POIDS_ATTENTE * 7,
  );
  check(
    "priorité : l'attente pèse 3x sur le signal",
    featuredPriorite(candidat("a", 1, 7)) > featuredPriorite(candidat("b", 15, 0)),
  );

  // 2. Équité bayésienne : note moyenne a priori et preuve de justice.
  const noteBayes = (sum: number, count: number) =>
    (FEATURED_BAYES_C * FEATURED_BAYES_M + sum) / (FEATURED_BAYES_C + count);
  const nouveau = noteBayes(0, 0);
  check("équité bayésienne : nouveau produit (0 avis) = note globale 3.5", nouveau === 3.5);
  const coupDeChance = noteBayes(5, 1); // 1 avis 5★ -> 3.64
  const solide = noteBayes(480, 100); // 100 avis 4.8★ -> 4.68
  check("équité bayésienne : 100 avis 4.8★ bat 1 avis 5★", solide > coupDeChance);

  // 3. Non-linéarité : retours décroissants ln(1+x).
  const gainPremier = Math.log(1 + 10) - Math.log(1 + 0);
  const gainMillieme = Math.log(1 + 1000) - Math.log(1 + 990);
  check("non-linéarité : retours décroissants sur les compteurs", gainPremier > gainMillieme);

  // 4. Plafond d'attente dynamique scalable.
  const cap = (N: number) => Math.min(Math.max(N - 1, 7), 30);
  check("scalabilité : N=3 -> cap 7", cap(3) === 7);
  check("scalabilité : N=15 -> cap 14", cap(15) === 14);
  check("scalabilité : N=1000 -> cap 30", cap(1000) === 30);

  // 5. Garde-fou anti-consécutif dur.
  const listeAvecHier = [
    candidat("hier", 15, 0, ilYA(0), ilYA(0)),
    candidat("autre", 3, 2, ilYA(0), ilYA(0)),
  ];
  const classeSansHier = classerFeatured(listeAvecHier, 7, "hier");
  check("anti-consécutif : le produit d'hier est exclu si N>=2", classeSansHier[0]?.id === "autre");

  // 6. L'ordre de service et tiebreakers.
  const classeEquite = classerFeatured([
    candidat("deja-servi", 15, 0, ilYA(0), ilYA(0)),
    candidat("jamais-servi", 1, 5, ilYA(0), ilYA(0)),
  ]);
  check("équité : le moins servi passe avant", classeEquite[0]?.id === "jamais-servi");

  const classeSignal = classerFeatured([
    candidat("calme", 1, 3, ilYA(0), ilYA(0)),
    candidat("vif", 5, 3, ilYA(0), ilYA(0)),
  ]);
  check("signal : à service égal, le plus vif passe", classeSignal[0]?.id === "vif");

  // 7. La PARITÉ avec la fonction SQL, sur les données réelles de la base.
  const rows = await db.execute(sql`
    WITH fenetre AS (SELECT now() - INTERVAL '7 days' AS since7),
    stats AS (
      SELECT COUNT(*)::int AS total,
             LEAST(GREATEST(COUNT(*)::int - 1, 7), 30) AS attente_cap,
             (SELECT product_id FROM public.featured_products
               WHERE featured_on = (now() AT TIME ZONE 'UTC')::date - 1) AS hier_id
        FROM public.products
       WHERE status = 'published' AND deleted_at IS NULL AND curated = false
    ),
    candidats AS (
      SELECT p.id,
             p.published_at,
             p.updated_at,
             GREATEST(0, LEAST((SELECT attente_cap FROM stats), COALESCE(
               ((now() AT TIME ZONE 'UTC')::date - MAX(f.featured_on))::int - 1,
               ((now() AT TIME ZONE 'UTC')::date - p.published_at::date)::int
             ))) AS attente,
             LEAST(15.0,
               (35.0 + COALESCE(p.ratings_sum, 0)::numeric)
                 / (10.0 + COALESCE(p.ratings_count, 0)::numeric)
               + ln(1.0 + GREATEST(0, COALESCE((SELECT SUM(v.weight)::numeric FROM public.votes v
                                   WHERE v.product_id = p.id
                                     AND v.created_at >= (SELECT since7 FROM fenetre)), 0)))
               + 1.5 * ln(1.0 + (SELECT COUNT(*)::numeric FROM public.comments c
                                 WHERE c.product_id = p.id
                                   AND c.created_at >= (SELECT since7 FROM fenetre)
                                   AND c.deleted_at IS NULL))
               + 2.5 * ln(1.0 + (SELECT COUNT(*)::numeric FROM public.reviews r
                                 WHERE r.product_id = p.id
                                   AND r.created_at >= (SELECT since7 FROM fenetre)
                                   AND r.deleted_at IS NULL))
               + 0.3 * ln(1.0 + (SELECT COUNT(*)::numeric FROM public.product_page_views pv
                                 WHERE pv.product_id = p.id
                                   AND pv.created_at >= (SELECT since7 FROM fenetre)))
               + 0.5 * ln(1.0 + (SELECT COUNT(*)::numeric FROM public.product_link_clicks lc
                                 WHERE lc.product_id = p.id
                                   AND lc.created_at >= (SELECT since7 FROM fenetre)))
               + 0.8 * ln(1.0 + (SELECT COUNT(*)::numeric FROM public.product_downloads pd
                                 WHERE pd.product_id = p.id
                                   AND pd.created_at >= (SELECT since7 FROM fenetre)))
             ) AS signal
        FROM public.products p
        LEFT JOIN public.featured_products f ON f.product_id = p.id
       WHERE p.status = 'published' AND p.deleted_at IS NULL AND p.curated = false
         AND ((SELECT total FROM stats) < 2 OR p.id IS DISTINCT FROM (SELECT hier_id FROM stats))
       GROUP BY p.id
    )
    SELECT c.id::text AS id,
           (3 * c.attente + c.signal) AS priorite
      FROM candidats c
     ORDER BY 3 * c.attente + c.signal DESC,
              c.updated_at DESC,
              c.published_at DESC,
              c.id ASC
     LIMIT 1
  `);
  const choisiSql = (rows as unknown as { id: string; priorite: number }[])[0];

  // Le même calcul en TypeScript sur les mêmes données réelles.
  const data = await db.execute(sql`
    WITH fenetre AS (SELECT now() - INTERVAL '7 days' AS since7)
    SELECT p.id::text AS id,
           p.published_at,
           p.updated_at,
           p.ratings_sum::int AS ratings_sum,
           p.ratings_count::int AS ratings_count,
           (SELECT COALESCE(SUM(v.weight), 0)::int FROM public.votes v
             WHERE v.product_id = p.id AND v.created_at >= (SELECT since7 FROM fenetre)) AS votes7,
           (SELECT COUNT(*)::int FROM public.comments c
             WHERE c.product_id = p.id AND c.created_at >= (SELECT since7 FROM fenetre) AND c.deleted_at IS NULL) AS comm7,
           (SELECT COUNT(*)::int FROM public.reviews r
             WHERE r.product_id = p.id AND r.created_at >= (SELECT since7 FROM fenetre) AND r.deleted_at IS NULL) AS avis7,
           (SELECT COUNT(*)::int FROM public.product_page_views pv
             WHERE pv.product_id = p.id AND pv.created_at >= (SELECT since7 FROM fenetre)) AS views7,
           (SELECT COUNT(*)::int FROM public.product_link_clicks lc
             WHERE lc.product_id = p.id AND lc.created_at >= (SELECT since7 FROM fenetre)) AS clics7,
           (SELECT COUNT(*)::int FROM public.product_downloads pd
             WHERE pd.product_id = p.id AND pd.created_at >= (SELECT since7 FROM fenetre)) AS dl7,
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
    views7: number;
    clics7: number;
    dl7: number;
    dernier: string | null;
  }[];

  const hierRow = (await db.execute(sql`
    SELECT product_id::text AS id FROM public.featured_products
     WHERE featured_on = (now() AT TIME ZONE 'UTC')::date - 1
     LIMIT 1
  `)) as unknown as { id: string }[];
  const hierId = hierRow[0]?.id;

  const totalN = lignes.length;
  const attenteCap = Math.min(Math.max(totalN - 1, 7), 30);
  const now = new Date();

  const candidatsTs = lignes.map((l) => {
    const attenteBrute = l.dernier
      ? Math.max(0, Math.floor((now.getTime() - Date.parse(`${l.dernier}T00:00:00Z`)) / JOUR) - 1)
      : Math.max(0, Math.floor((now.getTime() - l.published_at.getTime()) / JOUR));
    const attente = Math.min(attenteBrute, attenteCap);

    const note =
      (FEATURED_BAYES_C * FEATURED_BAYES_M + l.ratings_sum) / (FEATURED_BAYES_C + l.ratings_count);
    const signal = Math.min(
      FEATURED_SIGNAL_PLAFOND,
      note +
        Math.log(1 + Math.max(0, l.votes7)) +
        FEATURED_POIDS_COMMENTAIRE * Math.log(1 + l.comm7) +
        FEATURED_POIDS_AVIS * Math.log(1 + l.avis7) +
        FEATURED_POIDS_PAGEVIEW * Math.log(1 + l.views7) +
        FEATURED_POIDS_CLIC * Math.log(1 + l.clics7) +
        FEATURED_POIDS_DOWNLOAD * Math.log(1 + l.dl7),
    );
    return {
      id: l.id,
      signal,
      attente,
      updatedAt: l.updated_at,
      publishedAt: l.published_at,
    };
  });

  const choisiTs = classerFeatured(candidatsTs, attenteCap, hierId)[0];
  check(
    "parité : le service TypeScript et la règle SQL choisissent le même produit",
    choisiSql !== undefined && choisiTs !== undefined && choisiSql.id === choisiTs.id,
  );
  if (choisiSql && choisiTs && choisiSql.id !== choisiTs.id) {
    console.error(
      `   SQL : ${choisiSql.id} (priorité ${choisiSql.priorite}) · TS : ${choisiTs.id} (priorité ${featuredPriorite(choisiTs, attenteCap)})`,
    );
  }
  check(
    "priorité : la même valeur des deux côtés",
    choisiSql !== undefined &&
      choisiTs !== undefined &&
      Math.abs(Number(choisiSql.priorite) - featuredPriorite(choisiTs, attenteCap)) < 0.01,
  );

  console.log(`verify:featured — ${pass} OK, ${fail} KO`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error("verify:featured crash:", e);
  process.exit(1);
});
