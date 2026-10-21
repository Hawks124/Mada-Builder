"use client";

import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Mur auth des votes (PRD §15) : sans session → vote mis en attente
 * (localStorage) + /signin?next=<page> ; au retour, le replayer global
 * l'applique (le vote n'est jamais perdu). Avec session → exécute.
 * Le milestone votes branche la Server Action réelle à l'intérieur du
 * callback — le mur reste intact.
 *
 * `onBlocked` : appelé quand le mur bloque (pas de session) — permet de
 * REVERTIR l'update optimiste déjà affichée. Indispensable : le bouton
 * doit appliquer son état optimiste AU CLIC (un clic qui attend un
 * aller-retour réseau n'est pas perçu comme instantané), le mur ne
 * tranche qu'ensuite.
 */
export const PENDING_VOTE_KEY = "mm-pending-vote";

export function useVoteWall(productId?: string) {
  const router = useRouter();
  const pathname = usePathname();

  const guardedVote = async (fn: () => void | Promise<void>, opts?: { onBlocked?: () => void }) => {
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        // Vote en attente : rejoué au retour (replayer global du layout).
        if (productId) {
          try {
            window.localStorage.setItem(PENDING_VOTE_KEY, productId);
          } catch {
            // Stockage indisponible : redirect seul, l'utilisateur revotera.
          }
        }
        opts?.onBlocked?.();
        router.push(`/signin?next=${encodeURIComponent(pathname)}`);
        return;
      }
    } catch {
      // Backend non configuré : retomber sur le mur (jamais de vote fantôme).
      opts?.onBlocked?.();
      router.push(`/signin?next=${encodeURIComponent(pathname)}`);
      return;
    }
    await fn();
  };

  return guardedVote;
}
