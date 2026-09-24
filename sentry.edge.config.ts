// Sentry edge (edge routes) — même politique que serveur.
// Note : le proxy auth est en runtime nodejs (Next 16), couvert par la
// config serveur, pas ici.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

const isProd = process.env.NODE_ENV === "production";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: isProd || process.env.SENTRY_FORCE_ENABLED === "1",
  environment: process.env.NODE_ENV,
  debug: false,

  tracesSampleRate: isProd ? 0.1 : 1.0,

  sendDefaultPii: false,

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
