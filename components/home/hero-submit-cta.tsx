"use client";

import * as React from "react";
import { PlusIcon } from "@phosphor-icons/react";
import { ActionButton } from "@/components/ui/action-button";
import { createClient } from "@/lib/supabase/client";

// Submit CTA du hero — href conscient de la session : anonyme → login wall
// ?next= (funnel PRD §15), connecté → formulaire direct. Défaut sûr :
// /products/submit (le middleware rebondit de toute façon si anonyme).
export function HeroSubmitCta() {
  const [href, setHref] = React.useState("/products/submit");

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!cancelled && !session) {
          setHref("/signin?next=/products/submit");
        }
      } catch {
        setHref("/signin?next=/products/submit");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="relative group w-full sm:w-auto flex overflow-hidden rounded-full p-[1.5px]">
      {/* Base track */}
      <div className="absolute inset-0 bg-border/40 rounded-full" />
      {/* Spinning comet — light mode */}
      <div
        className="absolute left-1/2 top-1/2 h-[400%] w-[400%] -translate-x-1/2 -translate-y-1/2 animate-[spin_3.5s_linear_infinite] dark:hidden opacity-50 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background:
            "conic-gradient(from 0deg at 50% 50%, transparent 0%, transparent 40%, rgba(0,0,0,0.6) 48%, rgba(0,0,0,1) 50%, transparent 50%, transparent 90%, rgba(0,0,0,0.6) 98%, rgba(0,0,0,1) 100%)",
        }}
      />
      {/* Spinning comet — dark mode */}
      <div
        className="absolute left-1/2 top-1/2 h-[400%] w-[400%] -translate-x-1/2 -translate-y-1/2 animate-[spin_3.5s_linear_infinite] hidden dark:block opacity-50 group-hover:opacity-100 transition-opacity duration-500"
        style={{
          background:
            "conic-gradient(from 0deg at 50% 50%, transparent 0%, transparent 40%, rgba(255,255,255,0.6) 48%, rgba(255,255,255,1) 50%, transparent 50%, transparent 90%, rgba(255,255,255,0.6) 98%, rgba(255,255,255,1) 100%)",
        }}
      />
      <ActionButton
        href={href}
        variant="outline"
        className="relative w-full border-0! shadow-none! rounded-full bg-background hover:bg-background"
      >
        <PlusIcon
          weight="bold"
          className="h-4 w-4 text-muted-foreground"
        />
        Soumettre un produit
      </ActionButton>
    </div>
  );
}
