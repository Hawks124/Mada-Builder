import Link from "next/link";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";
import {
  HERO_CATEGORIES,
  PRODUCT_CATEGORIES,
  TOTAL_PRODUCT_COUNT,
} from "@/config/categories";
import { getMakersCount } from "@/services/users.service";

/**
 * Hero right column — continuous Vercel-style spinning border animation.
 * Features: floating stats bar globally aligned, flowing card list underneath.
 */
export async function HeroCategories() {
  const visible = HERO_CATEGORIES.slice(0, 7);

  // Vrai total makers quand le backend répond ; fallback démo sinon
  // (même pattern que hero-makers — pas de faux "400+" avec backend).
  let makersValue = "400+";
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const count = await getMakersCount();
      if (count > 0) makersValue = count.toLocaleString("fr-FR");
    } catch {
      // Backend indisponible : fallback ci-dessus.
    }
  }

  return (
    <div className="relative w-full flex flex-col gap-6">
      {/* ─── Stats Bar ─── */}
      <div className="flex items-center gap-2 pl-2">
        <StatPill
          value={TOTAL_PRODUCT_COUNT.toLocaleString("fr")}
          label="produits"
        />
        <div className="h-3.5 w-px bg-border/60 mx-1.5" />
        <StatPill value={makersValue} label="makers" />
        <div className="h-3.5 w-px bg-border/60 mx-1.5" />
        <StatPill
          value={String(PRODUCT_CATEGORIES.length)}
          label="catégories"
        />
      </div>

      {/* ─── VERCEL STYLE ANIMATED BORDER WRAPPER ─── */}
      <div className="relative group/panel overflow-hidden rounded-[10px] p-[1.5px] shadow-sm hover:shadow-md transition-shadow">
        {/* 1. Base unlit perimeter track */}
        <div className="absolute inset-0 bg-border/40" />

        {/* 
          2. The Racing Comets! 
          Two very sharp, high-contrast light beams chasing each other. 
          Light mode: Solid Black comet.
        */}
        <div
          className="absolute left-1/2 top-1/2 h-[200%] w-[200%] -translate-x-1/2 -translate-y-1/2 animate-[spin_3.5s_linear_infinite] dark:hidden opacity-30 group-hover/panel:opacity-80 transition-opacity duration-500"
          style={{
            background:
              "conic-gradient(from 0deg at 50% 50%, transparent 0%, transparent 40%, rgba(0,0,0,0.6) 48%, rgba(0,0,0,1) 50%, transparent 50%, transparent 90%, rgba(0,0,0,0.6) 98%, rgba(0,0,0,1) 100%)",
          }}
        />
        {/* Dark mode: Solid White comet. */}
        <div
          className="absolute left-1/2 top-1/2 h-[200%] w-[200%] -translate-x-1/2 -translate-y-1/2 animate-[spin_3.5s_linear_infinite] hidden dark:block opacity-30 group-hover/panel:opacity-80 transition-opacity duration-500"
          style={{
            background:
              "conic-gradient(from 0deg at 50% 50%, transparent 0%, transparent 40%, rgba(255,255,255,0.6) 48%, rgba(255,255,255,1) 50%, transparent 50%, transparent 90%, rgba(255,255,255,0.6) 98%, rgba(255,255,255,1) 100%)",
          }}
        />

        {/* ─── Main Card Surface ─── */}
        <div className="relative h-full w-full rounded-[8.5px] bg-background overflow-hidden">
          {/* Subtle noise/texture overlay just inside the card */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,0,0,0.01)_0%,transparent_100%)] dark:bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.03)_0%,transparent_100%)] pointer-events-none" />

          {/* Header row */}
          <div className="relative flex items-center justify-between px-5 py-4 border-b border-border/50 z-10">
            <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
              Écosystème
            </span>
            <Link
              href="/categories"
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground hover:text-foreground transition-colors group"
            >
              Tout voir
              <ArrowRightIcon
                weight="bold"
                className="h-3 w-3 group-hover:translate-x-0.5 transition-transform"
              />
            </Link>
          </div>

          {/* ─── Flow list ─── */}
          <ul className="relative z-10">
            {visible.map((cat, i) => {
              const Icon = cat.icon;
              const isLast = i === visible.length - 1;
              return (
                <li key={cat.id}>
                  <Link
                    href={`/categories/${cat.id}`}
                    className="group flex items-center gap-4 px-5 py-3.5 transition-colors duration-200 hover:bg-muted/50"
                  >
                    {/* Circle icon — gets full colour from config ON HOVER only */}
                    <span
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                        "border border-border/60 bg-muted/30 shadow-sm",
                        "transition-all duration-300",
                        cat.hoverBg,
                        "group-hover:shadow-md",
                      )}
                    >
                      <Icon
                        weight="duotone"
                        className={cn(
                          "h-4.5 w-4.5 transition-all duration-300 text-foreground/50",
                          cat.hoverColor,
                        )}
                      />
                    </span>

                    {/* Name + subtitle */}
                    <span className="flex flex-col min-w-0">
                      {/* Name gets colored on hover too */}
                      <span
                        className={cn(
                          "truncate text-[14px] font-semibold text-foreground leading-tight transition-colors",
                          cat.hoverColor,
                        )}
                      >
                        {cat.name}
                      </span>
                      <span className="truncate text-[11px] text-muted-foreground/80 mt-0.5 leading-tight">
                        {cat.subtitle}
                      </span>
                    </span>

                    {/* Count gets colored on hover too */}
                    <span
                      className={cn(
                        "ml-auto shrink-0 text-[13px] font-bold tabular-nums text-muted-foreground transition-colors",
                        cat.hoverColor,
                      )}
                    >
                      {cat.count}
                    </span>
                  </Link>

                  {!isLast && <div className="mx-5 h-px bg-border/40" />}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

function StatPill({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-[19px] font-extrabold text-foreground leading-none tabular-nums tracking-tight">
        {value}
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
    </div>
  );
}
