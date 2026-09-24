import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalLayout } from "@/components/legal/legal-layout";
import { getLegalDoc } from "@/lib/legal";

export async function generateMetadata(): Promise<Metadata> {
  const doc = await getLegalDoc("confidentialite");
  if (!doc) return {};
  return { title: doc.title, description: doc.description };
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
