import type { Metadata } from "next";
import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SigninForm } from "@/components/auth/signin-form";
import { LogoMark } from "@/components/ui/logo";
import { Wordmark } from "@/components/ui/wordmark";
import { getSessionUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Connexion | Mada-Made",
  robots: { index: false, follow: false },
};

/**
 * `/signin` — coque de page uniquement.
 *
 * La colonne de droite est la photo seule : Tsingy de Bemaraha, le ghost logo
 * en grand étant déjà partie intégrante de sa composition. Aucun texte
 * par-dessus, et c'est délibéré :
 *
 * - le slogan « Ce que tu construis ici, on le voit ici. » est **déjà** le
 *   `<h1>` du hero (`components/home/hero.tsx`) — le reproduire ici serait
 *   redondant ;
 * - tout texte posé sur l'image devrait être voilé pour rester lisible, et le
 *   voile mange la texture.
 *
 * La marque porte la navigation seule (haut-gauche, lien accueil), la
 * signature signe la photo (bas-droite) — les deux représentations du logo,
 * sans un mot de plus. La couture avec le formulaire reste une bordure : le
 * fondu testé mangeait la texture de la roche.
 */
export default async function SigninPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string }>;
}) {
  // Déjà connecté : pas de formulaire inutile — retour demandé ou dashboard.
  const sessionUser = await getSessionUser().catch(() => null);
  if (sessionUser) {
    const raw = (await searchParams)?.next;
    redirect(raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/dashboard");
  }
  return (
    <div className="min-h-screen bg-background flex overflow-hidden selection:bg-foreground selection:text-background">
      {/* ── Colonne Gauche — Le Formulaire ── */}
      <div className="shrink-0 w-full lg:w-[45%] xl:w-[40%] flex flex-col justify-center px-8 sm:px-16 py-12 z-20 bg-background/80 backdrop-blur-2xl lg:bg-background lg:backdrop-blur-none border-r border-border/40 shadow-[20px_0_40px_rgba(0,0,0,0.02)] dark:shadow-none">
        <div className="max-w-md w-full mx-auto">
          {/* Logo mobile uniquement : dès lg, il passe sur le panneau photo —
              la colonne formulaire récupère sa hauteur et se centre vraiment.
              Il reste aussi le seul lien vers l'accueil en dessous de 1024px,
              là où le panneau n'existe pas. */}
          <Link href="/" className="flex items-center gap-5 w-fit mb-14 group lg:hidden">
            <LogoMark className="h-11 w-11 shadow-sm transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-3" />
            <span className="font-bold text-2xl tracking-tight text-foreground">Mada-Made</span>
          </Link>

          {/* Titres + formulaires rendus par SigninForm (accueil vs vérification). */}
          <Suspense>
            <SigninForm />
          </Suspense>
        </div>
      </div>

      {/* ── Colonne Droite — La photo ── */}
      {/* `object-cover` : le panneau est toujours en portrait alors que la photo
          est en paysage (1381×1139), donc une bande est rognée sur chaque écran.
          C'est assumé — le cadrage garde les crêtes éclairées, et le ghost logo
          varie en visibilité avec la largeur du panneau sans jamais être coupé. */}
      <div className="hidden lg:block relative flex-1 overflow-hidden bg-zinc-950">
        <Image
          src="/auth/mada-made-tsingy-auth-background.webp"
          /* Purement atmosphérique : aucune information n'est portée par l'image,
             le contenu de la page est le formulaire. `alt` vide = décorative. */
          alt=""
          fill
          /* Élément LCP de la page : jamais différé. 176 Ko en WebP, contre
             1 744 Ko pour le PNG source. */
          priority
          sizes="(min-width: 1536px) 60vw, 55vw"
          className="object-cover"
        />

        {/* Navigation — la marque seule porte le lien accueil sur desktop ;
            `tone="on-dark"` force la version blanche : le panneau est toujours
            sombre alors que le thème peut être clair. Pas de texte : le nom
            vit dans la signature en bas-droite, pas sur la photo. */}
        <Link
          href="/"
          aria-label="Mada-Made — retour à l'accueil"
          className="group absolute left-8 top-8 z-10 xl:left-10 xl:top-10"
        >
          <LogoMark
            variant="bare"
            tone="on-dark"
            className="h-7 w-auto transition-transform duration-500 group-hover:scale-110"
          />
        </Link>

        {/* Cachet — la signature, en bas-droite : les deux représentations du
            logo coexistent (tuile sur les surfaces compactes, signature ici).
            Décorative : la navigation reste sur la marque haut-gauche, deux
            liens identiques seraient du bruit clavier. */}
        <div aria-hidden="true" className="absolute bottom-8 right-8 z-10 xl:bottom-10 xl:right-10">
          <Wordmark tone="on-dark" />
        </div>
      </div>
    </div>
  );
}
