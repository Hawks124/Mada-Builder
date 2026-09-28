import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalLayout } from "@/components/legal/legal-layout";
import { getLegalDoc } from "@/lib/legal";

export async function generateMetadata(): Promise<Metadata> {
  const doc = await getLegalDoc("conditions");
  if (!doc) return {};
  return {
    title: doc.title,
    description: doc.description,
    alternates: {
      canonical: "/conditions",
      languages: { "fr-FR": "/conditions" },
    },
    openGraph: {
      title: doc.title,
      description: doc.description,
      type: "article",
      locale: "fr_FR",
      url: "/conditions",
    },
  };
}

export default async function ConditionsPage() {
  const doc = await getLegalDoc("conditions");
  if (!doc) notFound();
  return (
    <LegalLayout
      doc={doc}
      siblings={[
        { href: "/confidentialite", label: "Politique de confidentialité" },
        { href: "/regles", label: "Charte de la communauté" },
      ]}
    />
  );
}
