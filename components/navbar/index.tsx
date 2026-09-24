import { NavbarShell, type NavbarUser } from "./navbar-shell";
import { getSessionUser } from "@/lib/supabase/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

async function toNavbarUser(
  user: NonNullable<Awaited<ReturnType<typeof getSessionUser>>>,
): Promise<NonNullable<NavbarUser>> {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  // Ligne DB d'abord (vrai username + avatar uploadé), metadata en
  // fallback (trigger pas encore passé, contributeur sans backend).
  let username: string | null = null;
  let dbName: string | null = null;
  let dbAvatar: string | null = null;
  let banned = false;
  try {
    const [row] = await db
      .select({
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        bannedAt: users.bannedAt,
      })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);
    if (row) {
      username = row.username;
      dbName = row.displayName;
      dbAvatar = row.avatarUrl;
      banned = row.bannedAt !== null;
    }
  } catch {
    // Backend indisponible : metadata ci-dessous.
  }
  const name =
    dbName ??
    (meta.full_name as string | undefined) ??
    (meta.name as string | undefined) ??
    user.email?.split("@")[0] ??
    "Maker";
  const initials = name
    .split(/[\s_.-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  const avatarUrl =
    dbAvatar ??
    (meta.avatar_url as string | undefined) ??
    (meta.picture as string | undefined) ??
    null;
  const provider = (user.app_metadata?.provider as string | undefined) ?? null;
  return {
    id: user.id,
    username,
    name,
    initials: initials || "M",
    avatarUrl,
    banned,
    provider:
      provider === "github" ? "GitHub" : provider === "google" ? "Google" : (provider ?? "Email"),
  };
}

// Navbar serveur — résout la session (null sans backend, cf. middleware)
// puis délègue l'interactivité au shell client.
export async function Navbar() {
  let user: NavbarUser = null;
  try {
    const sessionUser = await getSessionUser();
    if (sessionUser) user = await toNavbarUser(sessionUser);
  } catch {
    // Backend non configuré : anonyme, UI publique complète.
  }
  return <NavbarShell user={user} />;
}
