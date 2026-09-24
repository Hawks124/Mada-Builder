import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getViewer } from "@/lib/supabase/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import AdminShell from "@/components/admin/admin-shell";
import { getOnboardingRedirect } from "@/app/actions/onboarding";

/**
 * Double-check server : session + rôle staff (admin|moderateur).
 * JWT d'abord (zéro requête), fallback rôle-table si muet (promotion
 * récente — même règle que proxy.ts, défense en profondeur).
 * Sinon / (pas de 403 qui confirme l'existence de l'admin).
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
    const role = (user?.app_metadata as { role?: string } | undefined)?.role;
    if (role !== "admin" && role !== "moderateur") {
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
    }
    const dest = await getOnboardingRedirect().catch(() => null);
    if (dest) redirect(dest);
  }
  return <AdminShell>{children}</AdminShell>;
}
