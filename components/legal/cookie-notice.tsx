"use client";

import * as React from "react";
import Link from "next/link";
import { CookieIcon } from "@phosphor-icons/react";

const STORAGE_KEY = "builder-cookie-notice-seen";

export function CookieNotice() {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => {
      try {
        if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
      } catch {
        setVisible(true);
      }
    }, 1200);
    return () => clearTimeout(t);
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <aside
      role="dialog"
      aria-live="polite"
      aria-label="Informations sur les cookies"
      className="fixed bottom-5 left-5 z-90 w-[calc(100vw-2.5rem)] sm:w-auto sm:max-w-sm rounded-[10px] border border-foreground/10 bg-background/50 dark:bg-background/40 backdrop-blur-2xl backdrop-saturate-150 p-3.5 shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] transition-all animate-in fade-in slide-in-from-bottom-4 duration-300"
    >
      <div className="flex items-center gap-3">
        {/* Badge Cookie Chaleureux avec micro-effet verre */}
        <div className="h-9.5 w-9.5 rounded-xl bg-amber-500/15 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-inner">
          <CookieIcon weight="fill" className="w-5 h-5" />
        </div>

        {/* Texte explicatif */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-foreground leading-none">
            Aucun tracker ici
          </p>
          <p className="text-[11px] font-medium text-muted-foreground leading-tight mt-1">
            Que des cookies essentiels et mesure d'audience anonyme.{" "}
            <Link
              href="/confidentialite"
              className="text-foreground underline underline-offset-2 decoration-border hover:decoration-foreground transition-colors font-semibold"
            >
              En savoir plus
            </Link>
          </p>
        </div>

        {/* Bouton de fermeture */}
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-full bg-foreground/90 hover:bg-foreground text-background px-3.5 py-1.5 text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-sm"
        >
          D'accord
        </button>
      </div>
    </aside>
  );
}
