import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import { AvatarImage } from "@/components/ui/avatar-image";
import { notFound } from "next/navigation";
import {
  GlobeIcon,
  GithubLogoIcon,
  XLogoIcon,
  FacebookLogoIcon,
  InstagramLogoIcon,
  LinkedinLogoIcon,
  TiktokLogoIcon,
  WhatsappLogoIcon,
  MapPinIcon,
} from "@phosphor-icons/react/dist/ssr";
import { getOccupationById } from "@/config/occupations";
import { logPageView } from "@/services/stats.service";
import { OverviewStats } from "@/components/dashboard/overview-stats";
import type { DashboardTotals } from "@/components/dashboard/dashboard-mock";
import { getUserProfile } from "@/services/users.service";

// Profil public maker (PRD §6D) : avatar, nom, bio, liens, produits
// publiés, total votes, MRR combiné. Pas de messagerie in-app (hors V1) :
// le contact passe par les liens sortants du maker.
// Produits : vide honnête jusqu'au milestone listings (aucun mock).
// Indexable (§7) dès que les données sont réelles.
const SOCIAL_DEFS = [
  { id: "website", label: "Site web", icon: GlobeIcon },
  { id: "github", label: "GitHub", icon: GithubLogoIcon },
  { id: "x", label: "X", icon: XLogoIcon },
  { id: "facebook", label: "Facebook", icon: FacebookLogoIcon },
  { id: "instagram", label: "Instagram", icon: InstagramLogoIcon },
  { id: "linkedin", label: "LinkedIn", icon: LinkedinLogoIcon },
  { id: "tiktok", label: "TikTok", icon: TiktokLogoIcon },
  { id: "whatsapp", label: "WhatsApp", icon: WhatsappLogoIcon },
] as const;

const ZERO_TOTALS: DashboardTotals = {
  totalUpvotes: 0,
  liveCount: 0,
  totalListings: 0,
  totalViews: 0,
  pendingCount: 0,
  totalMrrAr: 0,
  totalComments: 0,
  globalRating: 0,
};

type Params = { username: string };

type PublicProfile = {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  occupation: string;
  city: string | null;
  country: string | null;
  websiteUrl: string | null;
  socialLinks: Record<string, string>;
  banned: boolean;
};

// Démo sans backend (contributeur) : mock documenté, noindex forcé.
// Avec backend : réel ou 404, jamais de faux contenu.
const DEMO_PROFILE: PublicProfile = {
  username: "kaliana",
  displayName: "Kaliana R.",
  avatarUrl: "https://i.pravatar.cc/150?u=kaliana",
  bio: "Maker malgache — SaaS RH et outils fintech.",
  occupation: "maker",
  city: "Antananarivo",
  country: "Madagascar",
  websiteUrl: "https://kaliana.dev",
  socialLinks: {
    github: "https://github.com/kaliana",
    x: "https://x.com/kaliana",
  },
  banned: false,
};

async function loadProfile(
  username: string,
): Promise<{ profile: PublicProfile | null; demo: boolean }> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return {
      profile: username.toLowerCase() === "kaliana" ? DEMO_PROFILE : null,
      demo: true,
    };
  }
  try {
    const row = await getUserProfile(username.toLowerCase());
    if (!row) return { profile: null, demo: false };
    const socialLinks: Record<string, string> = {};
    for (const [k, v] of Object.entries(row.socialLinks ?? {})) {
      if (typeof v === "string" && v !== "") socialLinks[k] = v;
    }
    // Transparence modération : profil visible + badge (jamais d'effacement).
    const banned = row.bannedAt !== null;
    return {
      profile: {
        username: row.username,
        displayName: row.displayName,
        avatarUrl: row.avatarUrl,
        bio: row.bio,
        occupation: row.occupation,
        city: row.city,
        country: row.country,
        websiteUrl: row.websiteUrl,
        socialLinks,
        banned,
      },
      demo: false,
    };
  } catch {
    return { profile: null, demo: false };
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { username } = await params;
  const { profile, demo } = await loadProfile(username);
  if (!profile || demo) return { robots: { index: false, follow: false } };
  return {
    title: `${profile.displayName} (@${profile.username})`,
    description: profile.bio ?? `Profil maker de ${profile.displayName}.`,
  };
}

