// Calcul pur du crop avatar (lib/avatar-crop.ts) : bornes + carré.
// Le rendu canvas/DOM se QA en manuel (portrait/paysage/carré + tactile).
// Usage: npx tsx scripts/verify-avatar-crop.ts
import { AVATAR_CROP_OUT_PX, cropOutputSize } from "../lib/avatar-crop";

let pass = 0;
const ok = (name: string, cond: boolean) => {
  console.log(`${cond ? "PASS" : "FAIL"} — ${name}`);
  if (cond) pass++;
  else process.exitCode = 1;
};

ok("borne 512", AVATAR_CROP_OUT_PX === 512);
ok(
  "grand crop → 512",
  JSON.stringify(cropOutputSize({ x: 0, y: 0, width: 2000, height: 3000 })) ===
    JSON.stringify({ width: 512, height: 512 }),
);
ok(
  "petit crop conservé",
  JSON.stringify(cropOutputSize({ x: 0, y: 0, width: 300, height: 300 })) ===
    JSON.stringify({ width: 300, height: 300 }),
);
ok(
  "rectangulaire → côté min",
  JSON.stringify(cropOutputSize({ x: 0, y: 0, width: 800, height: 400 })) ===
    JSON.stringify({ width: 400, height: 400 }),
);
ok(
  "dégénéré → 1px (jamais 0)",
  JSON.stringify(cropOutputSize({ x: 0, y: 0, width: 0, height: 0 })) ===
    JSON.stringify({ width: 1, height: 1 }),
);

console.log(`\n${pass} checks OK`);
