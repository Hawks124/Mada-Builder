import "./_env";
import { collectBadges } from "@/app/api/admin/badges/route";

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

async function main(): Promise<void> {
  // 1. Agrégation pure : succès partiel, jamais de 0 mensonger.
  const mixed = collectBadges(
    {
      pending: { status: "fulfilled", value: 3 },
      rejected: { status: "rejected", reason: null },
    },
    1_000,
  );
  check(
    "partiel (1 ok + 1 ko)",
    mixed.pending?.ok === true &&
      mixed.pending.value === 3 &&
      mixed.pending.at === 1_000 &&
      mixed.rejected?.ok === false &&
      mixed.rejected.value === 0 &&
      mixed.builds === undefined,
  );
  // Zéro confirmé (ok:true) ≠ inconnu (ok:false) : le shell ne montre
  // un nombre que sur ok — le test fige le contrat, pas le rendu.
  const zero = collectBadges({ contact: { status: "fulfilled", value: 0 } }, 2_000);
  check(
    "zéro confirmé (ok, at porté)",
    zero.contact?.ok === true && zero.contact.value === 0 && zero.contact.at === 2_000,
  );
  const neg = collectBadges({ builds: { status: "fulfilled", value: -4 } });
  check("négatif impossible → inconnu", neg.builds?.ok === false);

  // 2. Route : gate + méthodes (sans session = 401, jamais de 500).
  const { GET, POST } = await import("@/app/api/admin/badges/route");
  const anon = await GET(new Request("http://x/api/admin/badges"));
  const anonBody = (await anon.json()) as { ok: boolean; code: string };
  check(
    "sans session = 401 (pas de fuite, pas de 500)",
    anon.status === 401 && anonBody.ok === false && anonBody.code === "UNAUTHORIZED",
  );
  check("POST = 405", (await POST()).status === 405);

  console.log(`admin-badges: ${pass} OK, ${fail} KO`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("verify-admin-badges crash:", e instanceof Error ? e.message : e);
  process.exit(1);
});
