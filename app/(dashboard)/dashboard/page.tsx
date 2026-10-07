import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OverviewHeader } from "@/components/dashboard/overview-header";
import { OverviewStats } from "@/components/dashboard/overview-stats";
import { getDashboardTotals } from "@/components/dashboard/dashboard-mock";
import { getSessionUser } from "@/lib/supabase/server";
import { fetchOwnProfile } from "@/services/users.service";
import { getMakerAppsDashboard } from "@/services/dashboard.service";
import { getNotifications } from "@/services/notifications.service";
import { timeAgoFr } from "@/services/activity.service";

// Auth pages are noindex (§7)
export const metadata: Metadata = {
  title: "Tableau de bord",
  robots: { index: false, follow: false },
};

// Toujours dynamique : données personnelles (jamais de HTML statique
// partagé entre makers).
export const dynamic = "force-dynamic";

// Vue d'ensemble — greeting, stats (+ futurs graphes). Les produits
// vivent sur /dashboard/products (section dédiée).
export default async function DashboardPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/signin?next=/dashboard");
  const [profile, apps, bell] = await Promise.all([
    fetchOwnProfile(sessionUser.id),
    getMakerAppsDashboard(sessionUser.id),
    getNotifications(sessionUser.id, { limit: 5 }).catch(() => ({ items: [], unreadCount: 0 })),
  ]);
  if (!profile) redirect("/signin?next=/dashboard");
  const totals = getDashboardTotals(apps);

  return (
    <div className="w-full px-6 lg:px-12 pt-10 lg:pt-14 pb-24 flex flex-col gap-14 lg:gap-16">
      <OverviewHeader
        userName={profile.displayName}
        notifications={bell.items.map((n) => ({
          id: n.id,
          title: n.title,
          time: timeAgoFr(n.createdAt),
          tone: (n.kind === "product_rejected" ||
          n.kind === "product_removed" ||
          n.kind === "banned"
            ? "alert"
            : "success") as "success" | "alert",
          image: n.productIconUrl ?? n.actorAvatarUrl ?? null,
        }))}
        unreadCount={bell.unreadCount}
      />
      <OverviewStats totals={totals} />
      {/* Les produits vivent sur /dashboard/products — ici : stats puis
          futurs graphes, jamais de liste. */}
    </div>
  );
}
