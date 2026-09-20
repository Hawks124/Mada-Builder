import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description:
    "Comment la plateforme collecte, utilise et protège vos données — et vos droits d'accès, d'export et de suppression.",
};

// TODO(Jalon 5): contenu juridique complet (DPA, sous-traitants, durées,
// contact DPO, droits RGPD détaillés). Version courte d'amorçage.
export default function ConfidentialitePage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-32 flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-foreground">
            Politique de confidentialité
          </h1>
          <p className="text-lg font-medium text-muted-foreground">
            Vos données vous appartiennent. Point.
          </p>
        </div>

        <div className="flex flex-col gap-6 text-[15px] font-medium text-muted-foreground leading-relaxed">
          <section className="flex flex-col gap-2">
            <h2 className="text-xl font-extrabold tracking-tight text-foreground">
              Données collectées
            </h2>
            <p>
              Compte (email, fournisseur d&apos;authentification), profil
              public (nom, bio, liens), produits soumis et votes. Aucun pixel
              de tracking tiers, aucune revente de données.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-xl font-extrabold tracking-tight text-foreground">
              Clés de facturation
            </h2>
            <p>
              Les clés API (Stripe, RevenueCat…) sont chiffrées au repos,
              utilisées en lecture seule et ne sont jamais ré-affichées, même
              masquées. Seuls des agrégats (MRR, abonnés) sont stockés —
              jamais de données clients.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-xl font-extrabold tracking-tight text-foreground">
              Vos droits
            </h2>
            <p>
              Accès, export et suppression : la suppression du compte efface
              réellement profil, produits, votes et connexions, sans délai
              caché.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
