import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

/**
 * Proxy (convention Next 16, ex-`middleware`) — Tier 1 (users) :
 * /dashboard/*, /settings, /products/submit → session exigée.
 * Tier 2 (staff) : /admin/* → session + rôle admin|moderateur, lu dans le
 * JWT app_metadata (zéro requête DB — miroir documenté dans docs/auth.md).
 * JWT sans rôle (promotion récente, token pré-miroir) → UNE requête
 * rôle-table avant de refuser : la promotion est effective immédiatement,
 * sans dépendre du refresh token. Cas rare, chemin rapide inchangé.
 * Non connecté → /signin?next=<path> (retour post-login, boucle vanity).
 * Non staff → / (pas de 403 qui confirme l'existence de l'admin).
 * Double-check server dans les layouts (défense en profondeur).
 * Runtime nodejs imposé par Next (aucune API edge utilisée ici).
 */
export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Sans clés : pas de backend à vérifier contre (contributeur sans compte).
  // L'app tourne en mock — documenté dans docs/auth.md. Dès que les clés
  // existent, l'enforcement est total, en dev comme en prod.
  if (!url || !anon) return response;

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const { pathname, search } = request.nextUrl;

  // Distingue invité PROUVÉ vs incident (même règle que getViewer :
  // statuts 401/403/404 = invité, tout le reste = incident).
  // Incident → on laisse passer (les layouts tranchent) : rediriger ici
  // produisait des boucles sous hoquet réseau (jamais de redirect sur
  // du non-vérifié). Retry unique, happy path inchangé (un seul appel).
  type ProxyUser = { id: string; app_metadata: Record<string, unknown> };
  let user: ProxyUser | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const {
        data: { user: fetched },
        error,
      } = await supabase.auth.getUser();
      if (error) {
        const status = (error as { status?: unknown }).status;
        if (
          typeof status === "number" &&
          (status === 400 || status === 401 || status === 403 || status === 404)
        ) {
          break;
        }
        throw error;
      }
      user = fetched as unknown as ProxyUser;
      break;
    } catch (e) {
      const status = (e as { status?: unknown })?.status;
      if (
        typeof status === "number" &&
        (status === 400 || status === 401 || status === 403 || status === 404)
      ) {
        break;
      }
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        continue;
      }
      return response;
    }
  }

  if (!user) {
    const signin = new URL("/signin", request.url);
    signin.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(signin);
  }

  if (pathname.startsWith("/admin")) {
    const role = (user.app_metadata as { role?: string })?.role;
    if (role !== "admin" && role !== "moderateur") {
      // Fallback DB (promotion récente, JWT pré-miroir) — une seule
      // requête, uniquement quand le JWT ne tranche pas.
      try {
        const [row] = await db
          .select({ role: users.role })
          .from(users)
          .where(eq(users.id, user.id))
          .limit(1);
        if (!row || (row.role !== "admin" && row.role !== "moderateur")) {
          return NextResponse.redirect(new URL("/", request.url));
        }
      } catch {
        return NextResponse.redirect(new URL("/", request.url));
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/settings",
    "/products/submit",
    // "/admin" seul n'est PAS couvert par "/admin/:path*" — les deux requis.
    "/admin",
    "/admin/:path*",
  ],
};
