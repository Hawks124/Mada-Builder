import type { Metadata } from "next";
import { ShieldCheckIcon, KeyIcon } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/dashboard/page-header";
import { ApiConnections } from "@/components/dashboard/api-connections";

// Auth pages are noindex (§7)
export const metadata: Metadata = {
  title: "Clés API",
  robots: { index: false, follow: false },
};

const TRUST_ITEMS = [
  { icon: ShieldCheckIcon, label: "Chiffrement AES-256" },
  { icon: KeyIcon, label: "Lecture seule uniquement" },
  { icon: ShieldCheckIcon, label: "Aucune donnée client" },
  { icon: KeyIcon, label: "Révocable à tout moment" },
];

// Stored billing keys — surveiller et révoquer (les secrets ne sont
// jamais ré-affichés, même masqués). Lit revenue_connections avec le backend.
export default function DashboardApiPage() {
  return (
    <div className="w-full px-6 lg:px-12 pt-10 lg:pt-14 pb-24 flex flex-col gap-10">
      <PageHeader
        title="Clés API"
        subtitle="Vos connexions de revenus vérifiés. Elles se créent depuis la fiche de chaque produit — ici, vous les surveillez et les révoquez."
      />

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

      <ApiConnections />
    </div>
  );
}
