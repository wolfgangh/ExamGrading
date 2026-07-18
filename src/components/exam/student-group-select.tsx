"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ExamProject } from "@/lib/types";
import { sortedStudentGroups } from "@/lib/student-groups";
import { cn } from "@/lib/utils";

const NONE = "__none__";

export function StudentGroupSelect({
  project,
  groupId,
  onChange,
  className,
  compact,
}: {
  project: ExamProject;
  groupId: string | null | undefined;
  onChange: (groupId: string | null) => void;
  className?: string;
  compact?: boolean;
}) {
  const groups = sortedStudentGroups(project);
  if (groups.length === 0) {
    return (
      <span className="text-[10px] text-muted-foreground">–</span>
    );
  }

  const value = groupId && groups.some((g) => g.id === groupId) ? groupId : NONE;

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
          className
        )}
      >
        <SelectValue placeholder="Gruppe">
          {value === NONE
            ? "–"
            : groups.find((g) => g.id === value)?.name ?? "–"}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>Keine Gruppe</SelectItem>
        {groups.map((g) => (
          <SelectItem key={g.id} value={g.id}>
            {g.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
