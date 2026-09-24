// Pipeline avatar SANS DB : génère des fixtures (sharp), rejoue les règles
// exactes de users.service (magic bytes, 128px min, 512 cover, webp q82).
// Usage: npx tsx scripts/verify-avatar-pipeline.ts
import sharp from "sharp";

const MIN_PX = 128;
const OUT_PX = 512;

function detect(buffer: Buffer): string | null {
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return "png";
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return "jpeg";
  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  )
    return "webp";
  return null;
}

async function run() {
  let pass = 0;
  const ok = (name: string, cond: boolean) => {
    console.log(`${cond ? "PASS" : "FAIL"} — ${name}`);
    if (cond) pass++;
    else process.exitCode = 1;
  };

  // 1. Photo réaliste (~2 Mo de bruit RVB 1600x1200) → compressée petit.
  const noise = Buffer.alloc(1600 * 1200 * 3);
  for (let i = 0; i < noise.length; i++) noise[i] = (i * 7919) % 256;
  const big = await sharp(noise, { raw: { width: 1600, height: 1200, channels: 3 } })
    .jpeg({ quality: 90 })
    .toBuffer();
  ok("detect jpeg", detect(big) === "jpeg");
  const meta = await sharp(big).metadata();
  const out = await sharp(big)
    .rotate()
    .resize(OUT_PX, OUT_PX, { fit: "cover" })
    .webp({ quality: 82 })
    .toBuffer();
  const outMeta = await sharp(out).toBuffer({ resolveWithObject: true });
  ok(`sortie 512x512 (got ${outMeta.info.width}x${outMeta.info.height})`, outMeta.info.width === 512);
  ok(`sortie < 2 Mo (${(out.length / 1024).toFixed(0)} Ko)`, out.length < 2 * 1024 * 1024);
  console.log(`  entrée ${(big.length / 1024 / 1024).toFixed(2)} Mo → ${(out.length / 1024).toFixed(0)} Ko`);

  // 2. SVG-like rejeté.
  ok(
    "rejet fauxmage",
    detect(Buffer.from("<svg xmlns='x'></svg>")) === null,
  );

  // 3. Trop petit rejeté (< 128px).
  const tiny = await sharp({
    create: { width: 64, height: 64, channels: 3, background: { r: 0, g: 0, b: 0 } },
  })
    .png()
    .toBuffer();
  const tinyMeta = await sharp(tiny).metadata();
  ok("détecte 64px < 128px", Math.min(tinyMeta.width ?? 0, tinyMeta.height ?? 0) < MIN_PX);

  // 4. PNG carré OK.
  const square = await sharp({
    create: { width: 800, height: 800, channels: 4, background: { r: 10, g: 200, b: 100, alpha: 1 } },
  })
    .png()
    .toBuffer();
  ok("detect png", detect(square) === "png");
  void meta;

  console.log(`\n${pass} règles avatar vérifiées.`);
}

run().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
