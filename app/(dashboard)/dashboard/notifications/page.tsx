import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { NotificationsList } from "@/components/dashboard/notifications-list";
import { getSessionUser } from "@/lib/supabase/server";
import { decodeKeysetCursor, encodeKeysetCursor } from "@/lib/api/pagination";
import { getNotifications } from "@/services/notifications.service";

export const metadata: Metadata = {
  title: "Notifications",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

// Centre de notifications (lot notifs) : historique keyset + non-lues.
// Jamais de HTML statique partagé (données personnelles).
export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string }>;
}) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) redirect("/signin?next=/dashboard/notifications");
  const { cursor } = await searchParams;
  const data = await getNotifications(sessionUser.id, {
    limit: 20,
    cursor: decodeKeysetCursor(cursor ?? null),
  });
  return (
    <div className="w-full px-6 lg:px-12 pt-10 lg:pt-14 pb-24 flex flex-col gap-10">
      <PageHeader
        title="Notifications"
        subtitle="Décisions, feedback reçu et paliers — tout ce qui vous concerne."
      />
      <NotificationsList
        initial={data.items}
        initialCursor={data.nextCursor ? encodeKeysetCursor(data.nextCursor) : null}
        unreadCount={data.unreadCount}
      />
    </div>
  );
}
