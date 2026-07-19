"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { EnrichedStudentRow, ExamProject } from "@/lib/types";
import {
  countInGroup,
  sortedStudentGroups,
} from "@/lib/student-groups";
import { cn } from "@/lib/utils";

const NONE = "__none__";

export function StudentGroupSelect({
  project,
  groupId,
  onChange,
  className,
  compact,
  rows,
  highlightEmpty,
}: {
  project: ExamProject;
  groupId: string | null | undefined;
  onChange: (groupId: string | null) => void;
  className?: string;
  compact?: boolean;
  /** Für Anzeige der Personenzahl pro Gruppe */
  rows?: EnrichedStudentRow[];
  /** Unzugeordneten Trigger hervorheben */
  highlightEmpty?: boolean;
}) {
  const groups = sortedStudentGroups(project);
  if (groups.length === 0) {
    return (
      <span className="text-[10px] text-muted-foreground">–</span>
    );
  }

  const value = groupId && groups.some((g) => g.id === groupId) ? groupId : NONE;
  const unassigned = value === NONE;
  const showCounts = rows != null && rows.length >= 0;
  const noneCount = showCounts ? countInGroup(rows, "none") : null;

  const labelFor = (id: string, name: string) => {
    if (!showCounts || rows == null) return name;
    const n = countInGroup(rows, id);
    return `${name} · ${n}`;
  };

  return (
    <Select
      value={value}
      onValueChange={(v) => {
        if (!v || v === NONE) onChange(null);
        else onChange(v);
      }}
    >
      <SelectTrigger
        className={cn(
          compact ? "h-7 min-w-[6.5rem] text-xs" : "w-full",
          highlightEmpty &&
            unassigned &&
            "border-amber-500/70 bg-amber-50 text-amber-950 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-50",
          className
        )}
      >
        <SelectValue placeholder="Gruppe">
          {value === NONE
            ? showCounts && noneCount != null
              ? `– · ${noneCount}`
              : "–"
            : labelFor(
                value,
                groups.find((g) => g.id === value)?.name ?? "–"
              )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>
          {showCounts && noneCount != null
            ? `Keine Gruppe · ${noneCount}`
            : "Keine Gruppe"}
        </SelectItem>
        {groups.map((g) => {
          const n = showCounts && rows != null ? countInGroup(rows, g.id) : null;
          const empty = n === 0;
          return (
            <SelectItem
              key={g.id}
              value={g.id}
              className={cn(
                empty &&
                  "text-amber-900 dark:text-amber-100 data-highlighted:bg-amber-50 dark:data-highlighted:bg-amber-950/40"
              )}
            >
              {n != null ? `${g.name} · ${n}` : g.name}
              {empty ? " (leer)" : ""}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
