-- Revenus vérifiés : RLS deny-all (aucune policy = refusé via Data API,
-- sinon n'importe qui lirait les connexions/clés via PostgREST).
-- Lectures/écritures Drizzle serveur uniquement (service_role).
ALTER TABLE "public"."revenue_connections" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "public"."revenue_snapshots" ENABLE ROW LEVEL SECURITY;
