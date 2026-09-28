"use client";

import Link from "next/link";
import { useState } from "react";
import {
  CaretDownIcon,
  DeviceMobileIcon,
  GlobeIcon,
  MonitorIcon,
  TerminalIcon,
  PackageIcon,
  StackIcon,
  PlugsConnectedIcon,
  PuzzlePieceIcon,
  DesktopIcon,
  LightningIcon,
  RobotIcon,
  PlugsIcon,
  CloudIcon,
  GameControllerIcon,
  SquaresFourIcon,
  AppleLogoIcon,
  AndroidLogoIcon,
  WindowsLogoIcon,
  CircuitryIcon,
  GiftIcon,
  SparkleIcon,
  TagIcon,
  ArrowsClockwiseIcon,
  ShoppingCartIcon,
  HeartIcon,
  BriefcaseIcon,
  TerminalWindowIcon,
  CheckSquareIcon,
  UsersThreeIcon,
  VideoCameraIcon,
  ChartLineUpIcon,
  CreditCardIcon,
  HeartbeatIcon,
  GraduationCapIcon,
  ChatsCircleIcon,
  PlayIcon,
  PaletteIcon,
  DatabaseIcon,
  ShieldCheckIcon,
  UsersIcon,
  CarIcon,
  ForkKnifeIcon,
  BuildingIcon,
  LeafIcon,
  AirplaneIcon,
  MusicNoteIcon,
  CurrencyBtcIcon,
  ScalesIcon,
  HandshakeIcon,
  FlaskIcon,
  NewspaperIcon,
  FactoryIcon,
  StarIcon,
  ChurchIcon,
  HammerIcon,
  RocketLaunchIcon,
  type Icon,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { AgeBadge } from "@/components/ui/age-badge";

/**
 * Données résolues côté serveur puis sérialisées vers ce composant
 * client. Les icônes sont converties en `iconId` (chaîne) : on ne peut
 * pas faire passer un composant React d'un module serveur à un composant
 * client, et les icônes vivent dans `config/*.tsx` qui importent
 * `@phosphor-icons/react/dist/ssr` (serveur-only).
 *
 * Un seul type d'item pour TOUTE la page (domaines comme axes) : c'est ce
 * qui garantit que les 14 blocs sont rendus par le même composant, donc
 * qu'ils ont exactement la même grammaire visuelle.
 */
export type FacetItem = {
  id: string;
  label: string;
  description: string;
  count: number;
  /** Clé du registre d'icônes client. Absent si l'item porte un `badge`. */
  iconId?: string;
  /** Cible calculée serveur : `/categories/saas` ou `/discover?type=saas`. */
  href: string;
  /** Couleur du libellé/icône, révélée au survol (déjà préfixée `group-hover:`). */
  hoverTextClass?: string;
  /** Fond + bordure de la pastille au survol (déjà préfixé `group-hover:`). */
  hoverBgClass?: string;
  /** Remplace la pastille par un `AgeBadge` (axe âge). */
  badge?: string;
};

export type FacetGroup = { id: string; label: string; items: FacetItem[] };

/* ─────────────────────────── Stats ─────────────────────────── */

/**
 * Chiffres intégrés à la ligne de titre (pas un bandeau flottant) :
 * la relation avec le H1 est explicite, et les compteurs sont lus dans
 * le flux du texte au lieu d'être posés à côté.
 */
export function CategoryStats({
  categoryCount,
  typeCount,
  productCount,
}: {
  categoryCount: number;
  typeCount: number;
  productCount: number;
}) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 mt-3 text-[15px] font-medium text-muted-foreground">
      <span className="text-foreground font-black tabular-nums">{categoryCount}</span>
      <span>domaines</span>
      <span className="text-border select-none" aria-hidden="true">
        ·
      </span>
      <span className="text-foreground font-black tabular-nums">{typeCount}</span>
      <span>types de produits</span>
      <span className="text-border select-none" aria-hidden="true">
        ·
      </span>
      <span className="text-foreground font-black tabular-nums">
        {productCount.toLocaleString("fr-FR")}
      </span>
      <span>produits</span>
    </p>
  );
}

