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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
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
  GERMAN_GRADES,
  STUDENT_STATUS_LABELS,
  type EnrichedStudentRow,
  type StudentStatus,
} from "@/lib/types";
import {
  cn,
  formatEditableNumber,
  formatGrade,
  formatPercent,
  formatPoints,
  parseLocaleNumber,
} from "@/lib/utils";
import { ChevronDown, ClipboardCopy } from "lucide-react";

/** Multi-Filter: leeres Set = alle Noten; "none" = ohne Note */
type GradeFilterKey = number | "none";

const CLIPBOARD_HEADERS = [
  "Matr.-Nr.",
  "Name",
  "Studiengang",
  "Punkte",
  "Note",
] as const;

function gradeOverviewClipboardRows(
  rows: EnrichedStudentRow[]
): { cells: string[] }[] {
  return rows.map((r) => {
    const name = [r.student.lastName, r.student.firstName]
      .filter(Boolean)
      .join(", ");
    return {
      cells: [
        r.key,
        name,
        r.programCode?.trim() || "",
        r.totalPoints != null && Number.isFinite(r.totalPoints)
          ? formatPoints(r.totalPoints)
          : "",
        r.finalGrade != null && Number.isFinite(r.finalGrade)
          ? formatGrade(r.finalGrade)
          : "",
      ],
    };
  });
}

function toTsv(rows: { cells: string[] }[]): string {
  const esc = (s: string) => s.replace(/\t/g, " ").replace(/\r?\n/g, " ");
  const lines = [
    CLIPBOARD_HEADERS.join("\t"),
    ...rows.map((r) => r.cells.map(esc).join("\t")),
  ];
  return lines.join("\r\n");
}

function toHtmlTable(rows: { cells: string[] }[]): string {
  const esc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  const th = CLIPBOARD_HEADERS.map((h) => `<th>${esc(h)}</th>`).join("");
  const body = rows
    .map(
      (r) =>
        `<tr>${r.cells.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`
    )
    .join("");
  return `<table><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table>`;
}

