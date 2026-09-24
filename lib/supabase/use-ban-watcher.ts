"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/toast";

/**
 * Watcher ban/déban temps réel — monté là où un user connecté persiste
 * (DashboardShell, UserMenu). Écoute sa PROPRE ligne users (RLS
 * `users_select_own` couvre déjà cette lecture, authenticated own-row).
 *
 * Philosophie : le serveur reste la vérité — le realtime n'est qu'un
 * DÉCLENCHEUR de refresh (toast + `router.refresh()`, le layout re-rend
 * verrou ou dashboard). Aucune logique métier dupliquée côté client,
 * aucun état divergent possible.
 *
 * Dégradation gracieuse : Realtime injoignable/coupé = silencieux (le
 * refresh manuel et la prochaine navigation prennent le relais — jamais
 * de faux "non banni" affiché comme une certitude).
 */
export function useBanWatcher(userId: string | null): void {
  const router = useRouter();
  const stateRef = React.useRef<{ banned: boolean | null }>({ banned: null });

  React.useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    let channel: { unsubscribe: () => void } | null = null;

    try {
      const supabase = createClient();
      channel = supabase
        .channel(`user-ban:${userId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "users",
            filter: `id=eq.${userId}`,
          },
          (payload) => {
            if (cancelled) return;
            const record = payload.new as { banned_at?: string | null };
            const banned = !!record.banned_at;
            if (stateRef.current.banned === null) {
              // Premier snapshot : calibre sans bruit.
              stateRef.current.banned = banned;
              return;
            }
            if (stateRef.current.banned === banned) return;
            stateRef.current.banned = banned;
            if (banned) {
              toast("err", "Compte suspendu.");
            } else {
              toast("ok", "Compte rétabli. Bienvenue !");
            }
            router.refresh();
          },
        )
        .subscribe();
    } catch {
      // Realtime indisponible : silencieux (navigation/refresh en relais).
    }

    return () => {
      cancelled = true;
      try {
        channel?.unsubscribe();
      } catch {
        /* ignore */
      }
    };
  }, [userId, router]);
}
