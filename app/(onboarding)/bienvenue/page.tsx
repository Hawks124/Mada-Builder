import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BienvenueForm } from "@/components/onboarding/bienvenue-form";
import { getSessionUser, createClient } from "@/lib/supabase/server";
import { getOnboardingFormData, getOnboardingStatus } from "@/services/users.service";

export const metadata: Metadata = {
  title: "Bienvenue",
  robots: { index: false, follow: false },
};

/** ?next= validé same-origin (même règle que callback/auth). */
function sanitizeNext(raw: string | undefined): string {
  if (typeof raw === "string" && raw.startsWith("/") && !raw.startsWith("//")) {
    return raw;
  }
  return "/dashboard";
}

function ErrorState() {
  return (
    <div className="flex flex-col gap-4 max-w-md">
      <h1 className="text-4xl font-black tracking-tight text-foreground">
        Vérification impossible
      </h1>
      <p className="text-base text-muted-foreground font-medium leading-relaxed">
        Nous n&apos;avons pas pu vérifier votre profil (réseau). Rien n&apos;est perdu — réessayez.
      </p>
      <Link
        href="/bienvenue"
        className="inline-flex items-center justify-center rounded-full bg-foreground h-12 px-7 text-[15px] font-bold text-background hover:opacity-90 transition-all w-fit"
      >
        Réessayer
      </Link>
    </div>
  );
}

// Page dynamique : invité PROUVÉ → signin ; incident → écran d'erreur +
// réessai (JAMAIS de redirect sur du non-vérifié : c'est ce qui
// produisait la boucle /bienvenue ↔ /signin) ; passage direct sur le
// MÊME prédicat que la gate (diverger = boucle : post-mortem §9).
export default async function BienvenuePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = sanitizeNext(params.next);
  const sessionUser = await getSessionUser().catch(() => null);
  if (!sessionUser) redirect("/signin");
  const status = await getOnboardingStatus(sessionUser.id).catch(() => null);
  if (!status) return <ErrorState />;
  if (status.done) redirect(next);
  // Email affiché SSI manquant réel (placeholder/ligne absente) — inutile
  // de re-demander ce qu'on a déjà.
  const form = await getOnboardingFormData(sessionUser.id).catch(() => null);
  // Provider de CETTE session (dernière identité utilisée), pas l'historique :
  // un compte Google qui a lié GitHub un jour n'est pas "via GitHub".
  // Repli miroir si l'appel identités échoue.
  let provider = form?.provider ?? "email";
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUserIdentities();
    let best: { provider: string; at: number } | null = null;
    for (const identity of data?.identities ?? []) {
      const at = identity.last_sign_in_at ? Date.parse(identity.last_sign_in_at) : 0;
      if (identity.provider && at >= (best?.at ?? -1)) {
        best = { provider: identity.provider, at };
      }
    }
    if (best && (best.provider === "github" || best.provider === "google")) {
      provider = best.provider;
    }
  } catch {
    // Repli miroir ci-dessus.
  }
  return (
    <BienvenueForm
      missing={status.missing ?? []}
      initial={{
        displayName: form?.displayName ?? "",
        occupation: form?.occupation ?? "maker",
      }}
      identity={
        form
          ? {
              name: form.displayName || form.username || "Maker",
              username: form.username,
              avatarUrl: form.avatarUrl,
              shortId: form.accountId.slice(0, 8),
            }
          : null
      }
      provider={provider}
      next={next}
    />
  );
}
