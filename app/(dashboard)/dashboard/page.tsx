import type { Metadata } from "next";
import { OverviewHeader } from "@/components/dashboard/overview-header";
import { OverviewStats } from "@/components/dashboard/overview-stats";
import { OverviewApps } from "@/components/dashboard/overview-apps";
import {
  MOCK_APPS,
  getDashboardTotals,
} from "@/components/dashboard/dashboard-mock";

// Auth pages are noindex (§7)
export const metadata: Metadata = {
  title: "Tableau de bord",
  robots: { index: false, follow: false },
};

// Vue d'ensemble — greeting, stats, mes applications.
// Reads MOCK_APPS for now; will read session + Drizzle once auth lands.
export default function DashboardPage() {
  const totals = getDashboardTotals(MOCK_APPS);

  return (
    <div className="w-full px-6 lg:px-12 pt-10 lg:pt-14 pb-24 flex flex-col gap-14 lg:gap-16">
      <OverviewHeader userName="Kaliana" />
      <OverviewStats totals={totals} />
      <div className="w-full h-px bg-border/40" />
      <OverviewApps apps={MOCK_APPS} />
    </div>
  );
}
