// Vérification d'URLs : verdicts via serveur loopback éphémère +
// blocage SSRF. Aucun réseau externe (127.0.0.1 random port, fermé
// après). `allowPrivateHosts` n'existe QUE pour ces tests — l'endpoint
// ne l'expose jamais.
// Usage: npx tsx scripts/verify-url-check.ts
import "../scripts/_env";
import { createServer } from "node:http";
import { AddressInfo } from "node:net";
import {
  checkUrl,
  classifyForSubmit,
  matchStorePattern,
  verdictMessage,
} from "../services/url-check.service";

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
  // Blocage SSRF — sans serveur (pur). `force` : ces URLs ont pu être
  // vérifiées (et cachées en erreur) par des runs précédents — on teste
  // la LOGIQUE, pas le cache (test cache dédié plus bas).
  for (const [name, url, verdict] of [
    ["localhost", "http://localhost:3000/x", "private_host"],
    ["ipv4 loopback", "http://127.0.0.1:3000/x", "private_host"],
    ["ipv4 décimal", "http://2130706433/", "private_host"],
    ["ipv6 loopback", "http://[::1]/x", "private_host"],
    ["metadata cloud", "http://169.254.169.254/x", "private_host"],
    ["rfc1918", "http://10.0.0.1/x", "private_host"],
    ["file", "file:///etc/passwd", "invalid"],
    ["javascript", "javascript:alert(1)", "invalid"],
    ["data", "data:text/plain,hi", "invalid"],
    ["pas une url", "not a url", "invalid"],
    ["single-label", "http://intranet/x", "private_host"],
  ] as Array<[string, string, string]>) {
    const r = await checkUrl(url, { allowPrivateHosts: false, force: true });
    check(`blocage ${name} → ${verdict}`, r.verdict === verdict);
  }

  // Serveur loopback (autorisé ici seulement) :
  const big = Buffer.alloc(3 * 1024 * 1024, "x");
  const server = createServer((req, res) => {
    if (req.url === "/ok") {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("ok");
    } else if (req.url === "/missing") {
      res.writeHead(404);
      res.end();
    } else if (req.url === "/gone") {
      res.writeHead(410);
      res.end();
    } else if (req.url === "/auth") {
      res.writeHead(401);
      res.end();
    } else if (req.url === "/redir") {
      res.writeHead(302, { location: "/ok" });
      res.end();
    } else if (req.url === "/big") {
      res.writeHead(200, { "content-length": String(big.length) });
      res.end(big);
    } else if (req.url === "/slow") {
      setTimeout(() => {
        res.writeHead(200);
        res.end("trop tard");
      }, 12000).unref?.();
    } else if (req.url === "/nohead") {
      if (req.method === "HEAD") {
        res.writeHead(405);
        res.end();
      } else {
        res.writeHead(200, { "content-type": "text/plain" });
        res.end("ok");
      }
    } else {
      res.writeHead(500);
      res.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  const base = `http://127.0.0.1:${port}`;
  try {
    const ok = await checkUrl(`${base}/ok`, { allowPrivateHosts: true });
    check("200 → ok", ok.verdict === "ok" && ok.status === 200);
    check("finalUrl renseignée", ok.finalUrl === `${base}/ok` || ok.finalUrl === `${base}/ok/`);
    const okCached = await checkUrl(`${base}/ok`, { allowPrivateHosts: true });
    check("2e appel → cache (zéro fetch)", okCached.cached === true && okCached.verdict === "ok");

    const missing = await checkUrl(`${base}/missing`, { allowPrivateHosts: true });
    check("404 → not_found", missing.verdict === "not_found");

    const gone = await checkUrl(`${base}/gone`, { allowPrivateHosts: true });
    check("410 → gone", gone.verdict === "gone");

    const auth = await checkUrl(`${base}/auth`, { allowPrivateHosts: true });
    check("401 → auth_required", auth.verdict === "auth_required");

    const redir = await checkUrl(`${base}/redir`, { allowPrivateHosts: true });
    check("redirect suivie → ok", redir.verdict === "ok");

    const nohead = await checkUrl(`${base}/nohead`, { allowPrivateHosts: true });
    check("HEAD 405 → repli GET ok", nohead.verdict === "ok");

    const bigRes = await checkUrl(`${base}/big`, { allowPrivateHosts: true });
    check("3 Mo non téléchargés, verdict ok", bigRes.verdict === "ok");

    const slow = await checkUrl(`${base}/slow`, { allowPrivateHosts: true });
    check("12 s → timeout", slow.verdict === "timeout");

    // Politique submit/profil :
    check("ok → ok", classifyForSubmit("ok") === "ok");
    check("invalid → block", classifyForSubmit("invalid") === "block");
    check("private_host → block", classifyForSubmit("private_host") === "block");
    check("dns_error → block", classifyForSubmit("dns_error") === "block");
    check("timeout → block", classifyForSubmit("timeout") === "block");
    check("not_found → warn", classifyForSubmit("not_found") === "warn");
    check("auth_required → warn", classifyForSubmit("auth_required") === "warn");
    check("server_error → warn", classifyForSubmit("server_error") === "warn");

    // Forme stores :
    check(
      "apple forme ok",
      matchStorePattern("https://apps.apple.com/mg/app/x/id123456789", {
        hosts: ["apps.apple.com"],
        idPattern: /\/id\d+/,
      }),
    );
    check(
      "apple sans id → ko",
      !matchStorePattern("https://apps.apple.com/mg/app/x", {
        hosts: ["apps.apple.com"],
        idPattern: /\/id\d+/,
      }),
    );
    check(
      "mauvais host → ko",
      !matchStorePattern("https://evil.com/mg/app/x/id123", {
        hosts: ["apps.apple.com"],
        idPattern: /\/id\d+/,
      }),
    );

    // Messages FR présents :
    check("message FR", verdictMessage("timeout").length > 10);
  } finally {
    server.close();
  }

  console.log(`url-check: ${pass} OK, ${fail} KO`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("verify-url-check crash:", e instanceof Error ? e.message : e);
  process.exit(1);
});
