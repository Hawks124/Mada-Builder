"use client";

import Link from "next/link";

/**
 * Bloc digest — **réservé aux membres, sans champ email**.
 *
 * Il n'existe aucune liste d'abonnés externe : les inscrits reçoivent le
 * récap automatiquement (opt-out en un clic : profil → notifications), et
 * les one-shot partent en Broadcasts sur l'audience synchronisée. Un champ
 * qui collecterait des adresses de visiteurs créerait une deuxième liste
 * à réconcilier — donc pas de champ : les membres sont déjà dedans, les
 * visiteurs s'inscrivent (gratuit, 1 clic social).
 *
 * Le footer est un composant serveur sans session : on ne distingue pas
 * connecté/non-connecté ici. Le CTA mène aux réglages — le proxy y envoie
 * les visiteurs via `/signin?next=/settings` (retour post-login) et les
 * membres directement (jamais de détour dashboard incompréhensible).
 */
export function DigestForm() {
  return (
    <div className="mt-4 flex flex-col gap-2.5">
      <p className="text-[12px] font-medium leading-relaxed text-muted-foreground">
        Réservé aux membres : le récap part tout seul, chaque lundi. Pas de liste externe, pas de
        spam — ça se règle dans les paramètres.
      </p>
      <Link
        href="/settings"
        className="inline-flex w-fit items-center gap-2 rounded-full bg-foreground px-4 py-2 text-[12px] font-bold text-background transition-opacity hover:opacity-90"
      >
        Gérer mes emails
      </Link>
    </div>
  );
}
