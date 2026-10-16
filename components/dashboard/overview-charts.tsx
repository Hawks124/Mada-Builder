import { ActivityPlot } from "@/components/charts/activity-plot";
import { FunnelPlot } from "@/components/charts/funnel-plot";
import { ProductsPlot } from "@/components/charts/products-plot";
import { VotesPlot } from "@/components/charts/votes-plot";
import { MrrPlot } from "@/components/charts/mrr-plot";
import { StatusPlot } from "@/components/charts/status-plot";
import { EmptyState } from "@/components/ui/empty-state";
import { ActionButton } from "@/components/ui/action-button";
import type { DashboardApp } from "@/components/dashboard/dashboard-mock";
import type { ChartDay } from "@/services/dashboard.service";

/**
 * Graphiques du tableau de bord.
 *
 * Aucun conteneur : filet, espace, typographie.
 *
 * Deux niveaux d'état vide. Sans aucune donnée, un seul état pour tout le bloc —
 * six messages identiques feraient « en panne ». Avec des données partielles,
 * seul le panneau concerné est remplacé par un vide technique : un produit
 * publié hier n'a pas encore de votes, ce n'est pas une erreur.
 */
export function OverviewCharts({
  points,
  apps,
  mrr,
}: {
  points: ChartDay[];
  apps: DashboardApp[];
  mrr: { currency: string; days: { label: string; value: number }[] } | null;
}) {
  // Le tunnel porte sur 30 jours, comme avant : le cumul 90 jours le rendrait
  // trois fois plus gros que les autres panneaux, qui restent bornés.
  const totals = points.slice(-30).reduce(
    (acc, p) => ({
      views: acc.views + p.views,
      clicks: acc.clicks + p.clicks,
      votes: acc.votes + p.votes,
    }),
    { views: 0, clicks: 0, votes: 0 },
  );

  const counts = {
    live: apps.filter((a) => a.status === "live").length,
    pending: apps.filter((a) => a.status === "pending").length,
    rejected: apps.filter((a) => a.status === "rejected").length,
  };

  if (apps.length === 0 || (totals.views === 0 && totals.clicks === 0 && totals.votes === 0)) {
    return (
      <section className="flex flex-col border-t border-border/40 pt-8">
        <EmptyState
          title="Pas encore de données"
          description="Vos statistiques apparaîtront ici dès que vos produits auront été visités. Publiez une fiche puis partagez son lien : c'est le premier levier."
          action={
            <ActionButton href="/products/submit" variant="primary">
              Publier un produit
            </ActionButton>
          }
        />
      </section>
    );
  }

  const hasViews = totals.views > 0;
  const hasVotes = totals.votes > 0;

  return (
    <div className="flex flex-col">
      <Section
        title="Votre tunnel"
        subtitle="De la vue à la voix. Chaque étape montre où l'intérêt se perd."
      >
        {hasViews ? (
          <FunnelPlot totals={[totals.views, totals.clicks, totals.votes]} />
        ) : (
          <NoData label="Aucune visite enregistrée pour l'instant." />
        )}
      </Section>

      <Section
        title="Vues et clics"
        subtitle="Les pics ne sont jamais du hasard : ils suivent ce que vous avez fait."
      >
        {hasViews ? (
          <ActivityPlot points={points} />
        ) : (
          <NoData label="Les vues de vos fiches s'afficheront ici." />
        )}
      </Section>

      <Section
        title="Par produit"
        subtitle="Trois échelles séparées : les vues écraseraient les votes."
      >
        {apps.length > 0 ? (
          <ProductsPlot
            products={apps.map((a) => ({
              name: a.name,
              views: a.views,
              clicks: a.clicks,
              votes: a.votes,
              initials: a.initials,
              gradient: a.iconGradient,
              iconUrl: a.iconUrl,
            }))}
          />
        ) : (
          <NoData label="Aucun produit à comparer." />
        )}
      </Section>

      <Section title="Votes reçus" subtitle="L’élan de ceux qui vous endossent.">
        {hasVotes ? (
          <VotesPlot points={points} />
        ) : (
          <NoData label="Aucun vote pour l'instant. Le total se construit au fil des endossements." />
        )}
      </Section>

      <Section
        title="Revenu vérifié"
        subtitle="Lu chez votre prestataire, jamais déclaré par vous."
      >
        {mrr ? (
          <MrrPlot days={mrr.days} currency={mrr.currency} />
        ) : (
          <NoData label="Aucune facturation connectée — vos chiffres apparaîtront ici." />
        )}
      </Section>

      <Section title="Vos fiches" subtitle="Publiées, en file de revue, rejetées.">
        <StatusPlot counts={counts} />
      </Section>
    </div>
  );
}

function NoData({ label }: { label: string }) {
  return <EmptyState illustration="none" size="sm" title={label} />;
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border/40 pt-8 pb-10 first:border-t-0 first:pt-0">
      <header className="mb-6 flex flex-col gap-1">
        <h2 className="text-[17px] font-black tracking-tight text-foreground">{title}</h2>
        <p className="text-[13px] font-medium text-muted-foreground">{subtitle}</p>
      </header>
      {children}
    </section>
  );
}
