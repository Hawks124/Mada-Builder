import { ImageResponse } from "next/og";

// OG par défaut du site (partages home / discover / pages sans OG dédiée),
// 1200×630 statique, cache 24 h. Jamais de 500 : aucun fetch.
export const revalidate = 86400;

export function GET(): Response {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 20,
        padding: "0 80px",
        background: "#0c0a09",
        color: "#fafaf9",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ fontSize: 72, fontWeight: 900, lineHeight: 1.05 }}>Made in Madagascar</div>
      <div style={{ fontSize: 34, color: "#a8a29e", lineHeight: 1.3 }}>
        L&apos;annuaire des produits tech malgaches — SaaS, apps et outils des makers d&apos;ici.
      </div>
    </div>,
    { width: 1200, height: 630 },
  );
}