/* ─────────────────────── Ligne de facette ─────────────────────── */

/**
 * LA ligne de la page. Un seul composant pour les 9 familles comme pour
 * les 5 axes : c'est le seul endroit où un lien de la page est défini,
 * donc le hover ne peut pas diverger d'un bloc à l'autre.
 *
 * Au repos : tout est gris, la page est calme. Au survol (ou au tap) la
 * ligne s'illumine — surface, pastille, libellé et count prennent la
 * couleur de la facette. Le voile de survol est en `absolute inset-0` :
 * il ne pousse rien et laisse le filet `border-b` visible.
 */
function FacetRow({ item, last }: { item: FacetItem; last: boolean }) {
  return (
    <Link
      href={item.href}
      title={item.description}
      className={cn(
        "group relative flex items-center gap-3 py-2.5 min-w-0",
        !last && "border-b border-border/20",
      )}
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-lg bg-muted/50 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-active:opacity-100"
      />

      {item.badge ? (
        <span className="relative">
          <AgeBadge value={item.badge} size="sm" />
        </span>
      ) : (
        <span
          className={cn(
            "relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/50 bg-background transition-colors duration-200",
            item.hoverBgClass ?? "group-hover:bg-foreground/6 group-hover:border-foreground/15",
          )}
        >
          <TaxonomyIcon
            id={item.iconId ?? ""}
            className={cn(
              "h-3.5 w-3.5 text-foreground/40 transition-colors duration-200",
              item.hoverTextClass,
            )}
          />
        </span>
      )}

      <span className="relative flex-1 min-w-0">
        <span
          className={cn(
            "block truncate text-[14px] font-bold text-foreground transition-colors duration-150",
            item.hoverTextClass,
          )}
        >
          {item.label}
        </span>
        {item.description && (
          <span className="block truncate text-[11px] text-muted-foreground/80">
            {item.description}
          </span>
        )}
      </span>

      <span
        className={cn(
          "relative shrink-0 text-[12px] font-bold tabular-nums text-muted-foreground transition-colors duration-150 group-hover:text-foreground",
          item.hoverTextClass,
        )}
      >
        {item.count}
      </span>
    </Link>
  );
}

/* ─────────────────────── Bloc de facette ─────────────────────── */

/** Items affichés repliés dans un axe long — les plus représentés d'abord. */
const ITEMS_COLLAPSED = 7;

/**
 * LA colonne de la page : micro-label + filet, puis les lignes. L'état
 * d'accord est local (ce n'est pas une navigation, donc pas d'URL) et la
 * grille qui contient les blocs est à colonnes fixes avec `items-start` :
 * un bloc qui grandit ne redistribue pas ses voisins, seule sa hauteur
 * change.
 */
function FacetBlock({
  label,
  items,
  collapsible = false,
}: {
  label: string;
  items: FacetItem[];
  collapsible?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const canExpand = collapsible && items.length > ITEMS_COLLAPSED;
  const visible = canExpand && !open ? items.slice(0, ITEMS_COLLAPSED) : items;
  const hidden = items.length - visible.length;

  return (
    <div className="flex flex-col">
      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground pb-3 border-b border-border/40">
        {label}
      </h3>

      {visible.map((item, i) => (
        <FacetRow key={item.id} item={item} last={i === items.length - 1} />
      ))}

      {canExpand && hidden > 0 && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex items-center gap-1.5 mt-3 px-1 text-[12px] font-bold text-muted-foreground hover:text-foreground transition-colors cursor-pointer self-start"
        >
          {open ? "Réduire" : `+ ${hidden} autres`}
          <CaretDownIcon
            weight="bold"
            className={cn("w-3 h-3 transition-transform", open && "rotate-180")}
          />
        </button>
      )}
    </div>
  );
}

/**
 * Grille de blocs. `collapsible` seulement pour les axes transverses,
 * dont un seul (Type, 15 entrées) dépasse réellement la longueur d'un
 * écran — les 9 familles tiennent sans repli.
 */
