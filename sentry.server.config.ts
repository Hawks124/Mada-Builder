// Sentry serveur (Node.js) — DSN via env, jamais en dur (repo public).
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

const isProd = process.env.NODE_ENV === "production";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: isProd || process.env.SENTRY_FORCE_ENABLED === "1",
  environment: process.env.NODE_ENV,
  debug: false,

  // Traces : 10% en prod (quota), 100% hors prod (debug local gratuit).
  tracesSampleRate: isProd ? 0.1 : 1.0,

  // Vie privée (§16) : pas de PII par défaut, jamais de bodies.
  sendDefaultPii: false,

  // Anti-bruit : extensions navigateur et erreurs réseau bénignes.
  // Les erreurs d'hydratation restent envoyées (critiques pour nous).
  denyUrls: [/extensions\//i, /^chrome:\/\//i, /^moz-extension:\/\//i],
  ignoreErrors: [
    "ResizeObserver loop completed with undelivered notifications",
    "ResizeObserver loop limit exceeded",
    "Network request failed",
    "Failed to fetch",
    "Load failed",
    "cancelled",
    "AbortError",
  ],
});
