import type { Metadata } from "next";
import Link from "next/link";
import {
  GlobeIcon,
  GithubLogoIcon,
  XLogoIcon,
  MapPinIcon,
} from "@phosphor-icons/react/dist/ssr";
import { getOccupationById } from "@/config/occupations";
import { OverviewStats } from "@/components/dashboard/overview-stats";
import { MakerAppRow } from "@/components/makers/maker-app-row";
import {
  MOCK_APPS,
  getDashboardTotals,
  type DashboardApp,
} from "@/components/dashboard/dashboard-mock";

// TODO(auth): noindex temporaire — contenu mock. Lever quand le profile
// edit branchera les vraies données (PRD §7 : profils makers indexables).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const MAKER_SOCIALS = [
  { id: "website", label: "Site web", href: "https://kaliana.dev" },
  { id: "github", label: "GitHub", href: "https://github.com/kaliana" },
  { id: "x", label: "X", href: "https://x.com/kaliana" },
];

// Profil public maker (PRD §6D) : avatar, nom, bio, liens, produits
// publiés, total votes, MRR combiné. Pas de messagerie in-app (hors V1) :
// le contact passe par les liens sortants du maker.
export default async function MakerPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const isKaliana = username === "kaliana";
  const displayName = isKaliana ? "Kaliana R." : username;
  const occupation = getOccupationById("maker");

  // Seuls les produits publiés sont visibles en public — jamais
  // pending/rejected (confidentialité de la revue).
  const publishedApps: DashboardApp[] = isKaliana
    ? MOCK_APPS.filter((a) => a.status === "live")
    : [];
  const totals = getDashboardTotals(publishedApps);

  return (
    <main className="min-h-screen bg-background">
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 md:pt-20 pb-24 flex flex-col gap-12">
        {/* Identity */}
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-5 md:gap-6">
            <img
              src={`https://i.pravatar.cc/150?u=${username}`}
              alt={displayName}
              className="h-20 w-20 md:h-24 md:w-24 rounded-full object-cover shrink-0"
            />
            <div className="flex flex-col gap-1.5 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-3xl md:text-4xl font-black tracking-tight text-foreground truncate">
                  {displayName}
                </h1>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 text-[11px] font-bold text-muted-foreground shrink-0">
                  <occupation.icon
                    weight="fill"
                    className="w-3.5 h-3.5"
                    aria-hidden="true"
                  />
                  {occupation.label}
                </span>
              </div>
              <p className="text-[15px] font-medium text-muted-foreground leading-relaxed">
                Maker malgache — SaaS RH et outils fintech.
              </p>
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
                <MapPinIcon weight="fill" className="w-4 h-4" aria-hidden="true" />
                Antananarivo, Madagascar
              </p>
            </div>
          </div>

          {/* Outbound links — le contact passe par ici, pas de DM (hors V1) */}
          {isKaliana && (
            <div className="flex items-center gap-2">
              {MAKER_SOCIALS.map((social) => (
                <Link
                  key={social.id}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={social.label}
                  aria-label={`${social.label} de ${displayName} (nouvel onglet)`}
                  className="flex items-center justify-center h-10 w-10 rounded-full border border-border/40 text-muted-foreground hover:text-foreground hover:border-foreground/30 hover:bg-muted/50 transition-colors"
                >
                  {social.id === "website" ? (
                    <GlobeIcon weight="bold" className="w-[18px] h-[18px]" />
                  ) : social.id === "github" ? (
                    <GithubLogoIcon
                      weight="fill"
                      className="w-[18px] h-[18px]"
                    />
                  ) : (
                    <XLogoIcon weight="fill" className="w-[18px] h-[18px]" />
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Stats publiques (§6D strict) */}
        <OverviewStats
          totals={totals}
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
              {publishedApps.length} publié
              {publishedApps.length > 1 ? "s" : ""}
            </span>
          </div>

          {publishedApps.length === 0 ? (
            <p className="text-[14px] font-medium text-muted-foreground py-8 text-center">
              Aucun produit publié pour le moment.
            </p>
          ) : (
            <div className="flex flex-col">
              {publishedApps.map((app) => (
                <MakerAppRow key={app.id} app={app} />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
