import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getViewer } from "@/lib/supabase/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import AdminShell from "@/components/admin/admin-shell";
import { getOnboardingRedirect } from "@/app/actions/onboarding";
import { getPendingCountCached, getRejectedCountCached } from "@/services/stats.service";

/**
 * Double-check server : session + rôle staff (admin|moderateur).
 * VÉRITÉ DB (request-cached, 1 requête/requête HTTP) — JAMAIS le miroir
 * JWT seul : un app_metadata stale (demotion en DB directe sans sync,
 * ex. setup-curation-account sur open-sources, oct. 2026) laissait entrer
 * un `user` dans tout le panel. Le proxy garde le JWT en fast path
 * (fail-closed vers /), le layout tranche sur la table.
 * Sinon / (pas de 403 qui confirme l'existence de l'admin).
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Double-check server : session + rôle staff dès que le backend est
  // configuré (même garde env-absente que le proxy).
  // Périmètre sensible : invité PROUVÉ → /signin, incident → / (fail-closed
  // assumé — un admin éjecté sous hoquet revient à la navigation suivante).
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const viewer = await getViewer().catch(() => ({ status: "error" as const }));
    if (viewer.status !== "authed") {
      redirect(viewer.status === "guest" ? "/signin" : "/");
    }
    const user = viewer.user;
    let staff = false;
    try {
      const [row] = await db
        .select({ role: users.role })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1);
      staff = !!row && (row.role === "admin" || row.role === "moderateur");
    } catch {
      staff = false;
    }
    if (!staff) redirect("/");
    const dest = await getOnboardingRedirect().catch(() => null);
    if (dest) redirect(dest);
  }
  // Badges réels (files DB, pas de mock).
  const [pendingCount, rejectedCount] = await Promise.all([
    getPendingCountCached(),
    getRejectedCountCached(),
  ]);
  return (
    <AdminShell pendingCount={pendingCount} rejectedCount={rejectedCount}>
      {children}
    </AdminShell>
  );
}
