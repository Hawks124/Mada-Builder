// Groupe auth — shell nu, sans navbar globale (immersif).
// Gate /bienvenue : un connecté incomplet n'a rien à faire sur /signin.
import { redirect } from "next/navigation";
import { getOnboardingRedirect } from "@/app/actions/onboarding";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const dest = await getOnboardingRedirect().catch(() => null);
    if (dest) redirect(dest);
  }
  return <>{children}</>;
}
