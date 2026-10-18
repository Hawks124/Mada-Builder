import { ImageResponse } from "next/og";
import { getLeaderboard } from "@/services/ranking.service";

// OG classement 1200×630 (top 3 réel, première fenêtre non vide — même
// cascade que la home), cache 24 h. Jamais de 500 : fallback sans noms.
export const revalidate = 86400;

export async function GET(): Promise<Response> {
  let names: string[] = [];
  try {
    const windows = ["today", "week", "month", "all"] as const;
    for (const w of windows) {
      const board = await getLeaderboard({ window: w, page: 1 });
      if (board.items.length > 0) {
        names = board.items.slice(0, 3).map((i) => i.name);
        break;
      }
    }
  } catch {
    names = [];
  }

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 24,
        padding: "0 80px",
        background: "#0c0a09",
        color: "#fafaf9",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ fontSize: 28, fontWeight: 800, color: "#fbbf24" }}>
        Classement de la communauté
      </div>
      <div style={{ fontSize: 64, fontWeight: 900, lineHeight: 1.1 }}>
        Le classement de la tech malgache
      </div>
      {names.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {names.map((n, i) => (
            // Satori : un <div> multi-enfants exige un display explicite.
            // Ici UN seul enfant (texte interpolé) — le rang et le nom
            // s'écrivaient en deux expressions, ce qui n'échouait qu'au
            // premier classement non vide (donc jamais en CI sans données).
            <div key={n} style={{ fontSize: 34, color: "#a8a29e" }}>
              {`${i + 1}. ${n.length > 42 ? `${n.slice(0, 41).trim()}…` : n}`}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 32, color: "#a8a29e" }}>
          Apps, SaaS et outils construits à Madagascar.
        </div>
      )}
      <div style={{ fontSize: 24, color: "#78716c" }}>
        Made in Madagascar — produits tech malgaches
      </div>
    </div>,
    { width: 1200, height: 630 },
  );
}
