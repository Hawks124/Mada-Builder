import type { Metadata } from "next";
import Image from "next/image";
import {
  GithubLogoIcon,
  CheckCircleIcon,
  ShieldCheckIcon,
} from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/dashboard/page-header";
import { InputField } from "@/components/ui/input-field";
import { DangerZone } from "@/components/dashboard/danger-zone";
import { cn } from "@/lib/utils";

// Auth pages are noindex (§7)
export const metadata: Metadata = {
  title: "Paramètres du compte",
  robots: { index: false, follow: false },
};

const SECURITY_TIPS = [
  "Liez deux fournisseurs pour ne jamais perdre l'accès.",
  "Les clés API facturation ne sont jamais ré-affichées.",
  "La suppression du compte est définitive et immédiate.",
];

// Compte uniquement — le profil public vit sur /dashboard/profile.
// Email read-only, fournisseurs d'auth, suppression réelle (§6F).
export default function SettingsPage() {
  return (
    <div className="w-full px-6 lg:px-12 pt-10 lg:pt-14 pb-24 flex flex-col gap-10">
      <PageHeader
        title="Paramètres du compte"
        subtitle="Email de connexion, fournisseurs d'authentification et suppression."
      />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-12 items-start">
        {/* Form */}
        <div className="flex flex-col gap-10 min-w-0">
          {/* Email */}
          <div className="flex flex-col gap-6">
            <h2 className="text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">
              Email de connexion
            </h2>
            <InputField
              label="Email"
              defaultValue="kaliana@mail.com"
              disabled
              subtitle="L'email de connexion ne peut pas être modifié pour le moment."
            />
          </div>

          <div className="w-full h-px bg-border/40" />

          {/* Providers */}
          <div className="flex flex-col gap-4">
            <h2 className="text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">
              Fournisseurs connectés
            </h2>

            {/* GitHub — connecté */}
            <div className="flex items-center gap-4 rounded-2xl border border-border/40 px-5 py-4">
              <GithubLogoIcon
                weight="fill"
                className="h-6 w-6 text-foreground shrink-0"
              />
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-[15px] font-bold text-foreground">
                  GitHub
                </span>
                <span className="text-[13px] font-medium text-muted-foreground">
                  @kaliana
                </span>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-600 dark:text-emerald-400 shrink-0">
                <CheckCircleIcon weight="fill" className="w-3.5 h-3.5" />
                Connecté
              </span>
            </div>

            {/* Google — à connecter (mock) */}
            <div
              className={cn(
                "flex items-center gap-4 rounded-2xl border border-border/40 px-5 py-4",
              )}
            >
              <Image
                src="/logos/google.svg"
                alt="Google"
                width={24}
                height={24}
                className="h-6 w-6 shrink-0"
              />
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-[15px] font-bold text-foreground">
                  Google
                </span>
                <span className="text-[13px] font-medium text-muted-foreground">
                  Liez un second fournisseur pour sécuriser l&apos;accès.
                </span>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-full border border-border/60 px-5 py-2 text-[13px] font-bold text-foreground hover:border-foreground/30 hover:bg-muted/50 transition-colors cursor-pointer"
              >
                Connecter
              </button>
            </div>
          </div>

          <div className="w-full h-px bg-border/40" />

          <DangerZone userEmail="kaliana@mail.com" />
        </div>

        {/* Guidance aside */}
        <aside className="hidden lg:flex flex-col gap-5 sticky top-8 rounded-3xl border border-border/40 bg-muted/20 p-6">
          <h3 className="text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">
            Sécurité
          </h3>
          {SECURITY_TIPS.map((tip) => (
            <div key={tip} className="flex items-start gap-3">
              <ShieldCheckIcon
                weight="fill"
                className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5"
              />
              <p className="text-[13px] font-medium text-muted-foreground leading-relaxed">
                {tip}
              </p>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}
