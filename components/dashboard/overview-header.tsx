import { PlusIcon } from "@phosphor-icons/react/dist/ssr";
import { ActionButton } from "@/components/ui/action-button";
import { NotificationsBell } from "@/components/dashboard/notifications-bell";
import { PageHeader } from "@/components/dashboard/page-header";

// Greeting variant of the shared dashboard header.
export function OverviewHeader({ userName }: { userName: string }) {
  return (
    <PageHeader
      title={`Bonjour, ${userName}`}
      subtitle="Voici l'activité de vos produits."
      actions={
        <>
          <NotificationsBell />
          <ActionButton
            href="/products/submit"
            variant="primary"
            className="flex-1 sm:flex-none h-11! px-6! text-[14px]!"
          >
            <PlusIcon weight="bold" className="h-4 w-4" />
            Soumettre un produit
          </ActionButton>
        </>
      }
    />
  );
}
