import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DocLayout } from "@/components/ui/doc-layout";
import { Prose } from "@/components/ui/prose";
import { ProviderTable } from "@/components/revenue/provider-table";
import { siteUrl } from "@/lib/site-url";
import { slugifyHeading } from "@/lib/slug";
import { getGuideDoc } from "@/lib/guides";
import { REVENUE_CONFIG_SPECS, REVENUE_LOGO_DARK_INVERT } from "@/services/revenue/types";

export const metadata: Metadata = {
  title: "Revenus vérifiés — mode d'emploi | Mada-Made",
  description:
    "Connectez Stripe, RevenueCat, Paddle, Polar ou Lemon Squeezy en lecture seule et affichez votre MRR vérifié : scopes exacts, révocation, badge seul.",
  alternates: { canonical: `${siteUrl()}/guides/revenus-verifies` },
};

export const dynamic = "force-dynamic";

/**
 * Hub revenus vérifiés (contenu `content/guides/`, sommaire auto). La
 * table « Les 5 providers » vit dans `<ProviderTable/>` (pilotée par les
 * specs, jamais recopiée en markdown) : le `.md` est coupé en deux
 * autour de « ## Connecter », et l'entrée de sommaire est réinsérée à
 * sa place (après « Ce que prouve le badge »).
 */
export default async function RevenueGuideHubPage() {
  const doc = await getGuideDoc("revenus-verifies");
  if (!doc) notFound();
  const [beforeConnect, afterConnect] = doc.markdown.split("## Connecter");
  const tableHeading = { id: slugifyHeading("Les 5 providers"), text: "Les 5 providers" };
  const connectAt = doc.headings.findIndex((h) => h.id === slugifyHeading("Connecter (2 minutes)"));
  const headings =
    connectAt > 0
      ? [...doc.headings.slice(0, connectAt), tableHeading, ...doc.headings.slice(connectAt)]
      : [...doc.headings, tableHeading];
  return (
    <DocLayout
      eyebrow="Guides makers · Bêta"
      title="Revenus vérifiés — mode d'emploi"
      description="Prouvez vos revenus en lecture seule, sans exposer vos clients ni vos montants si vous ne voulez pas."
      updated="2026-10-12"
      headings={headings}
      siblings={(
        Object.values(
          REVENUE_CONFIG_SPECS,
        ) as import("@/services/revenue/types").RevenueConfigSpec[]
      ).map((spec) => ({
        href: `/guides/revenus-verifies/${spec.guideSlug}`,
        label: spec.label,
        logo: spec.logo,
        logoDarkInvert: REVENUE_LOGO_DARK_INVERT.includes(spec.id),
      }))}
      footer={
        <p className="text-[14px] font-medium text-muted-foreground">
          Prêt ?{" "}
          <Link
            href="/products/submit"
            className="font-bold text-foreground underline underline-offset-4"
          >
            Publiez puis connectez
          </Link>
          .
        </p>
      }
    >
      <Prose headingIds>{beforeConnect ?? doc.markdown}</Prose>
      <ProviderTable />
      {afterConnect !== undefined && <Prose headingIds>{`## Connecter${afterConnect}`}</Prose>}
    </DocLayout>
  );
}
