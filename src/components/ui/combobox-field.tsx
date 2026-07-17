"use client";

import { useId } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface Props {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder?: string;
  className?: string;
  listId?: string;
  required?: boolean;
  clearable?: boolean;
  onBlur?: () => void;
}

/**
 * Eingabefeld mit Vorschlagsliste (HTML datalist) – freie Eingabe erlaubt.
 */
export function ComboboxField({
  id,
  label,
  value,
  onChange,
  options,
  placeholder,
  className,
  listId: listIdProp,
  required,
  clearable = true,
  onBlur,
}: Props) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const listId = listIdProp ?? `${inputId}-list`;
  const showClear = clearable && value.length > 0;

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={inputId}>
        {label}
        {required ? " *" : ""}
      </Label>
      <div className="relative">
        <Input
          id={inputId}
          list={listId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          autoComplete="off"
          required={required}
          className={showClear ? "pr-8" : undefined}
        />
        {showClear && (
          <button
            type="button"
            className="absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => onChange("")}
            aria-label={`${label} löschen`}
            tabIndex={-1}
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>
      <datalist id={listId}>
        {options.map((opt) => (
          <option key={opt} value={opt} />
        ))}
      </datalist>
    </div>
  );
}