export function FacetGrid({
  groups,
  collapsible = false,
}: {
  groups: FacetGroup[];
  collapsible?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-10 gap-y-10 items-start">
      {groups.map((group) => (
        <FacetBlock
          key={group.id}
          label={group.label}
          items={group.items}
          collapsible={collapsible}
        />
      ))}
    </div>
  );
}

/* ─────────────────── Résolution d'icône par id ─────────────────── */

/**
 * Les icônes vivent dans des configs qui importent
 * `@phosphor-icons/react/dist/ssr` (serveur-only). On ne peut donc pas
 * les passer en prop à un composant client : la page sérialise l'id
 * (`iconId`) et on résout le composant ici.
 *
 * Les catégories sont préfixées `cat-` parce que trois de leurs ids
 * (`saas`, `iot`, `other`) existent aussi comme type de produit : sans
 * préfixe, les deux axes partageraient la même clé.
 */
const ICONS: Record<string, Icon> = {
  // Types de produit
  app_mobile: DeviceMobileIcon,
  app_web: GlobeIcon,
  app_desktop: MonitorIcon,
  cli: TerminalIcon,
  package: PackageIcon,
  framework: StackIcon,
  api: PlugsConnectedIcon,
  extension: PuzzlePieceIcon,
  os: DesktopIcon,
  iot: LightningIcon,
  bot: RobotIcon,
  plugin: PlugsIcon,
  saas: CloudIcon,
  game: GameControllerIcon,
  other: SquaresFourIcon,
  // Plateformes
  ios: AppleLogoIcon,
  macos: AppleLogoIcon,
  android: AndroidLogoIcon,
  web: GlobeIcon,
  desktop: MonitorIcon,
  windows: WindowsLogoIcon,
  // Modèles économiques
  free: GiftIcon,
  freemium: SparkleIcon,
  paid: TagIcon,
  subscription: ArrowsClockwiseIcon,
  one_time_purchase: ShoppingCartIcon,
  open_source_donationware: HeartIcon,
  // Avancement
  "lc-dev": HammerIcon,
  "lc-beta": FlaskIcon,
  "lc-live": RocketLaunchIcon,
  // Catégories
  "cat-saas": BriefcaseIcon,
  "cat-dev-tools": TerminalWindowIcon,
  "cat-productivity": CheckSquareIcon,
  "cat-ai": SparkleIcon,
  "cat-finance": ChartLineUpIcon,
  "cat-fintech": CreditCardIcon,
  "cat-health": HeartbeatIcon,
  "cat-education": GraduationCapIcon,
  "cat-gaming": GameControllerIcon,
  "cat-ecommerce": ShoppingCartIcon,
  "cat-communication": ChatsCircleIcon,
  "cat-social": UsersThreeIcon,
  "cat-entertainment": PlayIcon,
  "cat-video": VideoCameraIcon,
  "cat-design": PaletteIcon,
  "cat-data": DatabaseIcon,
  "cat-security": ShieldCheckIcon,
  "cat-employment": UsersIcon,
  "cat-transport": CarIcon,
  "cat-food": ForkKnifeIcon,
  "cat-real-estate": BuildingIcon,
  "cat-agriculture": LeafIcon,
  "cat-travel": AirplaneIcon,
  "cat-music": MusicNoteIcon,
  "cat-blockchain": CurrencyBtcIcon,
  "cat-government": ScalesIcon,
  "cat-nonprofit": HandshakeIcon,
  "cat-science": FlaskIcon,
  "cat-news": NewspaperIcon,
  "cat-industry": FactoryIcon,
  "cat-iot": CircuitryIcon,
  "cat-robotics": RobotIcon,
  "cat-lifestyle": StarIcon,
  "cat-religion": ChurchIcon,
  "cat-other": SquaresFourIcon,
};

function TaxonomyIcon({ id, className }: { id: string; className?: string }) {
  const Icon = ICONS[id] ?? SquaresFourIcon;
  return <Icon weight="duotone" className={className} aria-hidden="true" />;
}
