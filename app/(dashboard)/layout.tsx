import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getViewer } from "@/lib/supabase/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import DashboardShell from "@/components/dashboard/dashboard-shell";
import { SuspendedScreen } from "@/components/dashboard/suspended-screen";
import { DegradedBanner } from "@/components/ui/degraded-banner";
import { getOnboardingRedirect, isViewerDegraded } from "@/app/actions/onboarding";

/**
 * Double-check server (défense en profondeur avec le middleware) :
 * session exigée, sinon retour /signin. Le shell client ne voit
 * que des sessions vérifiées. Banni → SuspendedScreen (verrou total).
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Double-check server : session exigée dès que le backend est configuré
  // (env absente = contributeur sans compte → laisse passer, cf. middleware).
  let sidebarUser: {
    name: string;
    initials: string;
    avatarUrl: string | null;
  } | null = null;
  let viewerId: string | null = null;
  let degraded = false;
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    // Invité PROUVÉ → /signin. Incident → on rend quand même (données en
    // fallback mock, actions vérifiées serveur) : rediriger ici produisait
    // des boucles sous hoquet réseau (jamais sur du non-vérifié).
    const viewer = await getViewer().catch(() => ({ status: "error" as const }));
    if (viewer.status === "guest") redirect("/signin");
    const user = viewer.status === "authed" ? viewer.user : null;
    viewerId = user?.id ?? null;
    // Vrai identité sidebar (avatar uploadé + nom) — fallback mock hors DB.
    // Banni → écran verrouillé (données lues hors JSX : pas de JSX en try).
    // Incident (user null) : on saute la lecture (shell mock, re-vérifié
    // à la prochaine navigation).
    let suspended: {
      displayName: string;
      banReason: string | null;
      username: string;
    } | null = null;
    if (!user) {
      return (
        <DashboardShell sidebarUser={sidebarUser} userId={viewerId}>
          {children}
        </DashboardShell>
      );
    }
    try {
      const [row] = await db
        .select({
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
          username: users.username,
          bannedAt: users.bannedAt,
          banReason: users.banReason,
        })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1);
      // Enfants jamais rendus quand banni ; mutations verrouillées côté
      // service (assertNotBanned) + RLS (§3d setup.sql).
      if (row?.bannedAt) {
        suspended = {
          displayName: row.displayName,
          banReason: row.banReason,
          username: row.username,
        };
      } else if (row) {
        const initials = row.displayName
          .split(/[\s_.-]+/)
          .filter(Boolean)
          .slice(0, 2)
          .map((w) => w[0]!.toUpperCase())
          .join("");
        sidebarUser = {
          name: row.displayName,
          initials: initials || "M",
          avatarUrl: row.avatarUrl,
        };
      }
    } catch {
      // Ligne absente (trigger en retard) : fallback mock du shell.
    }
    if (suspended) {
      return (
        <SuspendedScreen
          displayName={suspended.displayName}
          banReason={suspended.banReason}
          username={suspended.username}
        />
      );
    }
    // Banni d'abord (écran ci-dessus), complétude ensuite : un banni
    // n'atterrit jamais à /bienvenue, un incomplet jamais au dashboard.
    const dest = await getOnboardingRedirect().catch(() => null);
    if (dest) redirect(dest);
    degraded = viewer.status === "error" || (await isViewerDegraded().catch(() => false));
  }
  return (
    <>
      {degraded && <DegradedBanner />}
      <DashboardShell sidebarUser={sidebarUser} userId={viewerId}>
        {children}
      </DashboardShell>
    </>
  );
}
