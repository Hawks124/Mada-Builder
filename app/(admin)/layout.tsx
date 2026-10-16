import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getViewer } from "@/lib/supabase/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import AdminShell from "@/components/admin/admin-shell";
import { getOnboardingRedirect } from "@/app/actions/onboarding";

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
  // Journal diagnostique (dev seul, jamais de PII) : si le stream
  // admin meurt, ces lignes disent quelle phase n'a pas abouti.
  const devLog = (msg: string): void => {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[admin] ${msg}`);
    }
  };
  // eslint-disable-next-line react-hooks/purity -- diagnostic dev : mesure de durée, aucun impact rendu.
  const gateT0 = Date.now();
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
  // eslint-disable-next-line react-hooks/purity -- diagnostic dev : mesure de durée, aucun impact rendu.
  devLog(`gate ${(Date.now() - gateT0).toFixed(0)}ms`);
  // Zéro requête stat ici, par construction : les pastilles se chargent
  // en lazy côté shell (endpoint batché). Le layout ne fait que le gate
  // session+rôle — il ne peut plus mourir d'une stat.
  return <AdminShell>{children}</AdminShell>;
}
