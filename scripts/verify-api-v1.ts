// API v1 : enveloppe, mapping d'erreurs, gardes auth, 404 JSON.
// Tests directs (handlers + helpers), SANS serveur (directive : aucun
// dev-server lancé). Usage: npx tsx scripts/verify-api-v1.ts
import "./_env";
import {
  ApiError,
  apiCatch,
  apiError,
  apiOk,
  corsPreflight,
  iso,
  methodNotAllowed,
  readJson,
  requireFile,
} from "../lib/api/response";
import { requireApiUser } from "../lib/api/auth";
import { GET as unknownGet } from "../app/api/v1/[...rest]/route";
import { GET as metaGet } from "../app/api/v1/meta/route";
import { ProfileError } from "../services/users.service";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    pass++;
  } else {
    fail++;
    console.error(`FAIL: ${name}`);
  }
}

async function body(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>;
}

async function main(): Promise<void> {
  // ── Enveloppe ───────────────────────────────────────────────────────
  {
    const res = apiOk({ a: 1 });
    const b = await body(res);
    check("ok: statut 200", res.status === 200);
    check("ok: enveloppe", b.ok === true && (b.data as { a: number }).a === 1);
    check("ok: content-type JSON", (res.headers.get("content-type") ?? "").includes("application/json"));
    check("ok: CORS", res.headers.get("access-control-allow-origin") === "*");

    const err = apiError("NOT_FOUND", "X", 404);
    const eb = await body(err);
    check("err: statut", err.status === 404);
    check("err: enveloppe", eb.ok === false && eb.code === "NOT_FOUND" && eb.message === "X");

    const pre = corsPreflight();
    check("preflight: 204", pre.status === 204);
  }

  // ── Mapping ProfileError → HTTP ─────────────────────────────────────
  {
    const cases: Array<[ProfileError["code"], number]> = [
      ["FORBIDDEN", 403],
      ["NOT_FOUND", 404],
      ["VALIDATION", 422],
      ["CONFLICT", 409],
      ["FILE_REJECTED", 422],
    ];
    for (const [code, status] of cases) {
      const res = apiCatch(new ProfileError(code, "Msg"), "test");
      const b = await body(res);
      check(`map ${code} → ${status}`, res.status === status && b.code === code && b.message === "Msg");
    }
    const api = apiCatch(new ApiError("BANNED", 403, "Susp.", { banReason: "R" }), "test");
    const ab = await body(api);
    check("map ApiError tel quel", api.status === 403 && ab.code === "BANNED" && (ab.data as { banReason: string }).banReason === "R");

    const unk = apiCatch(new Error("détail secret"), "test");
    const ub = await body(unk);
    check("map inconnu → 500 générique", unk.status === 500 && ub.code === "INTERNAL" && ub.message !== "détail secret");
  }

  // ── Corps stricts ───────────────────────────────────────────────────
  {
    const bad = new Request("http://x/", { method: "POST", body: "{nope" });
    try {
      await readJson(bad);
      check("readJson invalide → throw", false);
    } catch (e) {
      check("readJson invalide → INVALID_BODY", e instanceof ApiError && e.code === "INVALID_BODY" && e.status === 400);
    }
    const arr = new Request("http://x/", { method: "POST", body: "[1]", headers: { "content-type": "application/json" } });
    try {
      await readJson(arr);
      check("readJson tableau → throw", false);
    } catch (e) {
      check("readJson tableau → INVALID_BODY", e instanceof ApiError && e.code === "INVALID_BODY");
    }
    const good = new Request("http://x/", { method: "POST", body: '{"a":1}', headers: { "content-type": "application/json" } });
    const g = await readJson(good);
    check("readJson valide", g.a === 1);

    const empty = new FormData();
    try {
      requireFile(empty, "avatar");
      check("requireFile absent → throw", false);
    } catch (e) {
      check("requireFile absent → 422", e instanceof ApiError && e.code === "VALIDATION" && e.status === 422);
    }
    check("iso(null)", iso(null) === null);
    check("iso(date)", iso(new Date("2026-01-01T00:00:00.000Z")) === "2026-01-01T00:00:00.000Z");
  }

  // ── Garde Bearer (sans réseau : throw AVANT tout appel) ─────────────
  {
    const variants: Array<[string, Record<string, string>]> = [
      ["sans header", {}],
      ["schéma inconnu", { authorization: "Token abc" }],
      ["bearer vide", { authorization: "Bearer " }],
    ];
    for (const [name, headers] of variants) {
      try {
        await requireApiUser(new Request("http://x/", { headers }));
        check(`auth ${name} → throw`, false);
      } catch (e) {
        check(
          `auth ${name} → 401 UNAUTHORIZED`,
          e instanceof ApiError && e.code === "UNAUTHORIZED" && e.status === 401,
        );
      }
    }
  }

  // ── 404 JSON (jamais de HTML Next) ───────────────────────────────────
  {
    const res = await unknownGet(new Request("http://x/api/v1/nope"));
    const b = await body(res);
    check("catch-all: 404 JSON", res.status === 404 && b.ok === false && b.code === "NOT_FOUND");
    check("catch-all: content-type JSON", (res.headers.get("content-type") ?? "").includes("application/json"));
  }

  // ── 405 JSON + Allow ────────────────────────────────────────────────
  {
    const res = methodNotAllowed(["GET", "POST"]);
    const b = await body(res);
    check("405: statut + code", res.status === 405 && b.ok === false && b.code === "METHOD_NOT_ALLOWED");
    check("405: header Allow", (res.headers.get("allow") ?? "").includes("GET"));
  }

  // ── Token poubelle → 401 réel (appel Supabase véritable) ─────────────
  {
    try {
      await requireApiUser(new Request("http://x/", { headers: { authorization: "Bearer __invalid__" } }));
      check("auth token poubelle → throw", false);
    } catch (e) {
      check(
        "auth token poubelle → 401 UNAUTHORIZED",
        e instanceof ApiError && e.code === "UNAUTHORIZED" && e.status === 401,
      );
    }
  }

  // ── /meta : vocabulaire servi depuis les constantes sources ──────────
  {
    const res = await metaGet(new Request("http://x/api/v1/meta"));
    const b = await body(res);
    const data = b.data as {
      occupations: Array<{ id: string; label: string }>;
      defaultOccupation: string;
      providers: string[];
      limits: Record<string, number>;
    };
    check("meta: 200", res.status === 200 && b.ok === true);
    check("meta: occupations non vides", Array.isArray(data.occupations) && data.occupations.length > 0);
    check("meta: maker présent", data.occupations.some((o) => o.id === "maker" && o.label === "Maker"));
    check("meta: defaultOccupation", data.defaultOccupation === "maker");
    check("meta: limits", data.limits.appealMaxFiles === 3 && data.limits.appealCooldownHours === 24);
  }

  console.log(`api-v1: ${pass} OK, ${fail} KO`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("verify-api-v1 crash:", e instanceof Error ? e.message : e);
  process.exit(1);
});
