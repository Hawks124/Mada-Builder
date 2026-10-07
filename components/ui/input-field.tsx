"use client";

import * as React from "react";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { FieldBadge } from "@/components/ui/field-badge";
import { useOptionalSubmitForm } from "@/components/submit/submit-form-context";

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  subtitle?: string;
  endAdornment?: ReactNode;
  icon?: ReactNode;
  isRequired?: boolean;
  isOptional?: boolean;
  /** Affiche le compteur `n / maxLength` (live). */
  showCount?: boolean;
  /** Clé d'erreur inline (erreurs du contexte, ex. "tagline"). */
  errorKey?: string;
}

export function InputField({
  label,
  subtitle,
  endAdornment,
  icon,
  isRequired,
  isOptional,
  className,
  showCount,
  errorKey,
  maxLength,
  defaultValue,
  onChange,
  name,
  ...props
}: InputFieldProps) {
  const submitCtx = useOptionalSubmitForm();
  const error = errorKey ? submitCtx?.errors[errorKey] : undefined;
  const [count, setCount] = React.useState(() => String(defaultValue ?? "").length);
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCount(e.target.value.length);
    if (errorKey) submitCtx?.clearError(errorKey);
    onChange?.(e);
  };
  const nearLimit =
    typeof maxLength === "number" && maxLength > 0 && count >= Math.floor(maxLength * 0.9);
  return (
    <div className="flex flex-col gap-2">
      <label className="text-[14px] font-bold text-foreground flex items-center justify-between">
        <span className="flex items-center gap-2 text-foreground">
          {label}
          {isRequired ? (
            <FieldBadge variant="required" />
          ) : (
            isOptional && <FieldBadge variant="optional" />
          )}
        </span>
        <span className="flex items-center gap-2">
          {showCount && typeof maxLength === "number" && (
            <span
              className={cn(
                "text-[11px] font-bold tabular-nums",
                nearLimit ? "text-red-600 dark:text-red-400" : "text-muted-foreground/70",
              )}
            >
              {count} / {maxLength}
            </span>
          )}
          {endAdornment}
        </span>
      </label>
      <div
        className={cn(
          "relative rounded-2xl bg-background border overflow-hidden focus-within:border-foreground/40 hover:border-foreground/20 transition-colors w-full group",
          error ? "border-red-500/60" : "border-border/60",
          className,
        )}
      >
        {icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/60 group-focus-within:text-foreground/80 transition-colors">
            {icon}
          </div>
        )}
        <input
          name={name}
          maxLength={maxLength}
          defaultValue={defaultValue}
          onChange={handleChange}
          aria-invalid={error ? true : undefined}
          className={cn(
            "w-full bg-transparent border-none py-4 text-[15px] font-medium placeholder:text-muted-foreground/30 text-foreground outline-none",
            "disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-muted/20",
            icon ? "pl-11 pr-5" : "px-5",
          )}
          {...props}
        />
      </div>
      {error ? (
        <span role="alert" className="text-[12px] font-bold text-red-600 dark:text-red-400">
          {error}
        </span>
      ) : (
        subtitle && (
          <span className="text-[12px] font-medium text-muted-foreground leading-relaxed">
            {subtitle}
          </span>
        )
      )}
    </div>
  );
}
