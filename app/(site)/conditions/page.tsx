import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Conditions d'utilisation",
  description:
    "Les règles d'usage de la plateforme : soumissions, revue manuelle, votes loyaux et responsabilités.",
};

// TODO(Jalon 5): contenu juridique complet (mentions légales, modération,
// sanctions, contact). Version courte d'amorçage.
export default function ConditionsPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-32 flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-foreground">
            Conditions d&apos;utilisation
          </h1>
          <p className="text-lg font-medium text-muted-foreground">
            Des règles simples, appliquées par des humains.
          </p>
        </div>

        <div className="flex flex-col gap-6 text-[15px] font-medium text-muted-foreground leading-relaxed">
          <section className="flex flex-col gap-2">
            <h2 className="text-xl font-extrabold tracking-tight text-foreground">
              Soumissions
            </h2>
            <p>
              Produits réels et joignables, pas de spam ni de doublons, icône
              exploitable. Chaque soumission passe en revue manuelle sous 24 h
              ouvrées ; un rejet est toujours motivé et réversible après
              correction.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-xl font-extrabold tracking-tight text-foreground">
              Votes loyaux
            </h2>
            <p>
              Un vote par utilisateur et par produit. Les anneaux de vote, bots
              et faux comptes entraînent l&apos;exclusion du classement, voire
              du compte.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-xl font-extrabold tracking-tight text-foreground">
              Comptes
            </h2>
            <p>
              La suppression du compte est réelle et définitive : profil,
              produits, votes et clés API sont effacés, conformément à notre
              politique de confidentialité.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
