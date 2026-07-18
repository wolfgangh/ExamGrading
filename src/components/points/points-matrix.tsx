"use client";

import { useMemo, useState } from "react";
import type { ExamProject, PointsRecord, QuestionDef } from "@/lib/types";
import { matrixRows } from "@/lib/grades/question-stats";
import { cn, formatPoints } from "@/lib/utils";
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

  const subAreaCols = subAreas.map((sa) => ({
    id: sa.id,
    label: `Σ ${sa.code}`,
  }));

  return (
    // Fester Viewport: X- und Y-Scrollbar am Rahmen (nicht erst am Tabellenende)
    <div
      className="w-full max-h-[min(70vh,720px)] overflow-x-auto overflow-y-auto overscroll-contain rounded-xl border [scrollbar-gutter:stable]"
    >
      <Table className="min-w-max w-full">
        <TableHeader className="sticky top-0 z-20 bg-card shadow-sm">
          <TableRow>
            <TableHead className="sticky left-0 z-30 bg-card min-w-[140px]">
              Name
            </TableHead>
            <TableHead className="sticky left-[140px] z-30 bg-card min-w-[96px]">
              Matr.
            </TableHead>
            {defs.map((q) => {
              const pct = questionStatsPercent?.[q.id];
              return (
                <TableHead
                  key={q.id}
                  className="min-w-[72px] text-center whitespace-nowrap"
                  title={
                    pct != null
                      ? `Kohorte Ø ${pct} % der Max-Punkte`
                      : undefined
                  }
                >
                  <div className="font-semibold">{q.label}</div>
                  <div className="text-[10px] font-normal text-muted-foreground">
                    max {q.maxPoints}
                    {pct != null ? ` · Ø ${pct}%` : ""}
                  </div>
                </TableHead>
              );
            })}
            {subAreaCols.map((c) => (
              <TableHead
                key={c.id}
                className="min-w-[72px] text-center bg-muted/40"
              >
                {c.label}
              </TableHead>
            ))}
            <TableHead className="min-w-[72px] text-center bg-muted/60">
              Gesamt
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={3 + defs.length + subAreaCols.length}
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
                defs={defs}
                subAreaIds={subAreas.map((s) => s.id)}
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
  defs,
  subAreaIds,
  unlocked,
  onCellCommit,
}: {
  rowKey: string;
  lastName: string;
  firstName: string;
  record: PointsRecord;
  total: number | null;
  defs: QuestionDef[];
  subAreaIds: string[];
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
      {defs.map((q) => {
        const open = needs.has(q.id);
        const val = record.byQuestion?.[q.id];
        return (
          <TableCell
            key={q.id}
            className={cn(
              "p-1 text-center",
              open && "bg-amber-50 dark:bg-amber-950/40"
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
                {val != null ? formatPoints(val) : open ? "!" : "–"}
              </span>
            )}
          </TableCell>
        );
      })}
      {subAreaIds.map((id) => (
        <TableCell
          key={id}
          className="text-center tabular-nums text-sm bg-muted/20"
        >
          {formatPoints(record.bySubArea[id] ?? null)}
        </TableCell>
      ))}
      <TableCell className="text-center tabular-nums text-sm font-semibold bg-muted/40">
        {formatPoints(total)}
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
    initial != null ? String(initial).replace(".", ",") : ""
  );

  return (
    <Input
      className="h-8 w-16 mx-auto text-center text-sm"
      value={val}
      placeholder={placeholder}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => {
        const raw = val.trim();
        if (!raw) {
          onCommit(null);
          return;
        }
        const n = Number(raw.replace(",", "."));
        onCommit(Number.isFinite(n) ? n : null);
      }}
    />
  );
}
