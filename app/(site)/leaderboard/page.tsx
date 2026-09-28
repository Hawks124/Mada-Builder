import type { Metadata } from "next";
import { Suspense } from "react";
import { LeaderboardContent } from "@/components/ranking/leaderboard-content";

export const metadata: Metadata = {
  title: "Classement de la tech malgache | Mada-Made",
  description:
    "Découvrez les produits tech construits à Madagascar, classés par les votes de la communauté : apps, SaaS et outils des makers malgaches.",
};

export default function LeaderboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col w-full min-h-[calc(100vh-72px)] items-center justify-center">
          <p className="text-muted-foreground font-medium">Chargement du classement…</p>
        </div>
      }
    >
      <LeaderboardContent />
    </Suspense>
  );
}