export default async function MakerPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { username } = await params;
  const { profile } = await loadProfile(username);
  if (!profile) notFound();

  // Compteur vitrine anonyme (même pattern que la home).
  after(() => logPageView(`/makers/${profile.username}`));

  const occupation =
    getOccupationById(profile.occupation) ?? getOccupationById("maker")!;
  const location = [profile.city, profile.country].filter(Boolean).join(", ");
  const links = SOCIAL_DEFS.flatMap((def) => {
    const href =
      def.id === "website"
        ? (profile.websiteUrl ?? profile.socialLinks.website)
        : profile.socialLinks[def.id];
    return typeof href === "string" && href !== ""
      ? [{ ...def, href }]
      : [];
  });
  const initials = profile.displayName
    .split(/[\s_.-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

  return (
    <main className="min-h-screen bg-background">
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 md:pt-20 pb-24 flex flex-col gap-12">
        {/* Identity */}
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-5 md:gap-6">
            {profile.avatarUrl ? (
              <AvatarImage
                src={profile.avatarUrl}
                name={profile.displayName}
                size={96}
              />
            ) : (
              <span
                aria-hidden="true"
                className="h-20 w-20 md:h-24 md:w-24 rounded-full bg-[#EA580C] flex items-center justify-center text-white font-bold text-3xl shrink-0"
              >
                {initials || "M"}
              </span>
            )}
            <div className="flex flex-col gap-1.5 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-3xl md:text-4xl font-black tracking-tight text-foreground truncate">
                  {profile.displayName}
                </h1>
                {profile.banned && (
                  <span className="inline-flex items-center rounded-full border border-red-500/25 bg-red-500/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-widest text-red-600 dark:text-red-400 shrink-0">
                    Suspendu
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 text-[11px] font-bold text-muted-foreground shrink-0">
                  <occupation.icon
                    weight="fill"
                    className="w-3.5 h-3.5"
                    aria-hidden="true"
                  />
                  {occupation.label}
                </span>
              </div>
              {profile.bio && (
                <p className="text-[15px] font-medium text-muted-foreground leading-relaxed">
                  {profile.bio}
                </p>
              )}
              {location !== "" && (
                <p className="flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
                  <MapPinIcon
                    weight="fill"
                    className="w-4 h-4"
                    aria-hidden="true"
                  />
                  {location}
                </p>
              )}
            </div>
          </div>

          {/* Outbound links — le contact passe par ici, pas de DM (hors V1) */}
          {links.length > 0 && (
            <div className="flex items-center gap-2">
              {links.map((social) => (
                <Link
                  key={social.id}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={social.label}
                  aria-label={`${social.label} de ${profile.displayName} (nouvel onglet)`}
                  className="flex items-center justify-center h-10 w-10 rounded-full border border-border/40 text-muted-foreground hover:text-foreground hover:border-foreground/30 hover:bg-muted/50 transition-colors"
                >
                  <social.icon
                    weight="fill"
                    className="w-[18px] h-[18px]"
                  />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Stats publiques (§6D strict) — zéros sans produits, jamais de mock */}
        <OverviewStats
          totals={ZERO_TOTALS}
          mode="public"
          revenueDisplay="full"
        />

        <div className="w-full h-px bg-border/40" />

        {/* Produits publiés — rows leaderboard, colonne maker implicite */}
        <div className="flex flex-col gap-6">
          <div className="flex items-baseline gap-3">
            <h2 className="text-2xl font-black tracking-tight text-foreground">
              Produits
            </h2>
            <span className="text-[13px] font-medium text-muted-foreground">
              0 publié
            </span>
          </div>

          {/* Milestone listings : lister ici les produits publiés du maker. */}
          <p className="text-[14px] font-medium text-muted-foreground py-8 text-center">
            Aucun produit publié pour le moment.
          </p>
        </div>
      </div>
    </main>
  );
}
