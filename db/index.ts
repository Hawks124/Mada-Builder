import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Client Postgres partagé — agnostique du fournisseur (Supabase, Neon,
 * local : seule DATABASE_URL change).
 *
 * `prepare: false` permanent : requis derrière un pooler transactionnel
 * (Supavisor `?pgbouncer=true`), inoffensif en direct. Coût négligeable V1.
 *
 * Pool (leçon QA : rendu home à 42 s) : `max: 1` sérialisait TOUTES les
 * requêtes du serveur sur une seule connexion (navbar + hero + hero-makers
 * en Promise.all = file d'attente + reconnect à chaque drop pooler).
 * `max: 10` absorbe les rendus parallèles ; `connect_timeout: 10` refuse
 * les hangs DNS/pooler silencieux (fail fast → fallback mock) ;
 * `idle_timeout: 30` recycle les connexions tuées par Supavisor.
 */
function createClient(): PostgresJsDatabase<typeof schema> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL manquante — copier .env.example vers .env.local (voir STACK.md).",
    );
  }
  const client = postgres(url, {
    prepare: false,
    max: 10,
    connect_timeout: 10,
    idle_timeout: 30,
  });
  return drizzle(client, { schema });
}

// Singleton HMR-safe (évite l'épuisement des connexions en dev).
const globalForDb = globalThis as unknown as {
  __builderDb?: PostgresJsDatabase<typeof schema>;
};

function getDb(): PostgresJsDatabase<typeof schema> {
  return (globalForDb.__builderDb ??= createClient());
}

/**
 * Client partagé PARESSEUX : `createClient()` ne tourne qu'au premier
 * usage réel, jamais à l'import. Sans ça, le moindre `import { db }`
 * (route API, page statique) jette au build/prerender dès que
 * DATABASE_URL manque — alors que le mode mock sans clés est un
 * comportement documenté (contributeur sans backend, CI sans secrets).
 * Le message d'erreur reste identique (STACK.md), il survient juste au
 * moment de la requête, pas au chargement du module.
 * Garde `then` : un `await db` accidentel ne doit pas pendre le Proxy.
 */
export const db: PostgresJsDatabase<typeof schema> = new Proxy(
  {},
  {
    get(_target, prop, receiver) {
      if (prop === "then") return undefined;
      const client = getDb();
      const value = Reflect.get(client, prop, receiver);
      return typeof value === "function" ? value.bind(client) : value;
    },
  },
) as PostgresJsDatabase<typeof schema>;
