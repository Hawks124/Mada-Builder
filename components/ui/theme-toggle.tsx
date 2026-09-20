"use client";

import { MoonIcon, SunIcon } from "@phosphor-icons/react";
import { useTheme } from "next-themes";
import { useState, useCallback, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

function useMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function ThemeToggle() {
  const { setTheme, theme, resolvedTheme } = useTheme();
  const mounted = useMounted();
  const [isAnimating, setIsAnimating] = useState(false);

  const handleToggle = useCallback(() => {
    // Trigger the micro-animation on the button
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 300);

    // Inject transient transition class to HTML for the exact duration of the fade,
    // avoiding permanent sluggishness on standard hover effects across the app.
    document.documentElement.classList.add("theme-transition");
    setTimeout(() => {
      document.documentElement.classList.remove("theme-transition");
    }, 450);

    const isDark = theme === "dark" || resolvedTheme === "dark";
    setTheme(isDark ? "light" : "dark");
  }, [theme, resolvedTheme, setTheme]);

  if (!mounted) {
    return <div className="h-10 w-10 shrink-0" aria-hidden="true" />;
  }

  const isDark = theme === "dark" || resolvedTheme === "dark";

  return (
    <button
      onClick={handleToggle}
      className={cn(
        "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted/60 text-foreground transition-all duration-300 ease-out cursor-pointer hover:bg-muted/80 ring-1 ring-border/20",
        isAnimating && "scale-90"
      )}
      aria-label="Toggle theme"
    >
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]",
          isDark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0"
        )}
      >
        <MoonIcon weight="bold" className="h-[18px] w-[18px] text-foreground" />
      </div>

      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]",
          !isDark ? "rotate-0 scale-100 opacity-100" : "rotate-90 scale-50 opacity-0"
        )}
      >
        <SunIcon weight="bold" className="h-[18px] w-[18px] text-foreground" />
      </div>
    </button>
  );
}
