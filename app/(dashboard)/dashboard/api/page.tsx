import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ShieldCheckIcon, KeyIcon } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/dashboard/page-header";
import { ApiConnections } from "@/components/dashboard/api-connections";
import { getSessionUser } from "@/lib/supabase/server";
import { listMyRevenueConnections } from "@/services/revenue/connections";

// Auth pages are noindex (§7)
export const metadata: Metadata = {
  title: "Clés API",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const TRUST_ITEMS = [
  { icon: ShieldCheckIcon, label: "Chiffrement AES-256" },
  { icon: KeyIcon, label: "Lecture seule uniquement" },
  { icon: ShieldCheckIcon, label: "Aucune donnée client" },
  { icon: KeyIcon, label: "Révocable à tout moment" },
];

// Stored billing keys — surveiller et révoquer (les secrets ne sont
// jamais ré-affichés, même masqués). Données réelles (connexions + dernier
// snapshot), vide honnête sans connexion.
export default async function DashboardApiPage() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/signin?next=/dashboard/api");
  const connections = await listMyRevenueConnections(sessionUser.id).catch(() => []);

  return (
    <div className="w-full px-6 lg:px-12 pt-10 lg:pt-14 pb-24 flex flex-col gap-10">
      <PageHeader
        title="Clés API"
        subtitle="Vos connexions de revenus vérifiés. Elles se créent depuis la fiche de chaque produit — ici, vous les surveillez et les révoquez."
      />

      <p className="inline-flex items-center gap-2 self-start rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[12px] font-bold text-amber-700 dark:text-amber-400">
        Fonctionnalité en bêta —{" "}
        <Link href="/guides/revenus-verifies" className="underline underline-offset-2">
          mode d&apos;emploi
        </Link>
      </p>

      {/* Trust strip — securities first-class (§12, §16) */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {TRUST_ITEMS.map((item, i) => (
          <span
            key={i}
            className="flex items-center gap-1.5 text-[12px] font-bold text-emerald-600 dark:text-emerald-400"
          >
            <item.icon weight="fill" className="w-4 h-4" aria-hidden="true" />
            {item.label}
          </span>
        ))}
      </div>

      <ApiConnections
        initial={connections.map((c) => ({
          id: c.id,
          provider: c.provider,
          productId: c.productId,
          productName: c.productName,
          productSlug: c.productSlug,
          displayMode: c.displayMode,
          status: c.status,
          lastSyncedText:
            c.lastSyncedAt != null
              ? new Date(c.lastSyncedAt).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "short",
                })
              : "jamais",
          lastError: c.lastError ?? undefined,
          mrrCents: c.mrrCents,
          currency: c.currency ?? "USD",
          keyHint: c.keyHint,
        }))}
      />
    </div>
  );
}
