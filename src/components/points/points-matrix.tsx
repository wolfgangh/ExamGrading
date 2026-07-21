"use client";

import { useMemo, useState } from "react";
import type { ExamProject, PointsRecord, QuestionDef, SubArea } from "@/lib/types";
import { matrixRows } from "@/lib/grades/question-stats";
import { subAreaColorAt } from "@/lib/grades/subarea-colors";
import { cn, formatPoints } from "@/lib/utils";
import { formatDurationMinutes } from "@/lib/excel/parse-duration";
import { isOnlineStyleExam } from "@/lib/types";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function PointsMatrix({
  project,
  unlocked,
  search,
  onlyOpen,
  onCellCommit,
  questionStatsPercent,
  recomputeKey,
}: {
  project: ExamProject;
  unlocked: boolean;
  search: string;
  onlyOpen: boolean;
  onCellCommit: (matKey: string, questionId: string, value: number | null) => void;
  /** questionId → Ø% für Header-Badge */
  questionStatsPercent?: Record<string, number | null>;
  /** force remount cells when project points change */
  recomputeKey?: string;
}) {
  const defs = project.questionDefs ?? [];
  const subAreas = project.subAreas;
  const showDuration = isOnlineStyleExam(project.examType);

  const saIndexById = useMemo(() => {
    const m = new Map<string, number>();
    subAreas.forEach((sa, i) => m.set(sa.id, i));
    return m;
  }, [subAreas]);

  const rows = useMemo(() => {
    let list = matrixRows(project);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          r.key.includes(q) ||
          r.lastName.toLowerCase().includes(q) ||
          r.firstName.toLowerCase().includes(q)
      );
    }
    if (onlyOpen) {
      list = list.filter((r) => (r.record.needsGrading?.length ?? 0) > 0);
    }
    return list;
  }, [project, search, onlyOpen]);

  const subAreaCols = subAreas.map((sa, i) => ({
    id: sa.id,
    label: `Σ ${sa.code}`,
    index: i,
  }));

  const resolveSa = (q: QuestionDef): SubArea | null => {
    if (!q.subAreaId) return null;
    return subAreas.find((s) => s.id === q.subAreaId) ?? null;
  };

  return (
    <div className="w-full max-h-[min(70vh,720px)] overflow-x-auto overflow-y-auto overscroll-contain rounded-xl border [scrollbar-gutter:stable]">
      <Table className="min-w-max w-full">
        <TableHeader className="sticky top-0 z-20 bg-card shadow-sm">
          <TableRow>
            <TableHead className="sticky left-0 z-30 bg-card min-w-[140px]">
              Name
            </TableHead>
            <TableHead className="sticky left-[140px] z-30 bg-card min-w-[96px]">
              Matr.
            </TableHead>
            {showDuration && (
              <TableHead
                className="min-w-[7rem] text-center whitespace-nowrap"
                title="Moodle-Spalte „Dauer“ / Bearbeitungsdauer"
              >
                Dauer
              </TableHead>
            )}
            {defs.map((q) => {
              const pct = questionStatsPercent?.[q.id];
              const sa = resolveSa(q);
              const saIdx = sa ? (saIndexById.get(sa.id) ?? 0) : -1;
              const colors = saIdx >= 0 ? subAreaColorAt(saIdx) : null;
              return (
                <TableHead
                  key={q.id}
                  className={cn(
                    "min-w-[72px] text-center whitespace-nowrap",
                    colors?.header
                  )}
                  title={
                    [
                      sa ? `Teilgebiet ${sa.name} (${sa.code})` : "Kein Teilgebiet",
                      pct != null ? `Kohorte Ø ${pct} % der Max-Punkte` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || undefined
                  }
                >
                  <div className="font-semibold">{q.label}</div>
                  <div className="text-[10px] font-semibold tabular-nums opacity-90">
                    {sa ? sa.code : "–"}
                    {q.maxPoints != null ? ` · max ${q.maxPoints}` : ""}
                    {pct != null ? ` · Ø ${pct}%` : ""}
                  </div>
                </TableHead>
              );
            })}
            {subAreaCols.map((c) => {
              const colors = subAreaColorAt(c.index);
              return (
                <TableHead
                  key={c.id}
                  className={cn(
                    "min-w-[72px] text-center font-semibold",
                    colors.header
                  )}
                >
                  {c.label}
                </TableHead>
              );
            })}
            <TableHead className="min-w-[72px] text-center bg-muted/60">
              Gesamt
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={
                  3 +
                  (showDuration ? 1 : 0) +
                  defs.length +
                  subAreaCols.length
                }
                className="h-24 text-center text-muted-foreground"
              >
                Keine Punktedaten – THE importieren oder Filter prüfen.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => (
              <MatrixRow
                key={`${r.key}-${recomputeKey ?? ""}`}
                rowKey={r.key}
                lastName={r.lastName}
                firstName={r.firstName}
                record={r.record}
                total={r.total}
                durationMinutes={r.durationMinutes}
                showDuration={showDuration}
                defs={defs}
                subAreas={subAreas}
                saIndexById={saIndexById}
                unlocked={unlocked}
                onCellCommit={onCellCommit}
              />
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function MatrixRow({
  rowKey,
  lastName,
  firstName,
  record,
  total,
  durationMinutes,
  showDuration,
  defs,
  subAreas,
  saIndexById,
  unlocked,
  onCellCommit,
}: {
  rowKey: string;
  lastName: string;
  firstName: string;
  record: PointsRecord;
  total: number | null;
  durationMinutes: number | null;
  showDuration: boolean;
  defs: QuestionDef[];
  subAreas: SubArea[];
  saIndexById: Map<string, number>;
  unlocked: boolean;
  onCellCommit: (matKey: string, questionId: string, value: number | null) => void;
}) {
  const needs = new Set(record.needsGrading ?? []);

  return (
    <TableRow>
      <TableCell className="sticky left-0 z-10 bg-card font-medium whitespace-nowrap">
        {lastName}
        {lastName || firstName ? ", " : ""}
        {firstName}
      </TableCell>
      <TableCell className="sticky left-[140px] z-10 bg-card font-mono text-sm">
        {rowKey}
      </TableCell>
      {showDuration && (
        <TableCell
          className="text-center text-xs tabular-nums whitespace-nowrap"
          title={
            durationMinutes != null
              ? `${durationMinutes} Minuten`
              : "Keine Dauer im Import"
          }
        >
          {formatDurationMinutes(durationMinutes)}
        </TableCell>
      )}
      {defs.map((q) => {
        const open = needs.has(q.id);
        const val = record.byQuestion?.[q.id];
        const saIdx =
          q.subAreaId != null ? (saIndexById.get(q.subAreaId) ?? -1) : -1;
        const colors = saIdx >= 0 ? subAreaColorAt(saIdx) : null;
        return (
          <TableCell
            key={q.id}
            className={cn(
              "p-1 text-center",
              colors?.cell,
              open && "ring-1 ring-inset ring-amber-400/70"
            )}
          >
            {unlocked ? (
              <CellInput
                initial={val}
                placeholder={open ? "!" : "–"}
                onCommit={(n) => onCellCommit(rowKey, q.id, n)}
              />
            ) : (
              <span
                className={cn(
                  "tabular-nums text-sm",
                  open && "font-medium text-amber-800 dark:text-amber-200"
                )}
              >
                {val != null ? formatPoints(val, 2) : open ? "!" : "–"}
              </span>
            )}
          </TableCell>
        );
      })}
      {subAreas.map((sa, i) => {
        const colors = subAreaColorAt(i);
        return (
          <TableCell
            key={sa.id}
            className={cn(
              "text-center tabular-nums text-sm font-medium",
              colors.cell
            )}
          >
            {formatPoints(record.bySubArea[sa.id] ?? null, 2)}
          </TableCell>
        );
      })}
      <TableCell className="text-center tabular-nums text-sm font-semibold bg-muted/40">
        {formatPoints(total, 2)}
      </TableCell>
    </TableRow>
  );
}

function CellInput({
  initial,
  placeholder,
  onCommit,
}: {
  initial: number | null | undefined;
  placeholder: string;
  onCommit: (v: number | null) => void;
}) {
  const [val, setVal] = useState(
    initial != null ? formatPoints(initial, 2) : ""
  );

  return (
    <Input
      className="mx-auto h-8 w-16 bg-background/80 text-center text-sm"
      value={val}
      placeholder={placeholder}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => {
        const raw = val.trim();
        if (raw === "") {
          onCommit(null);
          return;
        }
        const num = Number(raw.replace(",", "."));
        onCommit(Number.isFinite(num) ? num : null);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}
