import * as React from "react";

// Shared dashboard page header — title + sub + optional right actions.
// Same pattern everywhere, otherwise the shell feels incoherent.
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-foreground">
          {title}
        </h1>
        <p className="text-[15px] md:text-base font-medium text-muted-foreground">
          {subtitle}
        </p>
      </div>
      {actions && (
        <div className="flex items-center gap-3 w-full sm:w-auto shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
