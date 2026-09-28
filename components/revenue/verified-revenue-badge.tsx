// Entrée `/dist/ssr` et non l'entrée client : ce composant est rendu par des
// pages **serveur** (`/revenue`, la home), et l'entrée client de Phosphor
// utilise `createContext` — elle explose dans le graphe RSC avec
// « createContext only works in Client Components ».
import { SealCheckIcon } from "@phosphor-icons/react/dist/ssr";
import Image from "next/image";
import { cn, formatMoney } from "@/lib/utils";
import { REVENUE_PROVIDERS, type RevenueView } from "./revenue-types";

/**
 * Le badge de revenus vérifiés — l'unité atomique de la feature.
 *
 * Il apparaît sur la carte produit, les lignes de discover, le profil maker, le
 * classement `/revenue` et la fiche produit : il est donc fait pour être lu
 * entre 11px et 15px, dans une ligne dense comme dans un bloc.
 *
 * Choix de fond : le badge s'identifie par **le fournisseur**, pas par un sceau
 * vert générique. « Lu directement depuis Stripe, en accès lecture seule » est
 * une affirmation vérifiable ; « vérifié » tout court ne l'est pas. C'est ce qui
 * fait que le badge semble mérité plutôt que décoratif (PRD §15). Le vert reste
 * réservé à l'argent.
 *
 * Le mode est le correctif du « composant générique » : un même composant qui
 * répète le montant là où il est déjà affiché à côté devient du bruit. D'où
 * `sans-montant` pour le classement et la fiche.
 *
 * Volontairement un `<span>` et non un `<Link>` : il vit à l'intérieur de
 * liens, et un lien dans un lien est invalide. Le lien vers la méthodologie
 * vit dans `RevenueMethod` et `RevenueBlock`.
 */
export type RevenueBadgeMode = "montant" | "texte" | "sans-montant";

export function RevenueBadge({
  revenue,
  mode = "montant",
  size = "sm",
  className,
}: {
  revenue: RevenueView;
  /** `montant` : logo + sceau + chiffre · `texte` : + « Vérifié » · `sans-montant` : logo + sceau seuls. */
  mode?: RevenueBadgeMode;
  size?: "sm" | "md";
  className?: string;
}) {
  const provider = REVENUE_PROVIDERS[revenue.provider];
  const masked = revenue.displayMode === "badge_only";
  const showAmount = mode === "montant" && !masked;
  const showWord = mode === "texte" || size === "md";

  const title = masked
    ? `Revenus vérifiés — montant masqué par le maker. Clé ${provider.label} en lecture seule, rafraîchie toutes les heures.`
    : `MRR lu directement depuis ${provider.label}, accès en lecture seule, rafraîchi toutes les heures. Aucun chiffre saisi à la main.`;

  return (
    <span
      title={title}
      className={cn("inline-flex items-center gap-1.5 whitespace-nowrap align-middle", className)}
    >
      <Image
        src={provider.logo}
        alt=""
        aria-hidden="true"
        width={size === "md" ? 16 : 13}
        height={size === "md" ? 16 : 13}
        className={cn("shrink-0 object-contain", size === "md" ? "h-4" : "h-3")}
      />
      <SealCheckIcon
        weight="fill"
        aria-hidden="true"
        className={cn(
          "shrink-0 text-emerald-600 dark:text-emerald-400",
          size === "md" ? "h-4 w-4" : "h-3.5 w-3.5",
        )}
      />
      {showWord && (
        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
          Vérifié
        </span>
      )}
      {showAmount && (
        <span
          className={cn(
            "font-bold tabular-nums text-emerald-600 dark:text-emerald-400",
            size === "md" ? "text-[13px]" : "text-[12px]",
          )}
        >
          {formatMoney(revenue.mrrCents, "USD", { compact: true })}
        </span>
      )}
    </span>
  );
}
