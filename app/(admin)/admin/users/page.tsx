import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/page-header";
import { UsersTable } from "@/components/admin/users-table";

// noindex strict — jamais indexé, même au backend.
export const metadata: Metadata = {
  title: "Admin — Utilisateurs",
  robots: { index: false, follow: false },
};

// Modération users : BAN UNIQUEMENT (réversible + appels illimités).
// Pas de suppression user côté admin. TODO(auth): role-gate server.
export default function AdminUsersPage() {
  return (
    <div className="w-full px-6 lg:px-12 pt-10 lg:pt-14 pb-24 flex flex-col gap-10">
      <PageHeader
        title="Utilisateurs"
        subtitle="Bannir (motif requis, réversible) ou débannir. Aucune suppression — l'arme lourde vit au niveau produit."
      />
      <UsersTable />
    </div>
  );
}
