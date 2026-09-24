import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface ActionButtonProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href?: string;
  variant?: "primary" | "ghost" | "outline";
  isFullWidthOnMobile?: boolean;
  /** Transmis au <button> quand sans href (ex. submit de formulaire). */
  actionType?: "submit" | "button";
  disabled?: boolean;
}

export function ActionButton({
  href,
  variant = "primary",
  isFullWidthOnMobile = true,
  actionType = "button",
  disabled,
  className,
  children,
  ...props
}: ActionButtonProps) {
  // Premium animation classes: scale down on active, tiny physical lift on hover
  const base =
    "inline-flex items-center justify-center gap-2 h-12 px-7 rounded-full font-semibold text-[15px] transition-all duration-300 ease-out active:scale-[0.98] hover:-translate-y-0.5 cursor-pointer";

  const variants = {
    primary: "bg-foreground text-background shadow-md hover:shadow-lg hover:opacity-90",
    ghost: "bg-transparent text-foreground hover:bg-muted/80",
    outline:
      "bg-background border-2 border-border text-foreground hover:border-foreground/30 hover:bg-muted/50 shadow-sm",
  };

  const mobileWidth = isFullWidthOnMobile ? "w-full sm:w-auto" : "";
  const combinedClasses = cn(base, variants[variant], mobileWidth, className);

  if (href) {
    return (
      <Link
        href={href}
        className={combinedClasses}
        {...(props as React.HTMLAttributes<HTMLElement>)}
      >
        {children}
      </Link>
    );
  }

  return (
    <button
      type={actionType}
      disabled={disabled}
      className={cn(combinedClasses, "disabled:opacity-50 disabled:cursor-not-allowed")}
      {...(props as React.HTMLAttributes<HTMLElement>)}
    >
      {children}
    </button>
  );
}
