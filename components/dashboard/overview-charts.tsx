import { ActivityPlot } from "@/components/charts/activity-plot";
import { FunnelPlot } from "@/components/charts/funnel-plot";
import { ProductsPlot } from "@/components/charts/products-plot";
import { VotesPlot } from "@/components/charts/votes-plot";
import { MrrPlot } from "@/components/charts/mrr-plot";
import { StatusPlot } from "@/components/charts/status-plot";
import {
  funnelTotals,
  getChartsMock,
  type ChartsMock,
} from "@/components/dashboard/dashboard-charts-mock";

/**
 * Les graphiques du tableau de bord.
 *
 * **Aucun conteneur.** Ni carte, ni fond, ni bordure : chaque bloc est posé sur
 * la page comme le sont les compteurs qui le précèdent, séparé par un filet.
 *
 * Ordre de lecture : le tunnel répond à « est-ce que quelqu'un regarde », la
 * courbe raconte l'évolution, le tableau par produit donne le détail, puis les
 * signaux faibles — votes, revenu,/files en revue.
 *
 * Outillage : Recharts pour les axes continus, HTML pour les lignes avec images.
 *
 * Le mock arrive par prop pour que le branchement réel ne change qu'un appel.
 */

export function OverviewCharts({ mock }: { mock?: ChartsMock }) {
  const data = mock ?? getChartsMock();

  return (
    <div className="flex flex-col">
      <Section
        title="Votre tunnel"
        subtitle="De la vue à la voix. Chaque étape montre où l'intérêt se perd."
      >
        <FunnelPlot totals={funnelTotals(data.points)} />
      </Section>

      <Section
        title="Vues et clics"
        subtitle="Les pics ne sont jamais du hasard : ils suivent ce que vous avez fait."
      >
        <ActivityPlot points={data.points} />
      </Section>

      <Section
        title="Par produit"
        subtitle="Trois échelles séparées : les vues écraseraient les votes."
      >
        <ProductsPlot products={data.products} />
      </Section>

      <Section title="Votes reçus" subtitle="L’élan de ceux qui vous endossent.">
        <VotesPlot points={data.points} />
      </Section>

      <Section
        title="Revenu vérifié"
        subtitle="Lu chez votre prestataire, jamais déclaré par vous."
      >
        <MrrPlot pointsCents={data.mrrCents} connected={data.revenueConnected} />
      </Section>

      <Section title="Vos fiches" subtitle="Publiées, en file de revue, rejetées.">
        <StatusPlot counts={data.counts} />
      </Section>
    </div>
  );
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
