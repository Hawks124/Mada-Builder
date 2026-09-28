import Link from "next/link";
import { TrendDownIcon, TrendUpIcon } from "@phosphor-icons/react/dist/ssr";
import { cn, formatMoney, slugifyName } from "@/lib/utils";
import { getCategoryById } from "@/config/categories";
import { getLifecycleById } from "@/config/lifecycle";
import { AvatarImage } from "@/components/ui/avatar-image";
import { LifecyclePill } from "@/components/ui/lifecycle-pill";
import { RevenueBadge } from "./verified-revenue-badge";
import { RevenueTrend } from "./revenue-trend";
import { getCatalog } from "@/services/catalog-mock.service";
import { getRevenueRecords } from "@/services/revenue-mock.service";
import { formatSyncedLabel } from "./revenue-derive";
import type { RevenueView } from "./revenue-types";

/**
 * Classement `/revenue`.
 *
 * **Une seule colonne, pleine largeur.** Pas une grille 3 colonnes : le nombre
 * de produits vérifiés sera faible par construction (il faut que le maker
 * connecte une clé Stripe ou RevenueCat), donc une grille afficherait des trous
 * et semblerait cassée. 1, 3 ou 24 entrées, la page a la même allure — elle
 * grandit, elle ne se recompose pas.
 *
 * Le rang n'est attribué qu'aux produits qui **publient** leur MRR. Ceux dont le
 * maker a choisi le mode badge seul n'apparaissent pas ici : classer par
 * grandeur un produit qui a masqué la sienne n'aurait pas de sens. Leur
 * vérification reste visible ailleurs — fiche, profil maker, card de la home.
 *
 * La ligne est un `<div>` et non un `<Link>` : c'est ce qui permet d'y faire
 * coexister plusieurs liens (fiche, maker, catégorie) sans imbrication
 * invalide. Même structure que `components/ranking/leaderboard-list.tsx`.
 */

/** Même codification de rang que le leaderboard : l'œil monte sans traitement spécial. */
const RANK_CLASS: Record<number, string> = {
  1: "text-amber-500 dark:text-amber-400",
  2: "text-zinc-400 dark:text-zinc-300",
  3: "text-orange-600 dark:text-orange-400",
};

