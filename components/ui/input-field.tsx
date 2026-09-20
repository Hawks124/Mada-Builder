import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { FieldBadge } from "@/components/ui/field-badge";

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  subtitle?: string;
  endAdornment?: ReactNode;
  icon?: ReactNode;
  isRequired?: boolean;
  isOptional?: boolean;
}

export function InputField({
  label,
  subtitle,
  endAdornment,
  icon,
  isRequired,
  isOptional,
  className,
  ...props
}: InputFieldProps) {
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
        {endAdornment}
      </label>
      <div
        className={cn(
          "relative rounded-2xl bg-background border border-border/60 overflow-hidden focus-within:border-foreground/40 hover:border-foreground/20 transition-colors w-full group",
          className,
        )}
      >
        {icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/60 group-focus-within:text-foreground/80 transition-colors">
            {icon}
          </div>
        )}
        <input
          className={cn(
            "w-full bg-transparent border-none py-4 text-[15px] font-medium placeholder:text-muted-foreground/30 text-foreground outline-none",
            "disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-muted/20",
            icon ? "pl-11 pr-5" : "px-5",
          )}
          {...props}
        />
      </div>
      {subtitle && (
        <span className="text-[12px] font-medium text-muted-foreground leading-relaxed">
          {subtitle}
        </span>
      )}
    </div>
  );
}
