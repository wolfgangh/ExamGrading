"use client";

import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Textfeld mit optionalem X zum Leeren */
export function ClearableInput({
  value,
  onChange,
  className,
  clearLabel = "Eingabe löschen",
  ...props
}: Omit<React.ComponentProps<"input">, "value" | "onChange"> & {
  value: string;
  onChange: (value: string) => void;
  clearLabel?: string;
}) {
  const showClear = value.length > 0;

  return (
    <div className="relative">
      <Input
        {...props}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(showClear && "pr-8", className)}
      />
      {showClear && (
        <button
          type="button"
          className="absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={() => onChange("")}
          aria-label={clearLabel}
          tabIndex={-1}
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
