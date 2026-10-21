import type { Metadata } from "next";
import { ContactForm } from "@/components/contact/contact-form";

export const metadata: Metadata = {
  title: "Contact — sponsoring, partenariat, presse | Mada-Made",
  description:
    "Contactez l'équipe Mada-Made : sponsoring, partenariat, presse, support ou autre. Réponse sous 5 jours ouvrés, directement par email.",
};

/**
 * `/contact` — le seul formulaire public sans auth (les sponsors et
 * partenaires ne sont pas forcément membres). Indexable : c'est aussi
 * la porte d'entrée « annonceurs » du SEO.
 *
 * Pré-remplissage : `?sujet=…&message=…&lien=…` (le bouton « Contacter
 * la revue » du dashboard ouvre la page avec le contexte de la fiche).
 * Les paramètres sont lus ICI (serveur) et passés au formulaire : pas de
 * `useSearchParams` dans un composant client, qui exigerait un Suspense
 * et casserait le prérendu de la page.
 */
export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const one = (key: string): string | null => {
    const v = params[key];
    return typeof v === "string" ? v : null;
  };
  return (
    <main className="w-full">
      <div className="container px-4 md:px-8 max-w-3xl mx-auto pt-16 md:pt-20 pb-24 flex flex-col gap-10">
        <div className="flex flex-col gap-3">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">
            Contact
          </p>
          <h1 className="text-3xl md:text-[2.5rem] font-extrabold tracking-tighter text-foreground leading-none">
            Parlons-nous.
          </h1>
          <p className="text-muted-foreground font-medium md:text-lg tracking-tight leading-relaxed max-w-2xl">
            Sponsoring, partenariat, presse, support ou autre : choisissez le motif, écrivez,
            l&apos;équipe répond sous 5 jours ouvrés. Pas de compte requis, pas de messagerie
            interne — juste un email en retour.
          </p>
        </div>
        <ContactForm sujet={one("sujet")} messageInitial={one("message")} lien={one("lien")} />
      </div>
    </main>
  );
}
