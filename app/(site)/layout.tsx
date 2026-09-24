import { redirect } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { DegradedBanner } from "@/components/ui/degraded-banner";
import { getOnboardingRedirect, isViewerDegraded } from "@/app/actions/onboarding";

// Public shell — global navbar + content wrapper.
// Authenticated areas live under (dashboard) without this navbar.
// Gate /bienvenue (profils incomplets) — inbypassable par navigation.
export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let degraded = false;
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const dest = await getOnboardingRedirect().catch(() => null);
    if (dest) redirect(dest);
    degraded = await isViewerDegraded().catch(() => false);
  }
  return (
    <>
      {degraded && <DegradedBanner />}
      <Navbar />
      <main className="flex-1 flex flex-col w-full relative">{children}</main>
    </>
  );
}
