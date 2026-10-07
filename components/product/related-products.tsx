import { ArrowRightIcon, CaretUpIcon } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { AvatarImage } from "@/components/ui/avatar-image";
import { cn } from "@/lib/utils";
import { getCategoryById } from "@/config/categories";

/** Ligne liée (vue carte) — miroir de `getRelatedProducts` (service seule source). */
export type RelatedItem = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  iconUrl: string | null;
  iconGradient: string;
  initials: string;
  votes: number;
  makerUsername: string;
  makerDisplayName: string;
  makerAvatarUrl: string | null;
};

/**
 * Produits liés — même catégorie, hors fiche courante, par score.
 * Données réelles ; vide = section absente (pas de remplissage factice).
 */
export function RelatedProducts({
  items,
  categoryId,
}: {
  items: RelatedItem[];
  categoryId: string;
}) {
  const category = getCategoryById(categoryId);
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-6 pt-10 border-t border-border/40">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-extrabold tracking-tight">
          Plus dans {category?.name ?? "cette catégorie"}
        </h2>
        {category && (
          <Link
            href={`/categories/${category.id}`}
            className="text-[12px] font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors group"
          >
            Tout voir{" "}
            <ArrowRightIcon
              weight="bold"
              className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform"
            />
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {items.map((p) => (
          <div
            key={p.id}
            className="group flex flex-col gap-4 p-5 rounded-3xl border border-border/40 bg-muted/10 hover:bg-muted/20 hover:border-border/60 hover:-translate-y-0.5 transition-all duration-300"
          >
            {/* Row 1: Icon + Votes */}
            <div className="flex items-start justify-between">
              {p.iconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.iconUrl}
                  alt={`Logo de ${p.name}`}
                  className="w-14 h-14 rounded-2xl shrink-0 object-cover bg-muted/20"
                />
              ) : (
                <div
                  className={cn(
                    "w-14 h-14 rounded-2xl shrink-0 relative overflow-hidden shadow-sm transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-2 bg-linear-to-br flex items-center justify-center text-white font-black text-xl",
                    p.iconGradient,
                  )}
                >
                  {p.initials}
                  <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              )}
              {/* Vote pill — compact */}
              <div className="flex items-center gap-1 shrink-0 bg-background border border-border/50 rounded-full px-2 py-0.5 text-[11px] font-bold text-foreground group-hover:text-emerald-500 group-hover:border-emerald-500/20 group-hover:bg-emerald-500/5 transition-colors shadow-sm mt-1">
                <CaretUpIcon weight="bold" className="w-3 h-3 -mt-px" />
                {p.votes}
              </div>
            </div>

            {/* Row 2: Name + tagline */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col min-w-0">
                <Link href={`/products/${p.slug}`} className="w-fit">
                  <span className="text-[15px] font-extrabold text-foreground tracking-tight leading-tight group-hover:text-primary transition-colors">
                    {p.name}
                  </span>
                </Link>
                <span className="text-[12px] text-muted-foreground font-medium mt-0.5 line-clamp-2">
                  {p.tagline}
                </span>
              </div>
            </div>

            {/* Row 3: Separator */}
            <div className="border-t border-border/30" />

            {/* Row 4: Maker */}
            <div className="flex items-center gap-1.5">
              <AvatarImage src={p.makerAvatarUrl} name={p.makerDisplayName} size={20} />
              <Link
                href={`/makers/${p.makerUsername}`}
                className="text-[11px] font-semibold text-foreground hover:text-primary transition-colors truncate min-w-0 flex-1"
              >
                {p.makerDisplayName}
              </Link>
            </div>

            {/* Row 5: Category pill */}
            <div className="flex items-center gap-1.5">
              {category && (
                <Link
                  href={`/categories/${category.id}`}
                  className={cn(
                    "self-start px-2 py-0.5 rounded border text-[9px] font-bold uppercase tracking-widest -mt-2 transition-colors",
                    category.chipClass,
                    category.hoverClass,
                  )}
                >
                  {category.name}
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
