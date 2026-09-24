"use client";

import * as React from "react";

/**
 * Champ caché `timeZone` (IANA réel du navigateur) pour les formulaires
 * serveur (onboarding, profil). Valeur posée en effect — jamais au rendu
 * (pas de mismatch d'hydratation : le SSR ne connaît pas le fuseau du
 * visiteur). Le serveur valide contre `Intl.supportedValuesOf`.
 */
export function TimeZoneField() {
  const ref = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (ref.current && tz) ref.current.value = tz;
    } catch {
      // Fuseau illisible : champ vide, le serveur applique son repli.
    }
  }, []);

  return <input ref={ref} type="hidden" name="timeZone" value="" />;
}
