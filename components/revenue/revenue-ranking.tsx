import Link from "next/link";
import { TrendDownIcon, TrendUpIcon } from "@phosphor-icons/react/dist/ssr";
import { cn, formatMoney, slugifyName } from "@/lib/utils";
import { getCategoryById } from "@/config/categories";
import { getLifecycleById } from "@/config/lifecycle";
import { AvatarImage } from "@/components/ui/avatar-image";
import { LifecyclePill } from "@/components/ui/lifecycle-pill";
import { RevenueBadge } from "./verified-revenue-badge";
import { RevenueTrend } from "./revenue-trend";
import type { RankedRevenue } from "@/services/revenue/views";

/**
 * Classement `/revenue` (données réelles en props — jamais de mock).
 *
 * **Une seule colonne, pleine largeur.** Pas une grille 3 colonnes : le nombre
 * de produits vérifiés sera faible par construction (il faut que le maker
 * connecte une clé), donc une grille afficherait des trous et semblerait
 * cassée. 1, 3 ou 24 entrées, la page a la même allure — elle grandit, elle
 * ne se recompose pas.
 *
 * Le rang n'est attribué qu'aux produits qui **publient** leur MRR (connexion
 * `active`, mode `full`, ≥1 snapshot). Zéro conversion : un onglet par
 * devise, chacun son rang et son cumul.
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

export function RevenueRanking({
  groups,
  currency,
}: {
  groups: { currency: string; totalMrrCents: number; count: number; items: RankedRevenue[] }[];
  currency: string;
}) {
  const group = groups.find((g) => g.currency === currency) ?? groups[0];
  const ranked = group?.items ?? [];
  const totalMrr = group?.totalMrrCents ?? 0;
  const activeCurrency = group?.currency ?? currency;

  return (
    <div className="flex flex-col">
      {/* ── Onglets devise (zéro conversion : chaque devise son classement) ── */}
      {groups.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 pb-4">
          {groups.map((g) => (
            <Link
              key={g.currency}
              href={`/revenue?currency=${g.currency}`}
              aria-current={g.currency === activeCurrency ? "page" : undefined}
              className={cn(
                "px-4 py-1.5 rounded-full text-[13px] font-bold transition-all",
                g.currency === activeCurrency
                  ? "bg-foreground text-background"
                  : "bg-muted/50 text-muted-foreground hover:text-foreground border border-border/40",
              )}
            >
              {g.currency} · {g.count}
            </Link>
          ))}
        </div>
      )}

      {/* ── Ligne de stats ── */}
      <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 pb-4 border-b border-border/40 text-[15px] font-medium text-muted-foreground">
        <span className="text-foreground font-black tabular-nums">{ranked.length}</span>
        <span>{ranked.length > 1 ? "produits classés" : "produit classé"}</span>
        <span className="text-border select-none" aria-hidden="true">
          ·
        </span>
        <span className="text-foreground font-black tabular-nums">
          {formatMoney(totalMrr, activeCurrency, { compact: true, maximumFractionDigits: 1 })}
        </span>
        <span>de MRR cumulé ({activeCurrency})</span>
      </p>

      {ranked.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col">
          {ranked.map((record, i) => {
            const first = record.history[0] ?? record.mrrCents;
            const last = record.history[record.history.length - 1] ?? record.mrrCents;
            const delta = first > 0 ? ((last - first) / first) * 100 : 0;
            const up = delta >= 0;

            const category = getCategoryById(record.categoryId);
            const lifecycle = getLifecycleById(record.lifecycle);

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
                    aria-hidden="true"
                    className={cn(
                      "w-7 shrink-0 pt-2.5 text-[12px] font-black tabular-nums",
                      RANK_CLASS[i + 1] ?? "text-muted-foreground/50",
                    )}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>

                  <Link
                    href={`/products/${record.slug}`}
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br text-[13px] font-black text-white transition-transform duration-200 group-hover:scale-105",
                      record.iconGradient,
                    )}
                  >
                    {record.initials}
                  </Link>

                  <div className="flex-1 min-w-0 pt-1">
                    <Link
                      href={`/products/${record.slug}`}
                      className="block max-w-full focus-visible:outline-none"
                    >
                      <h3 className="truncate text-lg font-extrabold tracking-tight text-foreground transition-colors group-hover:text-primary">
                        {record.name}
                      </h3>
                    </Link>

                    <p className="mt-0.5 truncate text-[13px] font-medium text-muted-foreground">
                      {record.tagline}
                    </p>

                    {/* ── Meta : maker, catégorie, provider, échelle, fraîcheur ── */}
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-muted-foreground">
                      <Link
                        href={`/makers/${record.makerUsername || slugifyName(record.makerDisplayName)}`}
                        className="inline-flex items-center gap-1.5 font-bold text-foreground/80 transition-colors hover:text-foreground"
                      >
                        <AvatarImage
                          src={record.makerAvatarUrl}
                          name={record.makerDisplayName}
                          size={16}
                          className="grayscale transition-all group-hover:grayscale-0"
                        />
                        {record.makerDisplayName}
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

                      <RevenueBadge
                        revenue={{
                          provider: record.provider,
                          displayMode: "full",
                          mrrCents: record.mrrCents,
                          arrCents: record.mrrCents * 12,
                          activeSubscribers: record.subscriberCount,
                          currency: activeCurrency,
                          lastSyncedAt: record.lastSyncedAt,
                          lastSyncedLabel: record.lastSyncedLabel,
                          history: record.history,
                        }}
                        mode="sans-montant"
                        size="sm"
                      />

                      <Dot />

                      {/* L'échelle : 4 000 $ avec 20 abonnés et avec 900, ce n'est
                          pas le même produit. Le seul chiffre qui contextualise
                          le MRR. */}
                      <span className="tabular-nums">
                        {record.subscriberCount.toLocaleString("fr-FR")} abonnés
                      </span>

                      <Dot />

                      <span>{record.lastSyncedLabel}</span>

                      {/* Avancement affiché seulement quand il dérange : « Lancé »
                          sur 15 lignes sur 17 serait du bruit, « Bêta » sur une
                          seule ligne est un signal. */}
                      {lifecycle.id !== "live" && <LifecyclePill lifecycleId={record.lifecycle} />}
                    </div>
                  </div>

                  <div className="shrink-0 flex flex-col items-end gap-1.5">
                    <span className="text-2xl font-black tabular-nums tracking-tighter text-emerald-600 dark:text-emerald-400 leading-none">
                      {formatMoney(record.mrrCents, activeCurrency, {
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
        Personne ne publie son revenu tout seul : il faut connecter une clé en lecture seule
        (Stripe, RevenueCat, Paddle, Polar ou Lemon Squeezy). Le montant est ensuite lu chez le
        prestataire, chaque heure, sans intervention.{" "}
        <Link
          href="/guides/revenus-verifies"
          className="font-bold text-foreground underline underline-offset-4"
        >
          Mode d&apos;emploi
        </Link>
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
