import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalLayout } from "@/components/legal/legal-layout";
import { getLegalDoc } from "@/lib/legal";

export async function generateMetadata(): Promise<Metadata> {
  const doc = await getLegalDoc("conditions");
  if (!doc) return {};
  return { title: doc.title, description: doc.description };
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
