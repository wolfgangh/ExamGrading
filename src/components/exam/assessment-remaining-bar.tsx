"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AssessmentRemaining } from "@/lib/grades/assessment-remaining";

export function AssessmentRemainingBar({
  data,
  onJump,
}: {
  data: AssessmentRemaining;
  onJump: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  if (data.total === 0) return null;

  const left = data.remaining.length;
  const hiddenN = data.remaining.filter((p) => p.hiddenByFilter).length;

  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2",
        left === 0
          ? "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/30"
          : "border-amber-300 bg-amber-50/80 dark:border-amber-800 dark:bg-amber-950/30"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-medium">
          <ListChecks className="size-4 shrink-0" />
          {left === 0 ? (
            <span>
              Alle {data.total} in HISinOne bewertet oder als No-Show markiert
            </span>
          ) : (
            <span className="tabular-nums">
              Noch {left} von {data.total}
              <span className="font-normal text-muted-foreground">
                {" "}
                · {data.done} erledigt
                {hiddenN > 0
                  ? ` · ${hiddenN} hinter Filter/Suche`
                  : ""}
              </span>
            </span>
          )}
        </p>
        {left > 0 && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
          >
            {open ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
            Restliste
          </Button>
        )}
      </div>
      {open && left > 0 && (
        <ul className="mt-2 max-h-44 space-y-0.5 overflow-auto text-sm">
          {data.remaining.map((p) => (
            <li key={p.key}>
              <button
                type="button"
                className="w-full rounded-md px-2 py-1 text-left hover:bg-background/80"
                onClick={() => onJump(p.key)}
              >
                <span className="font-medium">{p.name}</span>
                <span className="ml-2 tabular-nums text-xs text-muted-foreground">
                  {p.key}
                  {p.hiddenByFilter ? " · nicht in der aktuellen Ansicht" : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
