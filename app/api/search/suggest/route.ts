import { apiCatch } from "@/lib/api/response";
import { checkLimit } from "@/lib/ratelimit";
import { searchProducts } from "@/services/discover.service";
import { getMakersSuggest } from "@/services/users.service";

/**
 * Suggest overlay nav (public, non indexé par construction — JSON seul) :
 * top produits (pertinence tsvector existante) + top makers (ilike).
 * Catégories filtrées côté client (config locale, zéro requête).
 * Debounce côté client (~200 ms) + garde q ≥ 2 + rate-limit IP best-effort.
 */
export async function GET(req: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") ?? "").trim().slice(0, 60);
    if (q.length < 2) {
      return Response.json({ products: [], makers: [] });
    }
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const { allowed } = await checkLimit({
      namespace: "search:suggest",
      id: ip,
      window: { window: "60 s", max: 60 },
    });
    if (!allowed) {
      return Response.json({ products: [], makers: [], throttled: true }, { status: 429 });
    }
    const [{ items }, makers] = await Promise.all([
      searchProducts({ q, page: 1 }).catch(() => ({ items: [], total: 0 })),
      getMakersSuggest(q, 4).catch(
        (): { username: string; displayName: string; avatarUrl: string | null }[] => [],
      ),
    ]);
    return Response.json({
      products: items.slice(0, 8).map((p) => ({
        slug: p.slug,
        name: p.name,
        tagline: p.tagline,
        iconUrl: p.iconUrl,
        votes: p.votes,
      })),
      makers,
    });
  } catch (e) {
    return apiCatch(e, "api.search.suggest");
  }
}
