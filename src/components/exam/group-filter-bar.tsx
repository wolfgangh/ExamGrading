"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EnrichedStudentRow, ExamProject } from "@/lib/types";
import {
  countInGroup,
  sortedStudentGroups,
  type GroupFilterId,
} from "@/lib/student-groups";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function GroupFilterBar({
  project,
  rows,
  value,
  onChange,
}: {
  project: ExamProject;
  rows: EnrichedStudentRow[];
  value: GroupFilterId;
  onChange: (id: GroupFilterId) => void;
}) {
  const groups = sortedStudentGroups(project);
  if (groups.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Noch keine Gruppen – unter Einstellungen anlegen, dann hier filtern.
      </p>
    );
  }

  const pills: { id: GroupFilterId; label: string; count: number }[] = [
    { id: "all", label: "Alle", count: countInGroup(rows, "all") },
    ...groups.map((g) => ({
      id: g.id as GroupFilterId,
      label: g.name,
      count: countInGroup(rows, g.id),
    })),
    {
      id: "none",
      label: "Ohne Gruppe",
      count: countInGroup(rows, "none"),
    },
  ];

  const ids = pills.map((p) => p.id);
  const idx = Math.max(0, ids.indexOf(value));
  const go = (delta: number) => {
    const next = ids[(idx + delta + ids.length) % ids.length];
    onChange(next);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-0.5">
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          onClick={() => go(-1)}
          title="Vorherige Gruppe"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          onClick={() => go(1)}
          title="Nächste Gruppe"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {pills.map((p) => {
          const active = value === p.id;
          return (
            <Button
              key={p.id}
              type="button"
              size="sm"
              variant={active ? "default" : "outline"}
              className={cn(
                "h-8 gap-1.5 tabular-nums",
                active && "shadow-sm"
              )}
              onClick={() => onChange(p.id)}
            >
              {p.label}
              <span
                className={cn(
                  "rounded-full px-1.5 text-[10px] font-semibold",
                  active
                    ? "bg-primary-foreground/20"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {p.count}
              </span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
