import type { Metadata } from "next";
import { ShieldCheckIcon } from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/dashboard/page-header";
import { InputField } from "@/components/ui/input-field";
import { DangerZone } from "@/components/dashboard/danger-zone";
import {
  ProvidersCard,
  type ProviderId,
} from "@/components/dashboard/providers-card";
import { getSessionUser, createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

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
export default async function SettingsPage() {
  // Session réelle → identités liées ; sinon fallback mock documenté
  // (prototype sans login : l'UI reste démontrable, le câblage est réel).
  let connected: ProviderId[] = ["github"];
  let email: string | null = "kaliana@mail.com";
  let githubHandle: string | null = "kaliana";
  // Username DB pour la confirmation de suppression (slug court > email).
  let username: string | null = null;
  try {
    const user = await getSessionUser();
    if (user) {
      const supabase = await createClient();
      const { data } = await supabase.auth.getUserIdentities();
      const linked = (data?.identities ?? [])
        .map((i) => i.provider)
        .filter(
          (p): p is ProviderId =>
            p === "github" || p === "google" || p === "email",
        );
      if (linked.length > 0) connected = [...new Set(linked)];
      email = user.email ?? null;
      try {
        const [row] = await db
          .select({ username: users.username })
          .from(users)
          .where(eq(users.id, user.id))
          .limit(1);
        if (row) username = row.username;
      } catch {
        // Ligne absente : la confirmation retombera sur l'email.
      }
      const gh = (data?.identities ?? []).find((i) => i.provider === "github");
      githubHandle =
        (gh?.identity_data?.user_name as string | undefined) ?? null;
    }
  } catch {
    // Supabase non configuré ou hors-ligne : fallback mock ci-dessus.
  }
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
              defaultValue={email ?? ""}
              disabled
              subtitle="L'email de connexion ne peut pas être modifié pour le moment."
            />
          </div>

          <div className="w-full h-px bg-border/40" />

          <ProvidersCard connected={connected} githubHandle={githubHandle} />

          <div className="w-full h-px bg-border/40" />

          {/* Export — V1.5 : badge Bientôt, pas de handler mort */}
          <div className="flex flex-col gap-4">
            <h2 className="text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-2">
              Export de mes données
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Bientôt
              </span>
            </h2>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <p className="text-[14px] font-medium text-muted-foreground leading-relaxed flex-1">
                Recevez une archive (profil, produits, votes) par email sous
                24 h, au format JSON lisible.
              </p>
              <button
                type="button"
                disabled
                title="Disponible prochainement"
                className="shrink-0 rounded-full border border-border/60 px-5 py-2.5 text-[13px] font-bold text-muted-foreground opacity-50 cursor-not-allowed"
              >
                Demander l&apos;export
              </button>
            </div>
          </div>

          <div className="w-full h-px bg-border/40" />

          <DangerZone
            userEmail={email ?? "kaliana@mail.com"}
            username={username}
          />
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
