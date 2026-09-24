"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircleIcon,
  WarningCircleIcon,
  InfoIcon,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import {
  TOAST_PARAM,
  isToastTone,
  parseToastParam,
  type ToastTone,
} from "@/lib/toast";

// Design repris tel quel de l'ancien AuthToast (pill flottante,
// blur, montée/exit) — seule la source change (?toast= partagé).
const TONE_STYLE: Record<
  ToastTone,
  {
    icon: typeof CheckCircleIcon;
    ring: string;
    glow: string;
    chip: string;
    text: string;
  }
> = {
  ok: {
    icon: CheckCircleIcon,
    ring: "border-emerald-500/20",
    glow: "shadow-[0_8px_32px_0_rgba(16,185,129,0.12)]",
    chip: "bg-emerald-500/15",
    text: "text-emerald-500 dark:text-emerald-400",
  },
  err: {
    icon: WarningCircleIcon,
    ring: "border-red-500/20",
    glow: "shadow-[0_8px_32px_0_rgba(239,68,68,0.12)]",
    chip: "bg-red-500/15",
    text: "text-red-500 dark:text-red-400",
  },
  info: {
    icon: InfoIcon,
    ring: "border-border/60",
    glow: "shadow-[0_8px_32px_0_rgba(0,0,0,0.08)]",
    chip: "bg-muted/60",
    text: "text-muted-foreground",
  },
};

/**
 * Viewport toast partagé — monté une fois au root layout (sous Suspense,
 * useSearchParams l'exige). Deux alimentations :
 * - URL (?toast=tone:message) : post-redirect serveur, consommé une fois
 *   puis nettoyé (canal principal — survit aux redirect) ;
 * - event (toast("ok", "...")) : opérations sur place réussies côté client
 *   (ex. avatar). Même design, mêmes timers dans les deux cas.
 * Un seul toast V1 (dernier gagne).
 */
export function toast(tone: ToastTone, message: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<AppToastDetail>("app:toast", {
      detail: { tone: isToastTone(tone) ? tone : "info", message },
    }),
  );
}

type AppToastDetail = { tone: ToastTone; message: string };

export function ToastViewport() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mounted, setMounted] = React.useState(false);
  const [isExiting, setIsExiting] = React.useState(false);
  const [toast, setToast] = React.useState<{
    tone: ToastTone;
    message: string;
  } | null>(null);

  React.useEffect(() => {
    const parsed = parseToastParam(searchParams.get(TOAST_PARAM));
    if (!parsed) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToast(parsed);
    setMounted(true);
    setIsExiting(false);

    // Nettoyage de l'URL (consommé une fois — pas de rejou au refresh).
    const params = new URLSearchParams(searchParams.toString());
    params.delete(TOAST_PARAM);
    const clean = params.toString();
    router.replace(`${window.location.pathname}${clean ? `?${clean}` : ""}`, {
      scroll: false,
    });
  }, [searchParams, router]);

  React.useEffect(() => {
    if (!mounted) return;

    const exitTimer = setTimeout(() => setIsExiting(true), 4700);
    const unmountTimer = setTimeout(() => setMounted(false), 5000);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(unmountTimer);
    };
  }, [mounted]);

  // Alimentation impérative (opérations sur place, ex. avatar) — mêmes
  // timers que la voie URL (l'effet ci-dessus réagit à `mounted`).
  React.useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<AppToastDetail>).detail;
      if (!detail || typeof detail.message !== "string") return;
      const message = detail.message.trim().slice(0, 120);
      if (message === "") return;
      setToast({ tone: detail.tone, message });
      setMounted(true);
      setIsExiting(false);
    };
    window.addEventListener("app:toast", handler);
    return () => window.removeEventListener("app:toast", handler);
  }, []);

  if (!mounted || !toast) return null;
  const style = TONE_STYLE[toast.tone];
  const Icon = style.icon;

  return (
    <div
      role={toast.tone === "err" ? "alert" : "status"}
      className={cn(
        "fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 rounded-full border bg-background/60 dark:bg-background/40 backdrop-blur-2xl backdrop-saturate-150 px-3 py-2.5 transition-all duration-300 ease-out",
        style.ring,
        style.glow,
        isExiting
          ? "opacity-0 translate-y-4 scale-95"
          : "animate-in fade-in slide-in-from-bottom-8 zoom-in-95",
      )}
    >
      <div
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-full shrink-0 shadow-inner",
          style.chip,
        )}
      >
        <Icon weight="fill" className={cn("h-4 w-4", style.text)} />
      </div>

      <span className="text-[13.5px] font-semibold text-foreground pr-2 tracking-tight">
        {toast.message}
      </span>
    </div>
  );
}
