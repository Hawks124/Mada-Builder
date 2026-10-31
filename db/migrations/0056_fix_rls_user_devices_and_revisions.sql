-- 0056 — Correction RLS des deux trous confirmés par la revue CodeRabbit
-- (PR #11). Les migrations appliquées ne se touchent JAMAIS : 0053
-- matérialisait USING (true) sur user_devices (un caller réécrivait
-- user_id de N'IMPORTE quelle ligne sans WHERE → lecture de tous les
-- tokens FCM) et un OR trop large sur les révisions (une révision
-- posable sur la fiche d'AUTRUI → empoisonnement de la file de
-- modération). La base reste l'arbitre : les policies sont corrigées
-- ici, le contrat mobile (docs/mobile-ecritures-directes.md) ne change
-- pas — la correction est invisible pour l'app tant qu'elle n'écrit que
-- ses propres lignes.

-- user_devices : ne viser que ses propres lignes ou les appareils
-- invités (user_id NULL, réclamables au login). Pour anon, auth.uid()
-- est NULL → seul `user_id IS NULL` matche : anon continue d'écrire ses
-- appareils invités sans pouvoir toucher les lignes d'autrui.
-- Risque résiduel documenté (CodeRabbit) : une ligne invité reste
-- réclamable par n'importe quel caller — la fermer demandera un RPC
-- SECURITY DEFINER vérifiant le token (côté squad mobile), hors V1.
DROP POLICY IF EXISTS "user_devices_update_policy" ON public.user_devices;
--> statement-breakpoint
CREATE POLICY "user_devices_update_policy"
ON public.user_devices FOR UPDATE
TO anon, authenticated
USING (user_id IS NULL OR user_id = auth.uid())
WITH CHECK (user_id IS NULL OR user_id = auth.uid());
--> statement-breakpoint
-- product_revisions : le maker doit être À LA FOIS le maker_id de la
-- révision ET le maker de la fiche ciblée (AND, pas OR) — une révision
-- ne peut plus naître que sur une fiche qu'on possède.
DROP POLICY IF EXISTS "product_revisions_insert_own" ON public.product_revisions;
--> statement-breakpoint
CREATE POLICY "product_revisions_insert_own"
ON public.product_revisions FOR INSERT
TO authenticated
WITH CHECK (
  maker_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = product_revisions.product_id AND p.maker_id = auth.uid()
  )
);
