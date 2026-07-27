"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EnrichedStudentRow, ExamProject } from "@/lib/types";
import type { PortfolioFillStatus } from "@/lib/grades/portfolio";
import {
  countInGroup,
  sortedStudentGroups,
  type GroupFilterId,
} from "@/lib/student-groups";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type GroupFillStatusMap = Record<
  string,
  Exclude<PortfolioFillStatus, "empty">
>;

const FILL_LABEL: Record<Exclude<PortfolioFillStatus, "empty">, string> = {
  complete: "vollständig bewertet",
  partial: "teilweise bewertet",
  none: "noch keine Einträge",
};

export function GroupFilterBar({
  project,
  rows,
  value,
  onChange,
  groupFillStatus,
  showFillLegend = false,
  fillScopeLabel,
  onAfterNavigate,
}: {
  project: ExamProject;
  rows: EnrichedStudentRow[];
  value: GroupFilterId;
  onChange: (id: GroupFilterId) => void;
  /** Füllstand je Gruppen-ID (nur echte Gruppen) */
  groupFillStatus?: GroupFillStatusMap;
  /** Legende für vollständig / teilweise / keine Einträge */
  showFillLegend?: boolean;
  /** z. B. „TL1“ für Tooltip */
  fillScopeLabel?: string;
  /** Nach Vor/Zurück (z. B. Matrix horizontal scrollen) */
  onAfterNavigate?: (delta: -1 | 1) => void;
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
  const go = (delta: -1 | 1) => {
    const next = ids[(idx + delta + ids.length) % ids.length];
    onChange(next);
    onAfterNavigate?.(delta);
  };

  const scopeHint = fillScopeLabel ? ` (${fillScopeLabel})` : "";

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
            const fill =
              p.kind === "group" && p.count > 0
                ? groupFillStatus?.[p.id]
                : undefined;

            let title: string | undefined;
            if (emptyGroup) {
              title = "Noch unbefüllt – darf absichtlich leer bleiben";
            } else if (needsAssign) {
              title = `${p.count} Person(en) ohne Gruppe`;
            } else if (fill) {
              title = `${FILL_LABEL[fill]}${scopeHint}`;
            }

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
                  // Leere Gruppe (keine Mitglieder)
                  !active &&
                    emptyGroup &&
                    "border-dashed border-amber-500/70 text-amber-950 dark:border-amber-600 dark:text-amber-100",
                  // Ohne Gruppe mit Personen
                  !active &&
                    needsAssign &&
                    "border-amber-500 bg-amber-50 text-amber-950 dark:border-amber-600 dark:bg-amber-950/40 dark:text-amber-50",
                  // Füllstand
                  !active &&
                    fill === "complete" &&
                    "border-emerald-500/80 bg-emerald-50 text-emerald-950 dark:border-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-50",
                  !active &&
                    fill === "partial" &&
                    "border-amber-500/80 bg-amber-50 text-amber-950 dark:border-amber-600 dark:bg-amber-950/35 dark:text-amber-50",
                  !active &&
                    fill === "none" &&
                    "border-slate-400/70 bg-slate-50 text-slate-800 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-100",
                  active &&
                    emptyGroup &&
                    "ring-1 ring-amber-300 dark:ring-amber-700",
                  active &&
                    needsAssign &&
                    "ring-1 ring-amber-300 dark:ring-amber-700",
                  active &&
                    fill === "complete" &&
                    "ring-1 ring-emerald-300 dark:ring-emerald-700",
                  active &&
                    fill === "partial" &&
                    "ring-1 ring-amber-300 dark:ring-amber-700",
                  active &&
                    fill === "none" &&
                    "ring-1 ring-slate-300 dark:ring-slate-600"
                )}
                onClick={() => onChange(p.id)}
              >
                {p.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[10px] font-semibold",
                    active
                      ? "bg-primary-foreground/20"
                      : emptyGroup || needsAssign || fill === "partial"
                        ? "bg-amber-200/80 text-amber-950 dark:bg-amber-900 dark:text-amber-50"
                        : fill === "complete"
                          ? "bg-emerald-200/80 text-emerald-950 dark:bg-emerald-900 dark:text-emerald-50"
                          : fill === "none"
                            ? "bg-slate-200/90 text-slate-800 dark:bg-slate-800 dark:text-slate-100"
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
      {showFillLegend && groupFillStatus && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block size-2 rounded-full bg-emerald-500"
              aria-hidden
            />
            vollständig
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block size-2 rounded-full bg-amber-500"
              aria-hidden
            />
            teilweise
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block size-2 rounded-full bg-slate-400"
              aria-hidden
            />
            keine Einträge
          </span>
          {fillScopeLabel && (
            <span className="text-muted-foreground/80">
              · bezogen auf {fillScopeLabel}
            </span>
          )}
        </p>
      )}
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
