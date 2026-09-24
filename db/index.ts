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

export const db: PostgresJsDatabase<typeof schema> =
  globalForDb.__builderDb ?? (globalForDb.__builderDb = createClient());