async function writeClipboardTable(
  tsv: string,
  html: string
): Promise<void> {
  if (
    typeof ClipboardItem !== "undefined" &&
    navigator.clipboard?.write
  ) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/plain": new Blob([tsv], { type: "text/plain" }),
          "text/html": new Blob([html], { type: "text/html" }),
        }),
      ]);
      return;
    } catch {
      /* fallback below */
    }
  }
  await navigator.clipboard.writeText(tsv);
}

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
  onEditTotalPoints,
  subAreaNames = {},
  showNextGrade = false,
  borderlineFilter = "off",
  borderlineCustom = 1,
  failersOnly = false,
  noShowOnly = false,
  orphanOnly = false,
  highlightBorderlineMax = 1,
  portfolioComponents = [],
}: {
  rows: EnrichedStudentRow[];
  editable?: boolean;
  onEditGrade?: (key: string) => void;
  onEditPoints?: (key: string, subAreaId: string, value: number | null) => void;
  /** Gesamtpunkte manuell (z. B. Klausur) */
  onEditTotalPoints?: (key: string, value: number | null) => void;
  subAreaNames?: Record<string, string>;
  showNextGrade?: boolean;
  borderlineFilter?: BorderlineFilter;
  borderlineCustom?: number;
  failersOnly?: boolean;
  noShowOnly?: boolean;
  orphanOnly?: boolean;
  /** Ab welcher pointsToNext-Schwelle Zeilen amber markiert werden */
  highlightBorderlineMax?: number;
  /** Portfolio: Teilleistungen für Spalten in der Übersicht */
  portfolioComponents?: { id: string; code: string; name: string }[];
}) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "orderIndex", desc: false },
  ]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [gradeFilter, setGradeFilter] = useState<GradeFilterKey[]>([]);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

  const borderlineLimit = useMemo(() => {
    if (borderlineFilter === "off") return null;
    if (borderlineFilter === "custom") return borderlineCustom;
    return Number(borderlineFilter);
  }, [borderlineFilter, borderlineCustom]);

  const gradeFilterActive = gradeFilter.length > 0;

  const gradeFilterLabel = useMemo(() => {
    if (!gradeFilterActive) return "Alle Noten";
    if (gradeFilter.length === 1) {
      const k = gradeFilter[0];
      return k === "none" ? "Ohne Note" : `Note ${formatGrade(k)}`;
    }
    return `${gradeFilter.length} Noten`;
  }, [gradeFilter, gradeFilterActive]);

  const toggleGradeFilter = (key: GradeFilterKey, on: boolean) => {
    setGradeFilter((prev) => {
      const has = prev.some((p) =>
        p === "none" || key === "none" ? p === key : Math.abs(p - key) < 0.05
      );
      if (on && !has) return [...prev, key];
      if (!on && has) {
        return prev.filter((p) =>
          p === "none" || key === "none" ? p !== key : Math.abs(p - (key as number)) >= 0.05
        );
      }
      return prev;
    });
  };

  const isGradeSelected = (key: GradeFilterKey) =>
    gradeFilter.some((p) =>
      p === "none" || key === "none" ? p === key : Math.abs(p - (key as number)) < 0.05
    );

  const filtered = useMemo(() => {
    let list = rows;
    if (statusFilter !== "all") {
      list = list.filter((r) => r.status === statusFilter);
    }
    if (gradeFilterActive) {
      list = list.filter((r) => {
        const g = r.finalGrade;
        if (g == null || !Number.isFinite(g)) {
          return gradeFilter.includes("none");
        }
        return gradeFilter.some(
          (k) => k !== "none" && Math.abs(g - k) < 0.05
        );
      });
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
    gradeFilter,
    gradeFilterActive,
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
        cell: ({ row }) => {
          const val = row.original.totalPoints;
          if (editable && onEditTotalPoints) {
            return (
              <Input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                className="h-7 w-[4.5rem] text-center tabular-nums"
                defaultValue={formatEditableNumber(val)}
                key={`total-${row.original.key}-${val ?? "x"}`}
                placeholder="–"
                title="Gesamtpunkte (Komma oder Punkt als Dezimaltrenner)"
                onBlur={(e) => {
                  const raw = e.target.value.trim();
                  onEditTotalPoints(
                    row.original.key,
                    raw === "" ? null : parseLocaleNumber(raw)
                  );
                }}
              />
            );
          }
          return (
            <span
              className="tabular-nums"
              title={
                val != null
                  ? "Portfolio: Erfüllungsäquivalent 0–100 aus gewichteten Kriterien/Teilnoten"
                  : undefined
              }
            >
              {formatPoints(val)}
            </span>
          );
        },
      },
      {
        id: "percent",
        accessorFn: (r) => r.percent ?? -1,
        header: "%",
        cell: ({ row }) => (
          <span
            className="tabular-nums"
            title="Anteil der möglichen Leistung (Portfolio: gewichtete Kriterien-Erfüllung)"
          >
            {formatPercent(row.original.percent)}
          </span>
        ),
      },
    ];

    // Teilnoten links von der Gesamtnote (+ % vom Max, bis nächste Note)
    for (const pc of portfolioComponents) {
      cols.push({
        id: `pc-${pc.id}`,
        accessorFn: (r) => r.portfolioComponentGrades?.[pc.id] ?? 99,
        header: () => (
          <span title={pc.name} className="whitespace-nowrap">
            {pc.code || pc.name}
          </span>
        ),
        cell: ({ row }) => {
          const d = row.original.portfolioComponentDetails?.[pc.id];
          const g =
            d?.grade ?? row.original.portfolioComponentGrades?.[pc.id] ?? null;
          const pct = d?.percent;
          const next =
            d?.pointsToNext != null && d.nextGrade != null
              ? d
              : null;
          const isWorse = next?.nextGradeDirection === "worse";
          return (
            <div className="flex min-w-[5.5rem] flex-col gap-0.5 py-0.5" title={pc.name}>
              <span className="tabular-nums font-semibold">
                {formatGrade(g)}
              </span>
              {pct != null && (
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  {formatPercent(pct)}
                  {d?.pointsRaw != null && d?.pointsMax != null
                    ? ` · ${formatPoints(d.pointsRaw, 1)}/${formatPoints(d.pointsMax, 0)}`
                    : ""}
                </span>
              )}
              {next && (
                <span
                  className={cn(
                    "inline-flex w-fit max-w-full items-center rounded border px-1 py-px text-[9px] font-semibold tabular-nums",
                    isWorse
                      ? "border-rose-400 bg-rose-50 text-rose-900 dark:border-rose-500 dark:bg-rose-950/60 dark:text-rose-50"
                      : "border-emerald-400 bg-emerald-50 text-emerald-900 dark:border-emerald-500 dark:bg-emerald-950/60 dark:text-emerald-50"
                  )}
                  title={
                    isWorse
                      ? "Abstand zur nächstschlechteren Note (Notengrade)"
                      : "Abstand zur nächstbesseren Note (Notengrade)"
                  }
                >
                  {isWorse ? "↓" : "↑"}
                  {formatPoints(next.pointsToNext, 1)}→
                  {formatGrade(next.nextGrade)}
                </span>
              )}
            </div>
          );
        },
      });
    }

    cols.push({
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
    });

    if (showNextGrade) {
      const unitFromRows = rows.find((r) => r.nextGradeUnit)?.nextGradeUnit;
      const unitLabel =
        unitFromRows === "grade"
          ? "Notengrade"
          : unitFromRows === "points"
            ? "Punkte"
            : "Punkte / Notengrade";
      cols.push({
        id: "toNext",
        accessorFn: (r) => r.pointsToNext ?? 999,
        header: () => (
          <span
            title={
              unitFromRows === "grade"
                ? "Abstand des ungerundeten Notenmittels zur nächstgelegenen Nachbarstufe (besser bei Gleichstand; schlechter wenn näher)."
                : "Fehlende Punkte bis zur nächstbesseren Notenschwelle (aktives Szenario)."
            }
            className="whitespace-nowrap"
          >
            bis nächste Note
            <span className="mt-0.5 block text-[10px] font-normal text-muted-foreground">
              ({unitLabel})
            </span>
          </span>
        ),
        cell: ({ row }) => {
          const r = row.original;
          if (r.pointsToNext == null || r.nextGrade == null) {
            return <span className="text-muted-foreground">–</span>;
          }
          const unit = r.nextGradeUnit === "grade" ? "Notengrade" : "Punkte";
          const dir = r.nextGradeDirection ?? "better";
          const dirLabel =
            dir === "worse" ? "nächstschlechtere Note" : "nächstbessere Note";
          const isWorse = dir === "worse";
          return (
            <span
              className={cn(
                "inline-flex max-w-full flex-wrap items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-semibold tabular-nums shadow-sm",
                isWorse
                  ? "border-rose-500/80 bg-rose-100 text-rose-950 dark:border-rose-400 dark:bg-rose-950/70 dark:text-rose-50"
                  : "border-emerald-500/80 bg-emerald-100 text-emerald-950 dark:border-emerald-400 dark:bg-emerald-950/70 dark:text-emerald-50"
              )}
              title={`${dirLabel} · Abstand in ${unit}`}
            >
              <span
                className={cn(
                  "rounded px-1 py-px text-[10px] font-bold uppercase tracking-wide",
                  isWorse
                    ? "bg-rose-600 text-white dark:bg-rose-500"
                    : "bg-emerald-700 text-white dark:bg-emerald-500"
                )}
              >
                {isWorse ? "schlechter ↓" : "besser ↑"}
              </span>
              <span>
                {formatPoints(r.pointsToNext, 1)} → {formatGrade(r.nextGrade)}
              </span>
              <span className="text-[10px] font-medium opacity-80">
                {unit === "Notengrade" ? "N" : "P"}
              </span>
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
                type="text"
                inputMode="decimal"
                autoComplete="off"
                className="h-7 w-20 text-center tabular-nums"
                defaultValue={formatEditableNumber(val)}
                key={`sa-${row.original.key}-${saId}-${val ?? "x"}`}
                placeholder="–"
                title="Teilgebietspunkte (Komma oder Punkt als Dezimaltrenner)"
                onBlur={(e) => {
                  const raw = e.target.value.trim();
                  onEditPoints(
                    row.original.key,
                    saId,
                    raw === "" ? null : parseLocaleNumber(raw)
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
    onEditTotalPoints,
    subAreaNames,
    showNextGrade,
    portfolioComponents,
    rows,
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

  const copyVisibleToClipboard = async () => {
    const visible = table.getRowModel().rows.map((r) => r.original);
    if (visible.length === 0) {
      setCopyMsg("Keine Zeilen zum Kopieren.");
      return;
    }
    const payload = gradeOverviewClipboardRows(visible);
    const tsv = toTsv(payload);
    const html = toHtmlTable(payload);
    try {
      await writeClipboardTable(tsv, html);
      setCopyMsg(
        `${visible.length} Zeile${visible.length === 1 ? "" : "n"} kopiert (Matr., Name, Studiengang, Punkte, Note).`
      );
    } catch {
      setCopyMsg(
        "Kopieren fehlgeschlagen – Browser-Berechtigung für die Zwischenablage prüfen."
      );
    }
  };

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

        <Popover>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  "h-9 min-w-[8.5rem] justify-between gap-1.5 font-normal",
                  gradeFilterActive && "border-primary bg-primary/5"
                )}
              />
            }
          >
            <span className="truncate">{gradeFilterLabel}</span>
            <ChevronDown className="size-3.5 opacity-60" />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-52 p-2">
            <p className="mb-1.5 px-1 text-xs font-medium text-muted-foreground">
              Nach Note filtern (Mehrfachauswahl)
            </p>
            <div className="mb-1.5 flex gap-1">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-7 flex-1 text-xs"
                onClick={() =>
                  setGradeFilter(["none", ...GERMAN_GRADES])
                }
              >
                Alle wählen
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 flex-1 text-xs"
                onClick={() => setGradeFilter([])}
              >
                Alle abwählen
              </Button>
            </div>
            <div className="max-h-64 space-y-0.5 overflow-auto">
              <label className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-muted">
                <Checkbox
                  checked={isGradeSelected("none")}
                  onCheckedChange={(v) =>
                    toggleGradeFilter("none", v === true)
                  }
                />
                <span className="text-sm">Ohne Note</span>
              </label>
              {GERMAN_GRADES.map((g) => (
                <label
                  key={g}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-muted"
                >
                  <Checkbox
                    checked={isGradeSelected(g)}
                    onCheckedChange={(v) =>
                      toggleGradeFilter(g, v === true)
                    }
                  />
                  <span className="text-sm tabular-nums">
                    {formatGrade(g)}
                  </span>
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 gap-1.5"
          disabled={table.getRowModel().rows.length === 0}
          title="Sichtbare Zeilen: Matr.-Nr., Name, Studiengang, Punkte, Note – für Teams/Excel"
          onClick={() => void copyVisibleToClipboard()}
        >
          <ClipboardCopy className="size-3.5" />
          Kopieren
        </Button>

        <span className="ml-auto text-sm text-muted-foreground">
          {table.getRowModel().rows.length} / {rows.length} Zeilen
        </span>
      </div>
      {copyMsg && (
        <p className="text-xs text-muted-foreground" role="status">
          {copyMsg}
        </p>
      )}

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
