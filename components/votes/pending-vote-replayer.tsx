"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { toggleVoteAction } from "@/app/actions/products";
import { toast } from "@/components/ui/toast";
import { PENDING_VOTE_KEY } from "@/components/votes/use-vote-wall";

/**
 * Replayer global du vote en attente (§15 : « le vote s'applique au
 * retour »). Monté une fois dans le layout racine : au retour de /signin
 * avec session, applique le vote stocké puis purge la clé (une seule
 * fois — jamais de double vote au re-render).
 */
export function PendingVoteReplayer() {
  const done = React.useRef(false);

  React.useEffect(() => {
    if (done.current) return;
    done.current = true;
    let productId: string | null = null;
    try {
      productId = window.localStorage.getItem(PENDING_VOTE_KEY);
    } catch {
      return;
    }
    if (!productId) return;
    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) return; // Toujours déconnecté : la clé attendra.
        const res = await toggleVoteAction({ productId: productId as string });
        try {
          window.localStorage.removeItem(PENDING_VOTE_KEY);
        } catch {
          // Purge best-effort (le flag done évite déjà le doublon local).
        }
        if (res.ok) {
          toast("ok", res.voted ? "Vote enregistré. Merci !" : "Vote retiré.");
        } else if (res.message) {
          toast("err", res.message);
        }
      } catch {
        // Silencieux : l'utilisateur revotera (jamais de toast fantôme).
      }
    })();
  }, []);

  return null;
}
