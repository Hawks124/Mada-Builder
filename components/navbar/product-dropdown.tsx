import Link from "next/link";
import {
  CaretDownIcon,
  TrophyIcon,
  SquaresFourIcon,
  CoinsIcon,
  PackageIcon,
} from "@phosphor-icons/react";

export function ProductDropdown() {
  return (
    <div className="group relative">
      <button className="flex items-center gap-2.5 px-3.5 py-2 text-[15px] font-medium text-muted-foreground hover:bg-muted/70 hover:text-foreground rounded-xl transition-all group cursor-pointer">
        <PackageIcon
          weight="bold"
          className="h-5 w-5 text-foreground/80 group-hover:text-foreground transition-colors"
        />
        Produits
        <CaretDownIcon
          weight="bold"
          className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 group-hover:rotate-180 group-hover:text-foreground"
        />
      </button>

      {/* Invisible hover bridge */}
      <div className="absolute top-[80%] left-0 h-6 w-full" />

      {/* Dropdown body */}
      <div className="absolute left-0 top-[calc(100%+0.25rem)] z-50 hidden group-hover:block">
        <div className="w-60 rounded-2xl border border-border/60 bg-background/95 backdrop-blur-2xl p-2.5 shadow-2xl flex flex-col gap-1">
          <DropdownItem
            href="/"
            title="Classement"
            icon={<TrophyIcon weight="fill" className="h-5 w-5" />}
          />
          <DropdownItem
            href="/categories"
            title="Catégories"
            icon={<SquaresFourIcon weight="fill" className="h-5 w-5" />}
          />
          <DropdownItem
            href="/revenue"
            title="Revenus vérifiés"
            icon={<CoinsIcon weight="fill" className="h-5 w-5" />}
          />
        </div>
      </div>
    </div>
  );
}

function DropdownItem({
  href,
  title,
  icon,
}: {
  href: string;
  title: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-[15px] font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors group/item"
    >
      <span className="text-foreground/80 group-hover/item:text-foreground transition-colors">
        {icon}
      </span>
      {title}
    </Link>
  );
}
