"use client";

import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Mur auth des votes (PRD §15) : sans session → /signin?next=<page>,
 * avec session → exécute l'action. Le milestone votes branchera la
 * Server Action réelle à l'intérieur du callback — le mur reste intact.
 */
export function useVoteWall() {
  const router = useRouter();
  const pathname = usePathname();

  const guardedVote = async (fn: () => void | Promise<void>) => {
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push(`/signin?next=${encodeURIComponent(pathname)}`);
        return;
      }
    } catch {
      // Backend non configuré : retomber sur le mur (jamais de vote fantôme).
      router.push(`/signin?next=${encodeURIComponent(pathname)}`);
      return;
    }
    await fn();
  };

  return guardedVote;
}
