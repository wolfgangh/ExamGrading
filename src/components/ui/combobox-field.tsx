"use client";

import { useId } from "react";
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
}: Props) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const listId = listIdProp ?? `${inputId}-list`;

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={inputId}>{label}</Label>
      <Input
        id={inputId}
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
      />
      <datalist id={listId}>
        {options.map((opt) => (
          <option key={opt} value={opt} />
        ))}
      </datalist>
    </div>
  );
}
