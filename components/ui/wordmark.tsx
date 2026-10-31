import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Signature manuscrite Mada-Made — lockup réservé à la navbar (les
 * surfaces compactes gardent la tuile `LogoMark`). Fichiers `*_nav_*`
 * recadrés une fois à l'encre (le canvas 2:1 d'origine ne laissait que
 * 44 % de mot utile) ; les originaux non recadrés restent pour /about.
 * Les deux tracés n'ayant pas les mêmes proportions, chaque variante est
 * recadrée à SA propre encre, normalisée à 85 % de la boîte : le mot garde
 * la même taille affichée dans les deux thèmes. `tone="on-dark"` force la
 * variante blanche : fonds sombres garantis (panneau photo), quel que soit
 * le thème. Jamais de fond, d'ombre ou de bordure — l'air restant autour
 * du trait fait partie du dessin.
 */
export function Wordmark({
  className,
  tone = "auto",
}: {
  className?: string;
  tone?: "auto" | "on-dark";
}) {
  if (tone === "on-dark") {
    return (
      <Image
        src="/branding/mm_logo_nav_dark.webp"
        alt="Mada-Made"
        width={1736}
        height={523}
        priority
        sizes="144px"
        className={cn("h-8 w-auto", className)}
      />
    );
  }
  return (
    <>
      <Image
        src="/branding/mm_logo_nav_light.webp"
        alt="Mada-Made"
        width={1595}
        height={458}
        priority
        sizes="144px"
        className={cn("h-8 w-auto dark:hidden", className)}
      />
      <Image
        src="/branding/mm_logo_nav_dark.webp"
        alt="Mada-Made"
        width={1736}
        height={523}
        priority
        sizes="144px"
        className={cn("hidden h-8 w-auto dark:block", className)}
      />
    </>
  );
}
