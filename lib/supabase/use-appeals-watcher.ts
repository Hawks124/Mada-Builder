"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/toast";

/**
 * Watcher nouveaux appels (panel admin) — event, pas polling (le polling
 * coûtait 2 vérifications Auth toutes les 10 s en permanence).
 * Channel `appeals:inserts` → INSERT sur public.appeals → toast + refresh
 * (file rechargée, liens signés frais). RLS `appeals_select_staff` : seuls
 * admin/modérateur reçoivent (deny-all pour les autres — voulu).
 * Silencieux si coupé (le refresh manuel reste).
 */
export function useAppealsWatcher(active: boolean): void {
  const router = useRouter();

  React.useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let channel: { unsubscribe: () => void } | null = null;

    try {
      const supabase = createClient();
      channel = supabase
        .channel("appeals:inserts")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "appeals",
          },
          () => {
            if (cancelled) return;
            toast("info", "Nouvel appel à examiner.");
            router.refresh();
          },
        )
        .subscribe();
    } catch {
      // Realtime indisponible : silencieux (refresh manuel en relais).
    }

    return () => {
      cancelled = true;
      try {
        channel?.unsubscribe();
      } catch {
        /* ignore */
      }
    };
  }, [active, router]);
}
