"use client";

import * as React from "react";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { updateDigestPref } from "@/app/actions/settings";

/**
 * Section Notifications (settings) : récap hebdo par email. Switch à
 * effet immédiat (optimiste + revert si erreur) — pas de bouton
 * Enregistrer. Formulation positive (recevoir ON/OFF), pas de double
 * négation. L'in-app reste toujours actif (rappelé sous le switch).
 */
export function SettingsNotifications({ initialOptOut }: { initialOptOut: boolean }) {
  const [optOut, setOptOut] = React.useState(initialOptOut);
  const [pending, setPending] = React.useState(false);

  const toggle = (next: boolean) => {
    const prev = optOut;
    setOptOut(next);
    setPending(true);
    updateDigestPref(next).then((res) => {
      setPending(false);
      if (res.ok) {
        toast("ok", res.message ?? "Réglage enregistré.");
      } else {
        setOptOut(prev);
        toast("err", res.message ?? "Réglage impossible.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">
        Notifications
      </h2>
      <div className="flex items-start gap-4">
        <Switch
          checked={!optOut}
          onCheckedChange={(on) => toggle(!on)}
          disabled={pending}
          label="Recevoir le récap hebdo par email"
        />
        <div className="flex flex-col gap-1">
          <span className="text-[14px] font-bold text-foreground">Récap hebdo par email</span>
          <span className="text-[12px] font-medium text-muted-foreground leading-relaxed">
            Un email par semaine avec vos notifications non lues. Les notifications in-app restent
            toujours actives.
          </span>
        </div>
      </div>
    </div>
  );
}
