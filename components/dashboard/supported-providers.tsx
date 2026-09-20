import { cn } from "@/lib/utils";
import Image from "next/image";
import type { ApiConnection, RevenueProvider } from "@/components/dashboard/api-connections";

type ProviderStatus = "connected" | "soon";

type SupportedProvider = {
  id: string;
  label: string;
  /** Real SVG in /logos — monogramme en fallback si absent. */
  logo?: {
    src: string;
    width: number;
    height: number;
    className: string;
    darkClass?: string;
  };
  monogram?: string;
  status: ProviderStatus;
  note: string;
};

const PROVIDERS: SupportedProvider[] = [
  {
    id: "stripe",
    label: "Stripe",
    logo: {
      src: "/logos/stripe.svg",
      width: 64,
      height: 30,
      className: "w-8",
      darkClass: "dark:brightness-0 dark:invert",
    },
    status: "connected",
    note: "",
  },
  {
    id: "revenuecat",
    label: "RevenueCat",
    logo: {
      src: "/logos/revenuecat.svg",
      width: 40,
      height: 40,
      className: "w-7 h-7",
    },
    status: "connected",
    note: "",
  },
  {
    id: "polar",
    label: "Polar",
    logo: {
      src: "/logos/polar.svg",
      width: 48,
      height: 56,
      className: "w-6 h-7 text-foreground",
    },
    status: "soon",
    note: "V1.5",
  },
  {
    id: "lemon-squeezy",
    label: "Lemon Squeezy",
    logo: {
      src: "/logos/lemon-squeezy.svg",
      width: 40,
      height: 40,
      className: "w-6 h-6",
      darkClass: "dark:brightness-0 dark:invert",
    },
    status: "soon",
    note: "V1.5",
  },
  {
    id: "paddle",
    label: "Paddle",
    logo: {
      src: "/logos/paddle.svg",
      width: 40,
      height: 40,
      className: "w-6 h-6",
      darkClass: "dark:brightness-0 dark:invert",
    },
    status: "soon",
    note: "V1.5",
  },
];

// Tous les fournisseurs, même flow de connexion en lecture seule.
// Les monogrammes attendent les vrais SVG dans /logos (V1.5).
export function SupportedProviders({
  connections,
}: {
  connections: ApiConnection[];
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-2xl font-black tracking-tight text-foreground">
          Fournisseurs supportés
        </h2>
        <p className="text-[14px] font-medium text-muted-foreground leading-relaxed">
          Même connexion en lecture seule pour tous. Polar, Lemon Squeezy et
          Paddle arrivent en V1.5.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {PROVIDERS.map((provider) => {
          const linked =
            provider.status === "connected"
              ? connections.filter(
                  (c) => c.provider === (provider.id as RevenueProvider),
                ).length
              : 0;
          return (
            <div
              key={provider.id}
              className="flex flex-col items-center text-center gap-2 py-3"
            >
              <div className="h-11 w-11 rounded-2xl bg-background border border-border/40 flex items-center justify-center shrink-0 overflow-hidden">
                {provider.logo ? (
                  <Image
                    src={provider.logo.src}
                    alt={provider.label}
                    width={provider.logo.width}
                    height={provider.logo.height}
                    className={cn(
                      "object-contain",
                      provider.logo.className,
                      provider.logo.darkClass,
                    )}
                  />
                ) : (
                  <span className="text-[15px] font-black text-muted-foreground">
                    {provider.monogram}
                  </span>
                )}
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <span className="text-[14px] font-bold text-foreground leading-none">
                  {provider.label}
                </span>
                {provider.status === "connected" ? (
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-[3px] text-[9px] font-black uppercase tracking-[0.14em] leading-none text-emerald-600 dark:text-emerald-400">
                    <span
                      className="h-1 w-1 rounded-full bg-current"
                      aria-hidden="true"
                    />
                    Connecté{linked > 0 ? ` · ${linked}` : ""}
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-md border border-border/60 bg-muted/40 px-1.5 py-[3px] text-[9px] font-black uppercase tracking-[0.14em] leading-none text-muted-foreground">
                    Bientôt
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
