"use client";

import * as React from "react";

/**
 * `true` après le montage client (jamais pendant le SSR) — garde des
 * portails `document.body` (overlays montés sous un header en
 * backdrop-blur sinon : contexte d'empilement, panneau rogné).
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    return () => setMounted(false);
  }, []);
  return mounted;
}
