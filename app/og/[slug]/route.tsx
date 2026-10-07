import { ImageResponse } from "next/og";
import { fetchProductBySlug } from "@/services/products.service";

// OG par listing (SEO-max) : 1200×630 générée (logo + nom + tagline),
// cache edge 24 h. Jamais de 500 : fallback sans logo, 404 si inconnu.
export const revalidate = 86400;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;
  const row = await fetchProductBySlug(slug).catch(() => null);
  if (!row) return new Response("Introuvable", { status: 404 });

  let logo: string | null = null;
  if (row.iconUrl) {
    try {
      const res = await fetch(row.iconUrl, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        const mime = res.headers.get("content-type") ?? "image/png";
        logo = `data:${mime};base64,${buf.toString("base64")}`;
      }
    } catch {
      logo = null;
    }
  }

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
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo}
          alt=""
          width={220}
          height={220}
          style={{ borderRadius: 48, objectFit: "cover" }}
        />
      ) : (
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
          {row.name.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 64, fontWeight: 900, lineHeight: 1.1 }}>{row.name}</div>
        <div style={{ fontSize: 32, color: "#a8a29e", lineHeight: 1.3 }}>
          {row.tagline.length > 140 ? `${row.tagline.slice(0, 139).trim()}…` : row.tagline}
        </div>
        <div style={{ fontSize: 24, color: "#78716c", marginTop: 8 }}>
          Made in Madagascar — produits tech malgaches
        </div>
      </div>
    </div>,
    { width: 1200, height: 630 },
  );
}
