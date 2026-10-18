import type { Metadata } from "next";
import Link from "next/link";
import { BookOpenIcon, KeyIcon, SealCheckIcon } from "@phosphor-icons/react/dist/ssr";

export const metadata: Metadata = {
  title: "Guides makers | Mada-Made",
  description:
    "Modes d'emploi pour les makers malgaches : connecter ses revenus vérifiés, publier son produit, comprendre le classement.",
};

export const dynamic = "force-dynamic";

/** Index des guides (SEO) — une carte par guide, jamais de mur vide. */
export default function GuidesPage() {
  return (
    <main className="w-full bg-background">
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-24">
        <header className="mb-12 flex flex-col gap-4">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
            Guides makers
          </p>
          <h1 className="max-w-[24ch] text-4xl md:text-5xl font-black tracking-tight text-foreground text-balance">
            Apprenez à utiliser la plateforme
          </h1>
          <p className="max-w-[62ch] text-lg font-medium leading-relaxed text-muted-foreground text-pretty">
            Des pas-à-pas courts, vérifiés contre les documentations officielles, pour tirer le
            meilleur de votre présence ici.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/guides/signature-apk"
            className="group flex gap-4 rounded-2xl border border-border/40 bg-muted/30 p-6 hover:bg-muted/60 transition-colors"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/10 border border-indigo-500/25">
              <KeyIcon weight="fill" className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </span>
            <span className="flex flex-col gap-1 min-w-0">
              <span className="text-[17px] font-extrabold tracking-tight text-foreground group-hover:text-primary transition-colors">
                Signer son APK release
              </span>
              <span className="text-[14px] font-medium text-muted-foreground leading-relaxed">
                Keystore, schémas v1/v2/v3 et vérification apksigner, pas-à-pas pour Android natif,
                Flutter, React Native, Expo et Capacitor.
              </span>
            </span>
          </Link>

          <Link
            href="/guides/revenus-verifies"
            className="group flex gap-4 rounded-2xl border border-border/40 bg-muted/30 p-6 hover:bg-muted/60 transition-colors"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/25">
              <SealCheckIcon
                weight="fill"
                className="h-5 w-5 text-emerald-600 dark:text-emerald-400"
              />
            </span>
            <span className="flex flex-col gap-1 min-w-0">
              <span className="text-[17px] font-extrabold tracking-tight text-foreground group-hover:text-primary transition-colors">
                Revenus vérifiés (Bêta)
              </span>
              <span className="text-[14px] font-medium text-muted-foreground leading-relaxed">
                Connecter Stripe, RevenueCat, Paddle, Polar ou Lemon Squeezy en lecture seule et
                afficher votre MRR.
              </span>
            </span>
          </Link>

          <div className="flex gap-4 rounded-2xl border border-border/40 border-dashed p-6 opacity-70">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-muted/50">
              <BookOpenIcon weight="duotone" className="h-5 w-5 text-muted-foreground" />
            </span>
            <span className="flex flex-col gap-1 min-w-0">
              <span className="text-[17px] font-extrabold tracking-tight text-foreground">
                Plus de guides à venir
              </span>
              <span className="text-[14px] font-medium text-muted-foreground leading-relaxed">
                Publier, classements, distribution : la bibliothèque grandit avec vos questions.
              </span>
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
