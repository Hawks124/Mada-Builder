import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { ContactInbox } from "@/components/admin/contact-inbox";
import { getContactInboxAction } from "@/app/actions/contact";
import { CONTACT_SUBJECTS } from "@/lib/contact-subjects";
import type { ContactStatus } from "@/db/schema";
import { cn } from "@/lib/utils";

// noindex strict — jamais indexé, même au backend.
export const metadata: Metadata = {
  title: "Admin — Contact",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const FILTERS: { id: ContactStatus | "all"; label: string }[] = [
  { id: "all", label: "Tous" },
  { id: "new", label: "Nouveaux" },
  { id: "read", label: "Lus" },
  { id: "replied", label: "Répondus" },
  { id: "archived", label: "Archivés" },
];

/**
 * Inbox contact (staff) : file par statut, réponse via client mail
 * (mailto pré-rempli dans chaque ligne — pas de composeur). Les motifs
 * sponsoring/partenariat sont des leads : la file `new` est la priorité.
 */
export default async function AdminContactPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const raw = typeof sp.status === "string" ? sp.status : "new";
  const status: ContactStatus | "all" = (
    ["all", "new", "read", "replied", "archived"] as const
  ).includes(raw as ContactStatus)
    ? (raw as ContactStatus | "all")
    : "new";
  const items = await getContactInboxAction(status === "all" ? undefined : status);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8 pt-10 md:pt-14 pb-24 flex flex-col gap-8">
      <PageHeader
        title="Contact"
        subtitle={`${items.length} message${items.length === 1 ? "" : "s"} — réponse sous 5 jours ouvrés, via votre client mail.`}
      />
      <nav aria-label="Filtrer par statut" className="flex items-center gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <Link
            key={f.id}
            href={
              f.id === "all"
                ? "/admin/contact?status=all"
                : f.id === "new"
                  ? "/admin/contact"
                  : `/admin/contact?status=${f.id}`
            }
            aria-current={status === f.id ? "page" : undefined}
            className={cn(
              "rounded-full px-4 py-2 text-[13px] font-bold transition-colors border",
              status === f.id
                ? "bg-foreground text-background border-transparent"
                : "border-border/60 text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
          </Link>
        ))}
      </nav>
      {/* Motifs rappelés sous les filtres : un coup d'œil suffit à trier. */}
      <p className="text-[12px] font-medium text-muted-foreground -mt-4">
        Motifs : {CONTACT_SUBJECTS.map((s) => s.label).join(" · ")}
      </p>
      <ContactInbox initial={items} />
    </main>
  );
}
