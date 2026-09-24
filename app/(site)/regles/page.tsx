import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheckIcon } from "@phosphor-icons/react/dist/ssr";
import { FACEBOOK_GROUP_URL } from "@/components/navbar/community-dropdown";

export const metadata: Metadata = {
  title: "Charte de la communauté",
  description:
    "Les règles de la scène dev malgache : soumissions honnêtes, revue manuelle, votes loyaux et respect mutuel.",
};

const SECTIONS = [
  {
    title: "Des produits réels",
    body: "Seuls les produits réels et joignables ont leur place ici : lien fonctionnel, icône exploitable, description honnête. Pas de spam, pas de doublons, pas de coquilles vides.",
  },
  {
    title: "Une revue humaine",
    body: "Chaque soumission passe en revue manuelle sous 24 h ouvrées. Un rejet est toujours motivé et réversible après correction — jamais un couperet automatique sans recours.",
  },
  {
    title: "Des votes loyaux",
    body: "Un vote par utilisateur et par produit. Anneaux de vote, bots et faux comptes excluent du classement, voire du compte. Le classement ne se vend ni ne s'achète.",
  },
  {
    title: "Le respect mutuel",
    body: "On critique les produits, jamais les personnes. Cette scène se construit ensemble : célébrez le travail des autres comme vous voulez voir le vôtre célébré.",
  },
];

// TODO(Jalon 5): sanctions graduées détaillées + cas limites.
// Charte communautaire (contrat social lisible) — le contrat juridique
// vit sur /conditions. Indexable (§7).
export default function ReglesPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-32 flex flex-col gap-10">
        <div className="flex flex-col gap-3">
          <span className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.15em] text-muted-foreground w-fit">
            <ShieldCheckIcon
              weight="fill"
              className="w-4 h-4 text-emerald-600 dark:text-emerald-400"
            />
            Communauté
          </span>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-foreground">
            Charte de la communauté
          </h1>
          <p className="text-lg font-medium text-muted-foreground">
            Quatre règles simples pour une scène dont on est fiers.
          </p>
        </div>

        <div className="flex flex-col gap-8">
          {SECTIONS.map((section, i) => (
            <section key={section.title} className="flex gap-5">
              <span className="text-sm font-black text-muted-foreground/60 tabular-nums mt-1 shrink-0">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="flex flex-col gap-2">
                <h2 className="text-xl font-extrabold tracking-tight text-foreground">
                  {section.title}
                </h2>
                <p className="text-[15px] font-medium text-muted-foreground leading-relaxed">
                  {section.body}
                </p>
              </div>
            </section>
          ))}
        </div>

        <div className="w-full h-px bg-border/40" />

        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <p className="text-[14px] font-medium text-muted-foreground flex-1">
            Une question, un litige, un signalement ? La communauté vit aussi hors ligne.
          </p>
          <Link
            href={FACEBOOK_GROUP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-6 h-11 rounded-full bg-foreground text-background text-[14px] font-bold hover:opacity-90 transition-opacity shrink-0"
          >
            Rejoindre le groupe
          </Link>
        </div>
      </div>
    </main>
  );
}
