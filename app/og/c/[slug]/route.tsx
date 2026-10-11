import { ImageResponse } from "next/og";
import { getCategoryById } from "@/config/categories";
import { searchProducts } from "@/services/discover.service";

// OG catégorie 1200×630 (nom + sous-titre + compte réel), cache 24 h.
// Jamais de 500 : compte à 0 si la DB ne répond pas, 404 si inconnue.
export const revalidate = 86400;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  const category = getCategoryById(slug);
  if (!category) return new Response("Introuvable", { status: 404 });
  const total = await searchProducts({ cat: category.id, sort: "votes", page: 1 })
    .then((r) => r.total)
    .catch(() => 0);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        gap: 48,
        padding: "0 80px",
        background: "#0c0a09",
        color: "#fafaf9",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          width: 220,
          height: 220,
          borderRadius: 48,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 110,
          fontWeight: 900,
          background: "#292524",
        }}
      >
        {category.name.slice(0, 1).toUpperCase()}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 64, fontWeight: 900, lineHeight: 1.1 }}>{category.name}</div>
        <div style={{ fontSize: 32, color: "#a8a29e", lineHeight: 1.3 }}>
          {category.subtitle} · {total} produit{total === 1 ? "" : "s"}
        </div>
        <div style={{ fontSize: 24, color: "#78716c", marginTop: 8 }}>
          Made in Madagascar — produits tech malgaches
        </div>
      </div>
    </div>,
    { width: 1200, height: 630 },
  );
}
