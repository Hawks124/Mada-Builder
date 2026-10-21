import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";
import { remoteImagePatterns } from "./lib/remote-images";

const nextConfig: NextConfig = {
  /**
   * Dossier de build. Surchargable par env : un `next build` lancé
   * pendant que `next dev` tourne ÉCRASE le `.next` du dev (mêmes
   * chunks) et le serveur dev meurt en « destination stream closed
   * early » → la page affiche « network error » et le spinner tourne.
   * `NEXT_DIST_DIR=.next-build npm run build` isole les deux.
   */
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // Dev téléphone sur le LAN (HMR cross-origin) — ignoré en prod.
  // IP DHCP : ajuster si elle change (voir log "Blocked cross-origin").
  allowedDevOrigins: ["192.168.1.106"],
  experimental: {
    serverActions: {
      // Upload avatar : 10 Mo max côté service (AVATAR_MAX_INPUT_BYTES) +
      // marge multipart (~20 Ko d'overhead doc officielle). Le service
      // reste la source de vérité, jamais la config.
      bodySizeLimit: "12mb",
    },
  },
  images: {
    // Source unique lib/remote-images (statiques + domaines customs R2
    // lus depuis l'env au build — zéro changement de code au deploy).
    // SVG locaux (/logos) passent tels quels (non optimisés, sans warning).
    remotePatterns: remoteImagePatterns(),
  },
  async headers() {
    return [
      {
        // Aperçu d'une fiche pas encore publiée : jamais indexé, jamais
        // mis en cache (contenu réservé au propriétaire / au staff).
        source: "/preview/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "mada-devs",

  project: "javascript-nextjs",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Source maps par défaut (précises sans surcoût) — widenClientFileUpload
  // désactivé : double le volume d'upload pour un gain debug marginal.
  widenClientFileUpload: false,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
