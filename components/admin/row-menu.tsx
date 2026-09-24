"use client";

import * as React from "react";
import {
  DotsThreeVerticalIcon,
  GavelIcon,
  ArrowCounterClockwiseIcon,
  ShieldPlusIcon,
  UserMinusIcon,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";

/**
 * Menu d'actions d'une ligne user — MOBILE uniquement (le parent le
 * monte sous `md:hidden`, les boutons inline restant le desktop).
 * Même gardes, mêmes callbacks, mêmes états pending que l'inline :
 * ce n'est qu'un autre déclencheur, jamais une autre logique.
 * Fermeture : sélection, clic extérieur, Escape. Jamais rendu pour
 * isSelf (ni ban ni grade modifiables sur soi).
 */
export function RowMenu({
  canManageRole,
  roleLabel,
  rolePending,
  onToggleRole,
  canBan,
  banLabel,
  banTone,
  actionPending,
  onAction,
}: {
  /** Grade affichable (admin seul, jamais sur soi — déjà filtré). */
  canManageRole: boolean;
  /** "Nommer modérateur" | "Rétrograder". */
  roleLabel: string;
  rolePending: boolean;
  onToggleRole: () => void;
  /** Ban affichable (users simples uniquement — déjà filtré). */
  canBan: boolean;
  /** "Bannir" | "Débannir". */
  banLabel: string;
  /** Rouge (bannir) ou emerald (débannir). */
  banTone: "danger" | "success";
  actionPending: boolean;
  /** onToggleBan (ouvre le formulaire motif) ou onUnban. */
  onAction: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const fire = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <div ref={rootRef} className="relative md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Actions de modération"
        className={cn(
          "flex items-center justify-center h-9 w-9 rounded-full border transition-colors cursor-pointer",
          open
            ? "border-foreground/30 bg-muted/60 text-foreground"
            : "border-border/40 text-muted-foreground hover:text-foreground hover:border-border/80 hover:bg-muted/50",
        )}
      >
        <DotsThreeVerticalIcon weight="bold" className="h-5 w-5" />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Actions de modération"
          className="absolute right-0 top-10 z-50 min-w-52 rounded-2xl border border-border/60 bg-background p-1.5 shadow-xl"
        >
          {canManageRole && (
            <button
              type="button"
              role="menuitem"
              disabled={rolePending}
              onClick={() => fire(onToggleRole)}
              className="flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-[13px] font-bold text-muted-foreground hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer disabled:opacity-50"
            >
              {rolePending ? (
                <Spinner size="xs" />
              ) : roleLabel === "Rétrograder" ? (
                <UserMinusIcon weight="bold" className="h-4 w-4 shrink-0" />
              ) : (
                <ShieldPlusIcon weight="bold" className="h-4 w-4 shrink-0" />
              )}
              {roleLabel}
            </button>
          )}
          {canBan && (
            <button
              type="button"
              role="menuitem"
              disabled={actionPending}
              onClick={() => fire(onAction)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-[13px] font-bold transition-colors cursor-pointer disabled:opacity-50",
                banTone === "danger"
                  ? "text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10"
                  : "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10",
              )}
            >
              {actionPending ? (
                <Spinner size="xs" />
              ) : banTone === "danger" ? (
                <GavelIcon weight="bold" className="h-4 w-4 shrink-0" />
              ) : (
                <ArrowCounterClockwiseIcon weight="bold" className="h-4 w-4 shrink-0" />
              )}
              {banLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
