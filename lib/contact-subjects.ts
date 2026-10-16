import type { ContactSubject } from "@/db/schema";

/**
 * Motifs `/contact` — module PUR (aucune dépendance serveur) : la page
 * publique et l'inbox admin l'importent côté client, le service côté
 * serveur. Une seule source de libellés FR.
 */
export const CONTACT_SUBJECTS: { id: ContactSubject; label: string }[] = [
  { id: "sponsoring", label: "Sponsoring" },
  { id: "partenariat", label: "Partenariat" },
  { id: "presse", label: "Presse" },
  { id: "support", label: "Support" },
  { id: "autre", label: "Autre" },
];

export function contactSubjectLabel(subject: ContactSubject): string {
  return CONTACT_SUBJECTS.find((s) => s.id === subject)?.label ?? "Autre";
}
