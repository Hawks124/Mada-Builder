import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Logo officiel Mada-Made — deux paires aux conventions OPPOSÉES
 * ("dark"/"light" = couleur de l'ARTWORK, pas le thème cible) :
 * - tile (défaut) : mm-sharper-dark (tuile claire + marque sombre) en
 *   thème clair, mm-sharper-light (tuile sombre + marque claire) en sombre.
 *   Carré 452² : taille carrée (h-X w-X).
 * - bare : mada-made-light (marque noire, transparent) en thème clair,
 *   mada-made-dark (marque blanche, transparent) en thème sombre. Marque
 *   verticale 362×488 : hauteur seule (h-X, JAMAIS w-… sinon distorsion).
 * La tuile porte son fond arrondi : aucun conteneur autour dans les deux
 * cas, seule une ombre portée optionnelle via className.
 *
 * `tone="on-dark"` : à utiliser sur un fond **toujours sombre** (panneau
 * photo). Force l'asset à marque blanche dans les deux thèmes — sinon le
 * repère de thème servirait la tuile claire sur la photo en thème clair, et
 * la marque noire deviendrait invisible. Rendue une seule fois, sans bascule
 * `dark:`. `auto` (défaut) ne change rien aux usages existants.
 */
export function LogoMark({
  variant = "tile",
  tone = "auto",
  className,
}: {
  variant?: "tile" | "bare";
  tone?: "auto" | "on-dark";
  className?: string;
}) {
  if (tone === "on-dark") {
    // Fond sombre garanti : la seule version lisible est la marque blanche.
    return variant === "bare" ? (
      <Image
        src="/logos/mada-made-dark.svg"
        alt="Mada-Made"
        width={362}
        height={488}
        priority
        className={cn("h-auto w-auto", className)}
      />
    ) : (
      <Image
        src="/logos/mm-sharper-light.svg"
        alt="Mada-Made"
        width={64}
        height={64}
        priority
        className={className}
      />
    );
  }

  if (variant === "bare") {
    return (
      <>
        <Image
          src="/logos/mada-made-light.svg"
          alt="Mada-Made"
          width={362}
          height={488}
          priority
          className={cn("h-auto w-auto dark:hidden", className)}
        />
        <Image
          src="/logos/mada-made-dark.svg"
          alt="Mada-Made"
          width={362}
          height={488}
          priority
          className={cn("hidden h-auto w-auto dark:block", className)}
        />
      </>
    );
  }
  return (
    <>
      <Image
        src="/logos/mm-sharper-dark.svg"
        alt="Mada-Made"
        width={64}
        height={64}
        priority
        className={cn("dark:hidden", className)}
      />
      <Image
        src="/logos/mm-sharper-light.svg"
        alt="Mada-Made"
        width={64}
        height={64}
        priority
        className={cn("hidden dark:block", className)}
      />
    </>
  );
}
