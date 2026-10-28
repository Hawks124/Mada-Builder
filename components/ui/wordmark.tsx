import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Signature manuscrite Mada-Made — lockup réservé à la navbar (les
 * surfaces compactes gardent la tuile `LogoMark`). Fichiers `*_nav_*`
 * recadrés une fois à l'encre (le canvas 2:1 d'origine ne laissait que
 * 44 % de mot utile) ; les originaux non recadrés restent pour /about.
 * Les deux tracés n'ayant pas les mêmes proportions, chaque variante est
 * recadrée à SA propre encre, normalisée à 85 % de la boîte : le mot garde
 * la même taille affichée dans les deux thèmes. Jamais de fond, d'ombre
 * ou de bordure — l'air restant autour du trait fait partie du dessin.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <>
      <Image
        src="/branding/mm_logo_nav_light.webp"
        alt="Mada-Made"
        width={1595}
        height={458}
        priority
        sizes="(min-width: 1024px) 168px, 152px"
        className={cn("h-11 w-auto lg:h-12 dark:hidden", className)}
      />
      <Image
        src="/branding/mm_logo_nav_dark.webp"
        alt="Mada-Made"
        width={1736}
        height={523}
        priority
        sizes="(min-width: 1024px) 168px, 152px"
        className={cn("hidden h-11 w-auto lg:h-12 dark:block", className)}
      />
    </>
  );
}
