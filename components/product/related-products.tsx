import { ArrowRightIcon, CaretUpIcon, StarIcon, GlobeIcon, AppleLogoIcon, GooglePlayLogo, ShieldCheckIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { AvatarImage } from "@/components/ui/avatar-image";
import { cn, slugifyName } from "@/lib/utils";
import { getCategoryById } from "@/config/categories";

const PRODUCTS = [
  { id: "abono", name: "Abono", tag: "Split bills, not friendships.", icon: "bg-blue-500", rating: "4.9", votes: 311, maker: "Glenn Joshua", verified: true },
  { id: "prepay", name: "Prepay", tag: "Track your subscriptions.", icon: "bg-purple-500", rating: "4.7", votes: 124, maker: "Karim Rabe", verified: false },
  { id: "invoice-maker", name: "Invoice Maker Pro", tag: "Generate invoices fast.", icon: "bg-orange-500", rating: "5.0", votes: 89, maker: "Andry Rakoto Ramarolahy", verified: true },
];

export function RelatedProducts() {
  return (
    <div className="flex flex-col gap-6 pt-10 border-t border-border/40">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-extrabold tracking-tight">Plus dans Finance</h2>
        <Link href="/categories/finance" className="text-[12px] font-bold text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors group">
          Tout voir <ArrowRightIcon weight="bold" className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {PRODUCTS.map((p) => (
          <div
            key={p.id}
            className="group flex flex-col gap-4 p-5 rounded-3xl border border-border/40 bg-muted/10 hover:bg-muted/20 hover:border-border/60 hover:-translate-y-0.5 transition-all duration-300"
          >
            {/* Row 1: Icon + Rating + Votes */}
            <div className="flex items-start justify-between">
              <div className={cn("w-14 h-14 rounded-2xl shrink-0 relative overflow-hidden shadow-sm transition-transform duration-300 group-hover:scale-105 group-hover:-rotate-2", p.icon)}>
                <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              {/* Rating — top right */}
              <div className="flex items-center gap-1 text-[12px] font-bold text-muted-foreground group-hover:text-amber-500 transition-colors mt-1">
                <StarIcon weight="fill" className="w-3.5 h-3.5" />{p.rating}
              </div>
            </div>

            {/* Row 2: Name + Votes */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col min-w-0">
                <Link href={`/products/${p.id}`} className="w-fit">
                  <span className="text-[15px] font-extrabold text-foreground tracking-tight leading-tight group-hover:text-primary transition-colors">{p.name}</span>
                </Link>
                <span className="text-[12px] text-muted-foreground font-medium mt-0.5 line-clamp-2">{p.tag}</span>
              </div>
              {/* Vote pill — compact */}
              <div className="flex items-center gap-1 shrink-0 bg-background border border-border/50 rounded-full px-2 py-0.5 text-[11px] font-bold text-foreground group-hover:text-emerald-500 group-hover:border-emerald-500/20 group-hover:bg-emerald-500/5 transition-colors shadow-sm">
                <CaretUpIcon weight="bold" className="w-3 h-3 -mt-px" />{p.votes}
              </div>
            </div>

            {/* Row 3: Separator */}
            <div className="border-t border-border/30" />

            {/* Row 4: Maker + Category + Platforms + Verified */}
            <div className="flex items-center gap-2">
              {/* Avatar + truncated name */}
              <AvatarImage src={`https://i.pravatar.cc/150?u=${p.id}`} name={p.maker} size={20} />
              <Link
                href={`/makers/${slugifyName(p.maker)}`}
                className="text-[11px] font-semibold text-foreground hover:text-primary transition-colors truncate min-w-0 flex-1"
              >
                {p.maker}
              </Link>

              {/* Platforms + Verified — right side */}
              <div className="flex items-center gap-1.5 text-muted-foreground shrink-0">
                <AppleLogoIcon weight="fill" className="w-3.5 h-3.5" />
                <GlobeIcon weight="bold" className="w-3.5 h-3.5" />
                {p.verified && (
                  <ShieldCheckIcon weight="fill" className="w-4 h-4 text-emerald-500 ml-0.5" />
                )}
              </div>
            </div>

            {/* Category pill — bottom left */}
            <Link
              href={`/categories/${getCategoryById("finance")!.id}`}
              className={cn(
                "self-start px-2 py-0.5 rounded border text-[9px] font-bold uppercase tracking-widest -mt-2 transition-colors",
                getCategoryById("finance")!.chipClass,
                getCategoryById("finance")!.hoverClass
              )}
            >
              {getCategoryById("finance")!.name}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
