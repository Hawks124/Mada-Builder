"use client";

import Script from "next/script";

// Umami — mesure vie-privée (§16 : aucun pixel tiers, pas de bannière).
// Rendu en production uniquement (les visites dev pollueraient les stats).
// data-domains restreint la collecte au domaine prod (défini au deploy).
export function UmamiTracker() {
  const websiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
  if (process.env.NODE_ENV !== "production" || !websiteId) return null;

  return (
    <Script
      src={process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL ?? "https://cloud.umami.is/script.js"}
      data-website-id={websiteId}
      data-domains={process.env.NEXT_PUBLIC_UMAMI_DOMAINS}
      strategy="afterInteractive"
    />
  );
}
