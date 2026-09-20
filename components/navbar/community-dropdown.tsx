import Link from "next/link";
import {
  CaretDownIcon,
  UsersIcon,
  ShieldCheckIcon,
  FacebookLogoIcon,
  LifebuoyIcon,
} from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/lib/utils";

export const FACEBOOK_GROUP_URL = "https://facebook.com/groups/malagasytech";

// Communauté — même pattern hover que ProductDropdown.
// Contact reste un item mort honnête (pill "Bientôt") jusqu'à la page admin.
export function CommunityDropdown() {
  return (
    <div className="group relative">
      <button className="flex items-center gap-2.5 px-3.5 py-2 text-[15px] font-medium text-muted-foreground hover:bg-muted/70 hover:text-foreground rounded-xl transition-all group cursor-pointer">
        <UsersIcon
          weight="bold"
          className="h-5 w-5 text-foreground/80 group-hover:text-foreground transition-colors"
        />
        Communauté
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
            href="/regles"
            title="Charte de la communauté"
            icon={<ShieldCheckIcon weight="fill" className="h-5 w-5" />}
          />
          <DropdownItem
            href={FACEBOOK_GROUP_URL}
            title="Groupe Facebook"
            icon={<FacebookLogoIcon weight="fill" className="h-5 w-5" />}
            external
          />
          <div
            className="flex items-center gap-3.5 rounded-xl px-4 py-3 text-[15px] font-medium text-muted-foreground/60 cursor-default"
            title="Disponible prochainement"
          >
            <span className="text-foreground/40">
              <LifebuoyIcon weight="fill" className="h-5 w-5" />
            </span>
            Contact
            <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-black uppercase tracking-widest">
              Bientôt
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DropdownItem({
  href,
  title,
  icon,
  external,
}: {
  href: string;
  title: string;
  icon: React.ReactNode;
  external?: boolean;
}) {
  return (
    <Link
      href={href}
      {...(external
        ? { target: "_blank", rel: "noopener noreferrer" }
        : {})}
      className={cn(
        "flex items-center gap-3.5 rounded-xl px-4 py-3 text-[15px] font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors group/item",
      )}
    >
      <span className="text-foreground/80 group-hover/item:text-foreground transition-colors">
        {icon}
      </span>
      {title}
    </Link>
  );
}
