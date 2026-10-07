"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/toast";

/**
 * Watcher notifications (lot notifs) — INSERT sur SES lignes
 * (`notifications_select_own` : le Realtime ne délivre que user_id = soi).
 * Déclencheur pur (toast + refresh + pastille via re-render serveur),
 * silencieux si coupé — même philosophie que ban/appeals.
 */
export function useNotificationsWatcher(userId: string | null): void {
  const router = useRouter();

  React.useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    let channel: { unsubscribe: () => void } | null = null;

    try {
      const supabase = createClient();
      channel = supabase
        .channel(`notifications:${userId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            if (cancelled) return;
            const row = payload.new as { title?: string };
            toast(
              "info",
              typeof row.title === "string" && row.title !== ""
                ? row.title
                : "Nouvelle notification.",
            );
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
