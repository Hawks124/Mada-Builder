// Sentry navigateur — DSN publique via NEXT_PUBLIC_* (par design exposée).
// Replay = premier poste de quota : session 5%, erreur 100%.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

// NODE_ENV est inliné au build : development en local, production en deploy.
const isProd = process.env.NODE_ENV === "production";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: isProd || process.env.NEXT_PUBLIC_SENTRY_FORCE_ENABLED === "1",
  environment: process.env.NODE_ENV,
  debug: false,

  integrations: [Sentry.replayIntegration()],

  tracesSampleRate: isProd ? 0.1 : 1.0,

  // Session Replay : 5% en prod (quota), 100% des sessions en erreur.
  replaysSessionSampleRate: 0.05,
  replaysOnErrorSampleRate: 1.0,

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

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
