import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DocLayout } from "@/components/ui/doc-layout";
import { Prose } from "@/components/ui/prose";
import { siteUrl } from "@/lib/site-url";
import { REVENUE_GUIDE_SLUGS, getGuideDoc, type RevenueGuideProviderSlug } from "@/lib/guides";
import { REVENUE_CONFIG_SPECS, REVENUE_LOGO_DARK_INVERT } from "@/services/revenue/types";

type Params = { provider: string };

const META: Record<RevenueGuideProviderSlug, { title: string; description: string }> = {
  stripe: {
    title: "Connecter Stripe — revenus vérifiés | Mada-Made",
    description:
      "Créez une clé Stripe restreinte en lecture seule (5 ressources) et affichez votre MRR vérifié, rafraîchi chaque heure.",
  },
  revenuecat: {
    title: "Connecter RevenueCat — revenus vérifiés | Mada-Made",
    description:
      "Créez une clé RevenueCat v2 (métriques) + ID projet et affichez votre MRR vérifié, rafraîchi chaque heure.",
  },
  paddle: {
    title: "Connecter Paddle — revenus vérifiés | Mada-Made",
    description:
      "Créez une clé Paddle (permission metrics.read) et affichez votre MRR vérifié, rafraîchi chaque heure.",
  },
  polar: {
    title: "Connecter Polar — revenus vérifiés | Mada-Made",
    description:
      "Créez un token Polar d'organisation (metrics:read) et affichez votre MRR vérifié, rafraîchi chaque heure.",
  },
  "lemon-squeezy": {
    title: "Connecter Lemon Squeezy — revenus vérifiés | Mada-Made",
    description:
      "Créez une clé Lemon Squeezy + ID boutique et affichez votre MRR vérifié, rafraîchi chaque heure.",
  },
};

export function generateStaticParams(): { provider: string }[] {
  return REVENUE_GUIDE_SLUGS.map((provider) => ({ provider }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { provider } = await params;
  const meta = (META as Record<string, { title: string; description: string }>)[provider];
  if (!meta) return { robots: { index: false, follow: false } };
  const url = `${siteUrl()}/guides/revenus-verifies/${provider}`;
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: url },
    openGraph: { title: meta.title, description: meta.description, url, type: "article" },
    twitter: { card: "summary", title: meta.title, description: meta.description },
  };
}

/** Fiche provider (contenu `content/guides/`, sommaire auto, ancres stables). */
export default async function RevenueGuideProviderPage({ params }: { params: Promise<Params> }) {
  const { provider } = await params;
  if (!(REVENUE_GUIDE_SLUGS as string[]).includes(provider)) notFound();
  const doc = await getGuideDoc(provider);
  if (!doc) notFound();
  const specs = Object.values(
    REVENUE_CONFIG_SPECS,
  ) as import("@/services/revenue/types").RevenueConfigSpec[];
  const current = specs.find((s) => s.guideSlug === provider);
  return (
    <DocLayout
      eyebrow={`Guides makers · ${current?.label ?? provider}`}
      title={`Connecter ${current?.label ?? provider} — revenus vérifiés`}
      updated="2026-10-12"
      headings={doc.headings}
      siblings={[
        { href: "/guides/revenus-verifies", label: "Vue d'ensemble" },
        ...specs
          .filter((s) => s.guideSlug !== provider)
          .map((s) => ({
            href: `/guides/revenus-verifies/${s.guideSlug}`,
            label: s.label,
            logo: s.logo,
            logoDarkInvert: REVENUE_LOGO_DARK_INVERT.includes(s.id),
          })),
      ]}
      footer={
        <p className="text-[14px] font-medium text-muted-foreground">
          Clé en main ?{" "}
          <Link
            href="/products/submit"
            className="font-bold text-foreground underline underline-offset-4"
          >
            Connectez-la depuis votre fiche
          </Link>
          .
        </p>
      }
    >
      <Prose headingIds>{doc.markdown}</Prose>
    </DocLayout>
  );
}
