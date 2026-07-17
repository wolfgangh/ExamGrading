"use client";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { StatusBadge } from "@/components/grades/status-badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  STUDENT_STATUS_LABELS,
  type EnrichedStudentRow,
  type StudentStatus,
} from "@/lib/types";
import { cn, formatGrade, formatPercent, formatPoints } from "@/lib/utils";

export type BorderlineFilter =
  | "off"
  | "0.5"
  | "1"
  | "1.5"
  | "2"
  | "custom";

export function StudentsTable({
  rows,
  editable = false,
  onEditGrade,
  onEditPoints,
  subAreaNames = {},
  showNextGrade = false,
  borderlineFilter = "off",
  borderlineCustom = 1,
  failersOnly = false,
  noShowOnly = false,
  orphanOnly = false,
  highlightBorderlineMax = 1,
}: {
  rows: EnrichedStudentRow[];
  editable?: boolean;
  onEditGrade?: (key: string) => void;
  onEditPoints?: (key: string, subAreaId: string, value: number | null) => void;
  subAreaNames?: Record<string, string>;
  showNextGrade?: boolean;
  borderlineFilter?: BorderlineFilter;
  borderlineCustom?: number;
  failersOnly?: boolean;
  noShowOnly?: boolean;
  orphanOnly?: boolean;
  /** Ab welcher pointsToNext-Schwelle Zeilen amber markiert werden */
  highlightBorderlineMax?: number;
}) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "orderIndex", desc: false },
  ]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const borderlineLimit = useMemo(() => {
    if (borderlineFilter === "off") return null;
    if (borderlineFilter === "custom") return borderlineCustom;
    return Number(borderlineFilter);
  }, [borderlineFilter, borderlineCustom]);

  const filtered = useMemo(() => {
    let list = rows;
    if (statusFilter !== "all") {
      list = list.filter((r) => r.status === statusFilter);
    }
    if (failersOnly) {
      list = list.filter((r) => r.isFailed);
    }
    if (noShowOnly) {
      list = list.filter((r) => r.status === "no_show" || r.attended === false);
    }
    if (orphanOnly) {
      list = list.filter((r) => r.attendanceWithoutHis);
    }
    if (borderlineLimit != null) {
      list = list.filter(
        (r) =>
          r.pointsToNext != null &&
          r.pointsToNext > 0 &&
          r.pointsToNext <= borderlineLimit &&
          !r.isFailed
      );
    }
    return list;
  }, [
    rows,
    statusFilter,
    failersOnly,
    noShowOnly,
    orphanOnly,
    borderlineLimit,
  ]);

  const columns = useMemo<ColumnDef<EnrichedStudentRow>[]>(() => {
    const cols: ColumnDef<EnrichedStudentRow>[] = [
      {
        accessorKey: "orderIndex",
        header: "#",
        cell: ({ row }) => (
          <span className="text-muted-foreground tabular-nums">
            {row.original.orderIndex + 1}
          </span>
        ),
      },
      {
        id: "matnr",
        accessorFn: (r) => r.student.matriculationNumber,
        header: "Matr.-Nr.",
        cell: ({ row }) => (
          <span className="font-mono tabular-nums text-sm">
            {row.original.key}
          </span>
        ),
      },
      {
        id: "name",
        accessorFn: (r) =>
          `${r.student.lastName}, ${r.student.firstName}`,
        header: "Name",
        cell: ({ row }) => (
          <span>
            {row.original.student.lastName}
            {row.original.student.lastName || row.original.student.firstName
              ? ", "
              : ""}
            {row.original.student.firstName}
          </span>
        ),
      },
      {
        id: "program",
        accessorFn: (r) => r.programCode ?? "",
        header: "Studiengang",
        cell: ({ row }) =>
          row.original.programCode ? (
            <span className="text-sm">
              {row.original.programCode}
              {row.original.multiProgram && (
                <span className="ml-1 text-xs text-amber-700">+</span>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground">–</span>
          ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "attended",
        header: "Antritt",
        cell: ({ row }) =>
          row.original.attended === true
            ? "Ja"
            : row.original.attended === false
              ? "–"
              : "?",
      },
      {
        id: "points",
        accessorFn: (r) => r.totalPoints ?? -1,
        header: "Punkte",
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatPoints(row.original.totalPoints)}
          </span>
        ),
      },
      {
        id: "percent",
        accessorFn: (r) => r.percent ?? -1,
        header: "%",
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatPercent(row.original.percent)}
          </span>
        ),
      },
      {
        id: "grade",
        accessorFn: (r) => r.finalGrade ?? 99,
        header: "Note",
        cell: ({ row }) => (
          <button
            type="button"
            className="tabular-nums font-semibold hover:underline disabled:no-underline"
            disabled={!onEditGrade}
            onClick={() => onEditGrade?.(row.original.key)}
          >
            {formatGrade(row.original.finalGrade)}
            {row.original.gradeOverride != null && (
              <span className="ml-1 text-xs text-amber-700">*</span>
            )}
          </button>
        ),
      },
    ];

    if (showNextGrade) {
      cols.push({
        id: "toNext",
        accessorFn: (r) => r.pointsToNext ?? 999,
        header: "bis nächste Note",
        cell: ({ row }) => {
          const r = row.original;
          if (r.pointsToNext == null || r.nextGrade == null) {
            return <span className="text-muted-foreground">–</span>;
          }
          if (r.pointsToNext === 0) {
            return (
              <span className="text-muted-foreground tabular-nums">
                (an Schwelle)
              </span>
            );
          }
          return (
            <span className="tabular-nums">
              {formatPoints(r.pointsToNext)} → {formatGrade(r.nextGrade)}
            </span>
          );
        },
      });
    }

    const saIds = Object.keys(subAreaNames);
    for (const saId of saIds) {
      cols.splice(6, 0, {
        id: `sa-${saId}`,
        header: subAreaNames[saId],
        cell: ({ row }) => {
          const val = row.original.subAreaPoints[saId];
          if (editable && onEditPoints) {
            return (
              <Input
                type="number"
                step="0.5"
                className="h-7 w-20"
                defaultValue={val ?? ""}
                onBlur={(e) => {
                  const raw = e.target.value.trim();
                  const num = raw === "" ? null : Number(raw.replace(",", "."));
                  onEditPoints(
                    row.original.key,
                    saId,
                    num != null && Number.isFinite(num) ? num : null
                  );
                }}
              />
            );
          }
          return (
            <span className="tabular-nums">{formatPoints(val)}</span>
          );
        },
      });
    }

    return cols;
  }, [
    editable,
    onEditGrade,
    onEditPoints,
    subAreaNames,
    showNextGrade,
  ]);

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, _columnId, filter) => {
      const q = String(filter).toLowerCase();
      if (!q) return true;
      const s = row.original.student;
      return (
        s.matriculationNumber.toLowerCase().includes(q) ||
        row.original.key.includes(q) ||
        s.lastName.toLowerCase().includes(q) ||
        s.firstName.toLowerCase().includes(q)
      );
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Suche Name / Matr.-Nr.…"
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="max-w-xs"
        />
        <Select
          value={statusFilter}
          onValueChange={(v) => v && setStatusFilter(v)}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Status">
              {statusFilter === "all"
                ? "Alle Status"
                : STUDENT_STATUS_LABELS[statusFilter as StudentStatus]}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            {(Object.keys(STUDENT_STATUS_LABELS) as StudentStatus[]).map(
              (s) => (
                <SelectItem key={s} value={s}>
                  {STUDENT_STATUS_LABELS[s]}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
        <span className="ml-auto text-sm text-muted-foreground">
          {table.getRowModel().rows.length} / {rows.length} Zeilen
        </span>
      </div>

      <div className="surface-panel overflow-auto rounded-xl border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead key={header.id} className="whitespace-nowrap">
                    {header.isPlaceholder ? null : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-2 h-8"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {{
                          asc: " ↑",
                          desc: " ↓",
                        }[header.column.getIsSorted() as string] ?? null}
                      </Button>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  Keine Daten – Filter prüfen oder Importe.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => {
                const r = row.original;
                const isBorderline =
                  r.pointsToNext != null &&
                  r.pointsToNext > 0 &&
                  r.pointsToNext <= highlightBorderlineMax &&
                  !r.isFailed;

                const rowKind = r.attendanceWithoutHis
                  ? "orphan"
                  : r.status === "mismatch"
                    ? "mismatch"
                    : r.isFailed
                      ? "fail"
                      : isBorderline
                        ? "borderline"
                        : r.status === "no_show"
                          ? "no-show"
                          : "default";

                return (
                  <TableRow
                    key={row.id}
                    data-status={rowKind}
                    className={cn(
                      "student-status-row",
                      rowKind === "orphan" &&
                        "bg-amber-100 ring-1 ring-inset ring-amber-500/70 dark:bg-amber-900/55 dark:ring-amber-400/50",
                      rowKind === "mismatch" &&
                        "bg-red-100/80 dark:bg-red-950/55 dark:text-red-50",
                      rowKind === "fail" &&
                        "bg-rose-100/80 dark:bg-rose-950/60 dark:text-rose-50",
                      rowKind === "borderline" &&
                        "bg-amber-50 dark:bg-yellow-950/45 dark:text-yellow-50",
                      rowKind === "no-show" &&
                        "bg-orange-50/70 dark:bg-orange-950/40 dark:text-orange-50"
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="py-1.5">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