export function RevenueRanking() {
  const products = new Map(getCatalog().map((p) => [p.id, p]));
  const ranked = getRevenueRecords()
    .filter((r) => r.displayMode === "full")
    .sort((a, b) => b.mrrCents - a.mrrCents);

  const totalMrr = ranked.reduce((n, r) => n + r.mrrCents, 0);

  return (
    <div className="flex flex-col">
      {/* ── Ligne de stats ── */}
      <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 pb-4 border-b border-border/40 text-[15px] font-medium text-muted-foreground">
        <span className="text-foreground font-black tabular-nums">{ranked.length}</span>
        <span>{ranked.length > 1 ? "produits classés" : "produit classé"}</span>
        <span className="text-border select-none" aria-hidden="true">
          ·
        </span>
        <span className="text-foreground font-black tabular-nums">
          {formatMoney(totalMrr, "USD", { compact: true, maximumFractionDigits: 1 })}
        </span>
        <span>de MRR cumulé</span>
      </p>

      {ranked.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col">
          {ranked.map((record, i) => {
            const product = products.get(record.productId);
            if (!product) return null;

            const view: RevenueView = {
              provider: record.provider,
              displayMode: record.displayMode,
              mrrCents: record.mrrCents,
              arrCents: record.arrCents,
              activeSubscribers: record.activeSubscribers,
              lastSyncedAt: record.lastSyncedAt,
              history: record.history,
            };
            const first = record.history[0] ?? record.mrrCents;
            const last = record.history[record.history.length - 1] ?? record.mrrCents;
            const delta = first > 0 ? ((last - first) / first) * 100 : 0;
            const up = delta >= 0;

            const category = getCategoryById(product.categoryId);
            const lifecycle = getLifecycleById(product.lifecycle);

            return (
              <div
                key={record.productId}
                className="group relative flex flex-col gap-7 py-8 min-w-0"
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-0 -inset-y-1 rounded-xl bg-muted/40 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
                />

                {/* ── Identité, montant, évolution ── */}
                <div className="relative flex items-start gap-5">
                  <span
                    className={cn(
                      "w-7 shrink-0 pt-2.5 text-[12px] font-black tabular-nums",
                      RANK_CLASS[i + 1] ?? "text-muted-foreground/50",
                    )}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>

                  <Link
                    href={`/products/${product.id}`}
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br text-[13px] font-black text-white transition-transform duration-200 group-hover:scale-105",
                      product.iconGradient,
                    )}
                  >
                    {product.initials}
                  </Link>

                  <div className="flex-1 min-w-0 pt-1">
                    <Link
                      href={`/products/${product.id}`}
                      className="block max-w-full focus-visible:outline-none"
                    >
                      <h3 className="truncate text-lg font-extrabold tracking-tight text-foreground transition-colors group-hover:text-primary">
                        {product.name}
                      </h3>
                    </Link>

                    <p className="mt-0.5 truncate text-[13px] font-medium text-muted-foreground">
                      {product.tagline}
                    </p>

                    {/* ── Meta : maker, catégorie, provider, échelle, fraîcheur ── */}
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-muted-foreground">
                      <Link
                        href={`/makers/${slugifyName(product.maker)}`}
                        className="inline-flex items-center gap-1.5 font-bold text-foreground/80 transition-colors hover:text-foreground"
                      >
                        <AvatarImage
                          src={product.makerAvatar}
                          name={product.maker}
                          size={16}
                          className="grayscale transition-all group-hover:grayscale-0"
                        />
                        {product.maker}
                      </Link>

                      <Dot />

                      {category && (
                        <Link
                          href={`/categories/${category.id}`}
                          className="transition-colors hover:text-foreground"
                        >
                          {category.name}
                        </Link>
                      )}

                      <Dot />

                      <RevenueBadge revenue={view} mode="sans-montant" size="sm" />

                      <Dot />

                      {/* L'échelle : 4 000 $ avec 20 abonnés et avec 900, ce n'est
                          pas le même produit. Le seul chiffre qui contextualise
                          le MRR. */}
                      <span className="tabular-nums">
                        {record.activeSubscribers.toLocaleString("fr-FR")} abonnés
                      </span>

                      <Dot />

                      <span>{formatSyncedLabel(record.syncedMinutesAgo)}</span>

                      {/* Avancement affiché seulement quand il dérange : « Lancé »
                          sur 15 lignes sur 17 serait du bruit, « Bêta » sur une
                          seule ligne est un signal. */}
                      {lifecycle.id !== "live" && <LifecyclePill lifecycleId={product.lifecycle} />}
                    </div>
                  </div>

                  <div className="shrink-0 flex flex-col items-end gap-1.5">
                    <span className="text-2xl font-black tabular-nums tracking-tighter text-emerald-600 dark:text-emerald-400 leading-none">
                      {formatMoney(record.mrrCents, "USD", {
                        maximumFractionDigits: 0,
                      })}
                    </span>
                    <span
                      className={cn(
                        "flex items-center gap-1 text-[12px] font-bold tabular-nums",
                        up
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-500 dark:text-red-400",
                      )}
                    >
                      {up ? (
                        <TrendUpIcon weight="bold" className="h-3 w-3" />
                      ) : (
                        <TrendDownIcon weight="bold" className="h-3 w-3" />
                      )}
                      {up ? "+" : ""}
                      {delta.toFixed(0)} % sur 90 j
                    </span>
                  </div>
                </div>

                {/* ── Courbe annotée : référence 90 j, point actuel, creux ── */}
                <div className="relative flex items-end gap-4 pl-12">
                  <RevenueTrend points={record.history} height={40} className="flex-1" />
                  <span className="shrink-0 pb-1 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">
                    90 jours
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Dot() {
  return (
    <span className="text-border select-none" aria-hidden="true">
      ·
    </span>
  );
}

/**
 * État vide — jamais « aucun résultat ». Comme il y aura peu de produits
 * vérifiés au lancement (PRD §18), c'est un état de premier ordre : on
 * explique ce qui va arriver et on donne la marche à suivre au maker.
 *
 * La bande « comment ça fonctionne » n'est pas répétée ici : la page la porte
 * déjà au-dessus du classement.
 */
function EmptyState() {
  return (
    <div className="flex flex-col gap-5 max-w-2xl pt-12">
      <h2 className="text-2xl font-extrabold tracking-tighter text-foreground leading-tight">
        Le classement est vide. Il se remplira tout seul.
      </h2>
      <p className="text-[15px] font-medium leading-relaxed text-muted-foreground">
        Personne ne publie son revenu tout seul : il faut connecter une clé Stripe ou RevenueCat en
        lecture seule. Le montant est ensuite lu chez le prestataire, chaque heure, sans
        intervention.
      </p>
      <Link
        href="/products/submit"
        className="self-start text-[14px] font-bold text-foreground hover:text-primary transition-colors"
      >
        Publier un produit et connecter une clé →
      </Link>
    </div>
  );
}
