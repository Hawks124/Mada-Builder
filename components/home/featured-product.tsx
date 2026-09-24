import {
  ChatCircleTextIcon,
  StarIcon,
  SealCheckIcon,
  AppleLogoIcon,
  AndroidLogoIcon,
  WindowsLogoIcon,
  UsersIcon,
  GlobeIcon,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { AvatarImage } from "@/components/ui/avatar-image";
import { ActionButton } from "@/components/ui/action-button";
import { cn } from "@/lib/utils";
import { getCategoryById } from "@/config/categories";
import { AgeBadge } from "@/components/ui/age-badge";
import { VoteButton } from "@/components/votes/vote-button";

export function FeaturedProduct() {
  return (
    <section className="container px-4 md:px-8 max-w-7xl mx-auto w-full">
      <div className="flex flex-col md:flex-row gap-8 md:gap-12 justify-between items-start">
        {/* LEFT: App Identity */}
        <div className="flex flex-col gap-6 flex-1">
          {/* Editorial Super-Header */}
          <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-foreground flex items-center gap-3">
            <span>★ Produit de la journée</span>
            <span className="text-border hidden md:block">|</span>
            <span className="font-semibold text-muted-foreground hidden md:block">
              Ven. 19 Sept. 2026
            </span>
          </h3>

          <div className="flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-8">
            {/* Icon */}
            <Link
              href="/products/avotra-hr"
              className="shrink-0 w-28 h-28 md:w-32 md:h-32 relative overflow-hidden rounded-3xl bg-background border border-border/40 shadow-sm transition-transform duration-300 hover:scale-[1.02] hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <div className="absolute inset-0 bg-linear-to-br from-zinc-800 to-zinc-950 dark:from-zinc-100 dark:to-zinc-300 flex items-center justify-center text-white dark:text-zinc-900 text-5xl font-extrabold tracking-tighter">
                AV
              </div>
              <div className="absolute inset-0 rounded-3xl border border-black/5 dark:border-white/10 pointer-events-none" />
            </Link>

            {/* Title + Tagline + Tags */}
            <div className="flex flex-col justify-center gap-1.5 md:gap-2">
              <div className="group flex items-center gap-3 w-fit">
                <Link href="/products/avotra-hr">
                  <h1 className="text-3xl md:text-[2.75rem] font-extrabold tracking-tighter leading-none text-foreground group-hover:text-primary transition-colors">
                    Avotra HR
                  </h1>
                </Link>
                {/* Embedded Mini Tag = category */}
                <Link
                  href={`/categories/${getCategoryById("employment")!.id}`}
                  className={cn(
                    "inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-colors",
                    getCategoryById("employment")!.chipClass,
                    getCategoryById("employment")!.hoverClass,
                  )}
                >
                  {getCategoryById("employment")!.name}
                </Link>
              </div>

              <p className="text-lg md:text-xl font-medium tracking-tight text-muted-foreground leading-snug max-w-xl mt-1">
                Le SIRH et système de paie automatisé certifié 100% droit du
                travail malgache.
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT: Action Column */}
        <div className="flex flex-col items-center gap-5 mt-4 md:mt-0 shrink-0 w-full md:w-auto">
          {/* Vote + Comment — Zero UI (no borders, no bg) */}
          <div className="flex items-start justify-center gap-6 w-full md:w-auto">
            {/* Upvote */}
            <VoteButton
              productId="avotra-hr"
              productName="Avotra HR"
              votes={342}
              variant="hero"
            />

            {/* Divider */}
            <div className="w-px bg-border/60 self-stretch" />

            {/* Comment */}
            <button className="flex flex-col items-center gap-1 group cursor-pointer">
              <ChatCircleTextIcon
                weight="fill"
                className="w-7 h-7 text-muted-foreground group-hover:text-foreground transition-colors duration-200"
              />
              <span className="text-[22px] font-black tracking-tighter text-foreground leading-none">
                58
              </span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                avis
              </span>
            </button>
          </div>

          {/* CTA anchored at bottom */}
          <div className="flex flex-col items-center gap-1 w-full">
            <ActionButton
              href="/products/avotra-hr"
              variant="primary"
              className="w-full h-12 text-[15px]"
            >
              Voir le produit
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 256 256"
                className="w-4 h-4 ml-1"
                fill="currentColor"
              >
                <path d="M221.66,133.66l-72,72a8,8,0,0,1-11.32-11.32L196.69,136H40a8,8,0,0,1,0-16H196.69L138.34,61.66a8,8,0,0,1,11.32-11.32l72,72A8,8,0,0,1,221.66,133.66Z" />
              </svg>
            </ActionButton>
            <span className="text-[10px] text-muted-foreground text-center font-medium">
              Achats In-App
            </span>
          </div>
        </div>
      </div>
      {/* Deep Metadata Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:flex lg:flex-nowrap lg:items-start lg:justify-between gap-6 lg:gap-x-4 mt-2 pt-8 border-t border-border/40 w-full">
        {/* 1. Maker */}
        <div className="flex flex-col gap-2">
          <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
            Maker
          </span>
          <Link
            href="/makers/kaliana"
            className="flex items-center gap-2 group p-1 -ml-1 rounded-full hover:bg-muted/50 transition-colors w-max"
          >
            <AvatarImage
              src="https://i.pravatar.cc/150?u=kaliana"
              name="Kaliana R."
              size={24}
              className="group-hover:scale-105 transition-transform"
            />
            <span className="text-[14px] font-semibold flex items-center gap-1 group-hover:text-primary transition-colors">
              Kaliana R.{" "}
              <SealCheckIcon
                weight="fill"
                className="text-blue-500 w-3.5 h-3.5"
              />
            </span>
          </Link>
        </div>

        {/* 2. Plateformes — each icon in a <span> for reliable hover */}
        <div className="flex flex-col gap-2">
          <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
            Plateformes
          </span>
          <div className="flex items-center gap-3 pl-1">
            <span className="text-foreground hover:text-sky-500 transition-colors cursor-pointer">
              <GlobeIcon weight="bold" className="w-4.5 h-4.5" />
            </span>
            <span className="text-foreground hover:text-foreground/50 transition-colors cursor-pointer">
              <AppleLogoIcon weight="fill" className="w-4.5 h-4.5" />
            </span>
            <span className="text-foreground hover:text-green-500 transition-colors cursor-pointer">
              <AndroidLogoIcon weight="fill" className="w-4.5 h-4.5" />
            </span>
            <span className="text-foreground hover:text-blue-500 transition-colors cursor-pointer">
              <WindowsLogoIcon weight="fill" className="w-4.5 h-4.5" />
            </span>
          </div>
        </div>

        {/* 3. Catégories */}
        <div className="flex flex-col gap-2">
          <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
            Catégories
          </span>
          <div className="flex items-center gap-1.5 pl-1">
            <Link
              href={`/categories/${getCategoryById("employment")!.id}`}
              aria-label={getCategoryById("employment")!.name}
              className="flex items-center gap-1.5 text-blue-600 hover:text-blue-500 transition-colors cursor-pointer"
            >
              <UsersIcon weight="fill" className="w-4.5 h-4.5" />
              <span className="text-[13px] font-semibold">
                {getCategoryById("employment")!.name}
              </span>
            </Link>
          </div>
        </div>

        {/* 4. Tarification */}
        <div className="flex flex-col gap-2">
          <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
            Tarification
          </span>
          <div className="flex flex-col gap-0.5 pl-1">
            <span className="text-[13px] font-semibold text-foreground">
              Freemium
            </span>
            <span className="text-[11px] text-muted-foreground font-medium">
              Dès 15.000Ar/mois
            </span>
          </div>
        </div>

        {/* 5. Classification (Age) */}
        <div className="flex flex-col gap-2 shrink-0">
          <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
            Classification
          </span>
          <div className="flex items-center gap-2 pl-1">
            <AgeBadge value="4+" size="md" />
            <span className="text-[12px] font-semibold text-foreground leading-tight">
              Grand public
            </span>
          </div>
        </div>

        {/* 6. Modèle (SaaS etc) */}
        <div className="flex flex-col gap-2 shrink-0">
          <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
            Modèle
          </span>
          <div className="flex items-center gap-2 pl-1 h-full">
            <span className="text-[12px] font-semibold text-foreground">
              Logiciel SaaS B2B
            </span>
          </div>
        </div>

        {/* 7. Monétisation (Annonces) */}
        <div className="flex flex-col gap-2 shrink-0 max-w-30">
          <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
            Monétisation
          </span>
          <div className="flex items-center gap-2 pl-1 h-full">
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold leading-snug">
              Contient des annonces
            </span>
          </div>
        </div>

        {/* 6. Avis */}
        <div className="flex flex-col gap-2">
          <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
            Avis (120)
          </span>
          <Link
            href="#reviews"
            className="flex flex-col gap-1 pl-1 group cursor-pointer"
          >
            <div className="flex items-center gap-0.5">
              {[0, 1, 2, 3, 4].map((i) => (
                <StarIcon
                  key={i}
                  weight="fill"
                  className="text-yellow-400 dark:text-yellow-500 w-4 h-4 group-hover:scale-110 transition-transform"
                />
              ))}
            </div>
            <span className="text-[13px] font-bold text-foreground group-hover:underline">
              4.9 sur 5
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
