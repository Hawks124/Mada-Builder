import { ImageResponse } from "next/og";
import { getMakerPublicProfile } from "@/services/products.service";

// OG maker 1200×630 (avatar + nom + compteurs réels), cache 24 h.
// Jamais de 500 : fallback sans avatar, 404 si inconnu.
export const revalidate = 86400;

async function avatarDataUrl(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const mime = res.headers.get("content-type") ?? "image/png";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ username: string }> },
): Promise<Response> {
  const { username } = await params;
  const data = await getMakerPublicProfile(username).catch(() => null);
  if (!data) return new Response("Introuvable", { status: 404 });
  const { profile, totals } = data;
  const avatar = await avatarDataUrl(profile.avatarUrl);
  const stats = `${totals.products} produit${totals.products === 1 ? "" : "s"} · ${totals.upvotes} votes`;

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
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatar}
          alt=""
          width={220}
          height={220}
          style={{ borderRadius: 999, objectFit: "cover" }}
        />
      ) : (
        <div
          style={{
            width: 220,
            height: 220,
            borderRadius: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 110,
            fontWeight: 900,
            background: "#EA580C",
          }}
        >
          {(profile.displayName.slice(0, 1) || "M").toUpperCase()}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 64, fontWeight: 900, lineHeight: 1.1 }}>{profile.displayName}</div>
        <div style={{ fontSize: 32, color: "#a8a29e", lineHeight: 1.3 }}>
          @{profile.username} · {stats}
        </div>
        <div style={{ fontSize: 24, color: "#78716c", marginTop: 8 }}>
          Made in Madagascar — produits tech malgaches
        </div>
      </div>
    </div>,
    { width: 1200, height: 630 },
  );
}
