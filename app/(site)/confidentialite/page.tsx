import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalLayout } from "@/components/legal/legal-layout";
import { getLegalDoc } from "@/lib/legal";

/**
 * Métadonnées enrichies : `lastModified` pour le signal freshness, et des
 * `alternates` pour que les deux documents se déclarent mutuellement — un
 * indexé sans lien vers l'autre les traite comme deux documents orphelins.
 */
export async function generateMetadata(): Promise<Metadata> {
  const doc = await getLegalDoc("confidentialite");
  if (!doc) return {};
  return {
    title: doc.title,
    description: doc.description,
    alternates: {
      canonical: "/confidentialite",
      languages: { "fr-FR": "/confidentialite" },
    },
    openGraph: {
      title: doc.title,
      description: doc.description,
      type: "article",
      locale: "fr_FR",
      url: "/confidentialite",
    },
  };
}

export default async function ConfidentialitePage() {
  const doc = await getLegalDoc("confidentialite");
  if (!doc) notFound();
  return (
    <LegalLayout
      doc={doc}
      siblings={[
        { href: "/conditions", label: "Conditions d'utilisation" },
        { href: "/regles", label: "Charte de la communauté" },
      ]}
    />
  );
}
