"use client";

import { useId, useState } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClearableInput } from "@/components/ui/clearable-input";
import { Label } from "@/components/ui/label";
import { LECTURER_OPTIONS } from "@/lib/exam-catalog";

export function LecturerPicker({
  value,
  onChange,
  label = "Dozenten",
  id,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  label?: string;
  /** Optionale feste id (sonst useId) für datalist */
  id?: string;
}) {
  const reactId = useId();
  const baseId = id ?? `lecturers-${reactId.replace(/:/g, "")}`;
  const listId = `${baseId}-options`;
  const [draft, setDraft] = useState("");

  const add = (raw?: string) => {
    const name = (raw ?? draft).trim();
    if (!name) return;
    const exists = value.some(
      (l) => l.toLowerCase() === name.toLowerCase()
    );
    if (!exists) onChange([...value, name]);
    setDraft("");
  };

  const remove = (name: string) => {
    onChange(value.filter((l) => l !== name));
  };

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={`${baseId}-input`}>{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {value.map((l) => (
          <Badge
            key={l}
            variant="secondary"
            className="gap-1 pr-1 font-normal"
          >
            {l}
            <button
              type="button"
              className="rounded-sm p-0.5 hover:bg-muted"
              onClick={() => remove(l)}
              aria-label={`${l} entfernen`}
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}
        {value.length === 0 && (
          <span className="text-sm text-muted-foreground">
            Kein Dozent ausgewählt
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <ClearableInput
            id={`${baseId}-input`}
            list={listId}
            value={draft}
            onChange={setDraft}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder="Dozent wählen oder eingeben…"
            autoComplete="off"
            clearLabel="Dozenteneingabe löschen"
          />
          <datalist id={listId}>
            {LECTURER_OPTIONS.map((opt) => (
              <option key={opt} value={opt} />
            ))}
          </datalist>
        </div>
        <Button type="button" variant="outline" onClick={() => add()}>
          Hinzufügen
        </Button>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Vorschlag aus der Liste wählen oder Namen manuell eingeben und
        hinzufügen.
      </p>
    </div>
  );
}
