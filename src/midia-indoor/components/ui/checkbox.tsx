"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@mi/lib/utils";

export interface CheckboxProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  name?: string;
  value?: string;
  id?: string;
  className?: string;
  "aria-label"?: string;
}

export const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ checked, defaultChecked, onCheckedChange, disabled, className, ...props }, ref) => {
    const [internal, setInternal] = React.useState(defaultChecked ?? false);
    const isControlled = checked !== undefined;
    const value = isControlled ? checked : internal;

    return (
      <button
        type="button"
        role="checkbox"
        aria-checked={value}
        disabled={disabled}
        ref={ref}
        onClick={(e) => {
          e.stopPropagation();
          const next = !value;
          if (!isControlled) setInternal(next);
          onCheckedChange?.(next);
        }}
        className={cn(
          "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border border-input transition-colors",
          "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          value
            ? "bg-primary border-primary text-primary-foreground"
            : "bg-background hover:bg-accent",
          className,
        )}
        {...props}
      >
        {value && <Check className="h-3 w-3" strokeWidth={3} />}
      </button>
    );
  },
);
Checkbox.displayName = "Checkbox";
