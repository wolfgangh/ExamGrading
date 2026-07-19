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

  const pills: {
    id: GroupFilterId;
    label: string;
    count: number;
    kind: "all" | "group" | "none";
  }[] = [
    { id: "all", label: "Alle", count: countInGroup(rows, "all"), kind: "all" },
    ...groups.map((g) => ({
      id: g.id as GroupFilterId,
      label: g.name,
      count: countInGroup(rows, g.id),
      kind: "group" as const,
    })),
    {
      id: "none",
      label: "Ohne Gruppe",
      count: countInGroup(rows, "none"),
      kind: "none" as const,
    },
  ];

  const emptyGroupCount = groups.filter(
    (g) => countInGroup(rows, g.id) === 0
  ).length;
  const unassignedCount = countInGroup(rows, "none");

  const ids = pills.map((p) => p.id);
  const idx = Math.max(0, ids.indexOf(value));
  const go = (delta: number) => {
    const next = ids[(idx + delta + ids.length) % ids.length];
    onChange(next);
  };

  return (
    <div className="space-y-2">
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
            const emptyGroup = p.kind === "group" && p.count === 0;
            const needsAssign = p.kind === "none" && p.count > 0;
            const title = emptyGroup
              ? "Noch unbefüllt – darf absichtlich leer bleiben"
              : needsAssign
                ? `${p.count} Person(en) ohne Gruppe`
                : undefined;

            return (
              <Button
                key={p.id}
                type="button"
                size="sm"
                variant={active ? "default" : "outline"}
                title={title}
                className={cn(
                  "h-8 gap-1.5 tabular-nums",
                  active && "shadow-sm",
                  !active &&
                    emptyGroup &&
                    "border-dashed border-amber-500/70 text-amber-950 dark:border-amber-600 dark:text-amber-100",
                  !active &&
                    needsAssign &&
                    "border-amber-500 bg-amber-50 text-amber-950 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-50",
                  active &&
                    emptyGroup &&
                    "ring-1 ring-amber-300 dark:ring-amber-700",
                  active &&
                    needsAssign &&
                    "ring-1 ring-amber-300 dark:ring-amber-700"
                )}
                onClick={() => onChange(p.id)}
              >
                {p.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[10px] font-semibold",
                    active
                      ? "bg-primary-foreground/20"
                      : emptyGroup || needsAssign
                        ? "bg-amber-200/80 text-amber-950 dark:bg-amber-900 dark:text-amber-50"
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
      {(emptyGroupCount > 0 || unassignedCount > 0) && (
        <p className="text-[11px] text-muted-foreground">
          {unassignedCount > 0 && (
            <span className="text-amber-900 dark:text-amber-100">
              {unassignedCount} ohne Gruppe
            </span>
          )}
          {unassignedCount > 0 && emptyGroupCount > 0 && " · "}
          {emptyGroupCount > 0 && (
            <span>
              {emptyGroupCount} Gruppe(n) noch unbefüllt (dürfen leer bleiben)
            </span>
          )}
        </p>
      )}
    </div>
  );
}
