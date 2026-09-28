import Image from "next/image";
import type { ReactNode } from "react";
import { ChartLineUpIcon, KeyIcon, SealCheckIcon } from "@phosphor-icons/react/dist/ssr";

/**
 * « Comment la vérification fonctionne » — bande de 3 étapes.
 *
 * Sur `/revenue` c'est du **contenu de page**, pas une modale. La page dont la
 * seule raison d'être est la crédibilité ne peut pas enfermer son argument de
 * crédibilité derrière un clic : le visiteur doit lire *pourquoi il devrait
 * croire ce chiffre* au moment exact où il commence à en douter. Trois
 * conséquences :
 *
 * - le contenu est indexable (une modale ne l'est pas) ;
 * - c'est aussi le contenu de l'état vide — quand la page n'a encore aucun
 *   produit, c'est la bande qui explique ce qui va s'y passer, pas un
 *   « aucun résultat » qui ressemble à un échec ;
 * - le bouton « Comment ça marche ? » disparaît de la page : on ne place pas
 *   une méthode quand la page *est* la méthode. Il reste sur la home, où il
 *   n'y a pas la place d'une bande et où la question « pourquoi vous croire »
 *   arrive plus tard.
 *
 * Le texte est repris de `components/home/how-it-work.tsx` (le slide-over de la
 * home) : rien n'est perdu, c'est juste sorti de la modale.
 */
export function RevenueMethod({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-y-10 gap-x-12">
        <Step
          n={1}
          icon={<KeyIcon weight="fill" className="h-3.5 w-3.5" />}
          title="Le maker connecte sa clé"
          tone="emerald"
        >
          Depuis son dashboard, le maker crée une clé{" "}
          <strong className="text-foreground">restreinte, en lecture seule</strong> chez son
          prestataire. Elle ne peut ni déclencher un paiement, ni initier un remboursement, ni voir
          la moindre donnée client. Il garde le contrôle et peut la révoquer à tout moment.
          <span className="mt-4 flex items-center gap-4">
            <Image
              src="/logos/stripe.svg"
              alt="Stripe"
              width={64}
              height={16}
              style={{ width: "auto", height: "16px" }}
              className="h-4 w-auto opacity-45"
            />
            <Image
              src="/logos/revenuecat.svg"
              alt="RevenueCat"
              width={64}
              height={16}
              style={{ width: "auto", height: "16px" }}
              className="h-4 w-auto opacity-45"
            />
          </span>
        </Step>

        <Step
          n={2}
          icon={<ChartLineUpIcon weight="fill" className="h-3.5 w-3.5" />}
          title="Nous lisons, chaque heure"
          tone="neutral"
        >
          Une tâche automatique interroge l&apos;API et n&apos;extrait que le{" "}
          <strong className="text-foreground">MRR actif</strong> : les essais gratuits, les
          abonnements impayés et les résiliations sont exclus. Seul l&apos;argent récurrent est
          compté. Le total est rafraîchi toutes les heures.
        </Step>

        <Step
          n={3}
          icon={<SealCheckIcon weight="fill" className="h-3.5 w-3.5" />}
          title="Le chiffre est publié tel quel"
          tone="neutral"
        >
          Ni le maker ni un admin ne peuvent éditer ce montant. Un maker qui préfère ne pas publier
          son chiffre peut appliquer le mode <strong className="text-foreground">badge seul</strong>{" "}
          : la vérification reste visible, le montant reste privé.
        </Step>
      </div>
    </div>
  );
}

function Step({
  n,
  icon,
  title,
  tone,
  children,
}: {
  n: number;
  icon: ReactNode;
  title: string;
  tone: "emerald" | "neutral";
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span
          className={
            tone === "emerald"
              ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/60 bg-muted/50 text-muted-foreground"
          }
        >
          {icon}
        </span>
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground tabular-nums">
          Étape {n}
        </span>
      </div>
      <h3 className="text-[15px] font-extrabold tracking-tight text-foreground">{title}</h3>
      <p className="text-[14px] font-medium leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}
