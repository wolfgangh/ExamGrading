"use client";

import { useMemo, useState } from "react";
import type { ExamProject, QuestionDef, SubArea } from "@/lib/types";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  countQuestionsPerSubArea,
  isSubAreaMappingAssigned,
  isSubAreaMappingBalanced,
  isSubAreaMappingComplete,
} from "@/lib/grades/subarea-mapping";
import {
  UNASSIGNED_TILE,
  subAreaColorAt,
} from "@/lib/grades/subarea-colors";
import { ArrowRight, CheckCircle2, AlertTriangle } from "lucide-react";

export function QuestionSubareaMapper({
  project,
  questionDefs,
  subAreas,
  onChangeMany,
  onConfirm,
}: {
  project: ExamProject;
  questionDefs: QuestionDef[];
  subAreas: SubArea[];
  onChangeMany: (questionIds: string[], subAreaId: string) => void;
  onConfirm: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const ids = useMemo(() => new Set(subAreas.map((s) => s.id)), [subAreas]);
  const indexById = useMemo(() => {
    const m = new Map<string, number>();
    subAreas.forEach((sa, i) => m.set(sa.id, i));
    return m;
  }, [subAreas]);

  const assigned = isSubAreaMappingAssigned(project);
  const balanced = isSubAreaMappingBalanced(project);
  const complete = isSubAreaMappingComplete(project);
  const perSa = countQuestionsPerSubArea(questionDefs, subAreas);
  const canConfirm = assigned;

  const unassignedIds = useMemo(
    () =>
      questionDefs
        .filter((q) => q.subAreaId == null || !ids.has(q.subAreaId))
        .map((q) => q.id),
    [questionDefs, ids]
  );

  const selectedCount = selected.size;
  const selectedList = useMemo(() => [...selected], [selected]);

  if (questionDefs.length === 0 || subAreas.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Keine Aufgaben oder Teilgebiete vorhanden. Zuerst THE-Punkte
        importieren und Teilgebiete in den Einstellungen prüfen.
      </p>
    );
  }

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () =>
    setSelected(new Set(questionDefs.map((q) => q.id)));
  const selectNone = () => setSelected(new Set());
  const selectOpen = () => setSelected(new Set(unassignedIds));

  const assignSelected = (subAreaId: string) => {
    if (selectedList.length === 0) return;
    onChangeMany(selectedList, subAreaId);
    setSelected(new Set());
  };

  const saById = (saId: string | undefined) => {
    if (!saId || !ids.has(saId)) return null;
    return subAreas.find((s) => s.id === saId) ?? null;
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Label className="text-sm font-medium">
            Aufgaben den Teilgebieten zuordnen
          </Label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Kacheln markieren, dann unten farblich zuweisen. Jedes Teilgebiet
            hat eine eigene Farbe.
          </p>
        </div>
        <Badge
          className={cn(
            complete
              ? "border-transparent bg-emerald-600/15 text-emerald-900 dark:text-emerald-100"
              : "border-transparent bg-amber-600/20 text-amber-950 dark:text-amber-50"
          )}
        >
          {complete ? (
            <>
              <CheckCircle2 className="mr-1 size-3.5" />
              Bestätigt
            </>
          ) : (
            <>
              <AlertTriangle className="mr-1 size-3.5" />
              Zuordnung erforderlich
            </>
          )}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {perSa.map(({ subArea, count, maxPoints }, i) => {
          const c = subAreaColorAt(i);
          return (
            <span
              key={subArea.id}
              className={cn(
                "rounded-md border px-2 py-1 font-medium tabular-nums",
                c.solid,
                count === 0 && "opacity-70 ring-1 ring-amber-400/60"
              )}
            >
              {subArea.name}: {count} Aufg. · max {maxPoints} P
            </span>
          );
        })}
      </div>

      {/* Auswahl-Toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
        <span className="text-xs font-semibold">Auswahl:</span>
        <Button type="button" size="sm" variant="outline" onClick={selectAll}>
          Alle
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={selectNone}>
          Keine
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={selectOpen}
          disabled={unassignedIds.length === 0}
        >
          Nur offene ({unassignedIds.length})
        </Button>
        <Badge
          variant="secondary"
          className={cn(
            "tabular-nums font-semibold",
            selectedCount > 0 && "bg-primary text-primary-foreground"
          )}
        >
          {selectedCount} markiert
        </Badge>
      </div>

      {/* Bulk – prominent */}
      <div
        className={cn(
          "rounded-xl border-2 px-4 py-3 shadow-sm",
          selectedCount > 0
            ? "border-primary/50 bg-primary/10 dark:bg-primary/15"
            : "border-dashed border-primary/35 bg-muted/40"
        )}
      >
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold tracking-tight">
            Markierte zuweisen
            {selectedCount > 0 && (
              <span className="ml-1.5 font-normal text-muted-foreground">
                ({selectedCount} Aufgabe{selectedCount === 1 ? "" : "n"})
              </span>
            )}
          </p>
          {selectedCount === 0 && (
            <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
              Zuerst Kacheln markieren
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {subAreas.map((sa, i) => {
            const c = subAreaColorAt(i);
            return (
              <Button
                key={sa.id}
                type="button"
                size="default"
                disabled={selectedCount === 0}
                className={cn(
                  "h-10 border-2 font-semibold shadow-sm",
                  c.solid,
                  selectedCount === 0 && "opacity-50"
                )}
                variant="outline"
                onClick={() => assignSelected(sa.id)}
              >
                {selectedCount > 0 && (
                  <>
                    <span className="tabular-nums">{selectedCount}</span>
                    <ArrowRight className="size-4" />
                  </>
                )}
                {sa.name}
                <span className="opacity-80">({sa.code})</span>
              </Button>
            );
          })}
        </div>
      </div>

      {/* Kachel-Raster */}
      <div
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
        role="listbox"
        aria-multiselectable
        aria-label="Aufgaben zur Teilgebiet-Zuordnung"
      >
        {questionDefs.map((q) => {
          const sa = saById(q.subAreaId);
          const hasValid = sa != null;
          const isSel = selected.has(q.id);
          const saIdx = sa ? (indexById.get(sa.id) ?? 0) : -1;
          const colors = hasValid ? subAreaColorAt(saIdx) : null;
          return (
            <button
              key={q.id}
              type="button"
              role="option"
              aria-selected={isSel}
              onClick={() => toggle(q.id)}
              className={cn(
                "flex flex-col items-start gap-0.5 rounded-lg border-2 px-2.5 py-2 text-left text-sm transition-colors",
                "hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                hasValid && colors ? colors.tile : UNASSIGNED_TILE,
                isSel &&
                  "ring-2 ring-primary ring-offset-2 ring-offset-background"
              )}
            >
              <span className="w-full truncate font-semibold leading-tight">
                {q.label}
              </span>
              <span className="text-[11px] tabular-nums text-muted-foreground">
                max {q.maxPoints || "–"}
              </span>
              <Badge
                variant="outline"
                className={cn(
                  "mt-0.5 max-w-full truncate border px-1.5 py-0 text-[10px] font-semibold",
                  hasValid && colors
                    ? colors.solid
                    : "border-amber-500/50 bg-amber-100/80 text-amber-950 dark:text-amber-100"
                )}
              >
                {hasValid ? sa.code : "offen"}
              </Badge>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t pt-3">
        <Button
          type="button"
          size="default"
          disabled={!canConfirm}
          variant={complete && balanced ? "outline" : "default"}
          className="font-semibold"
          onClick={onConfirm}
        >
          <CheckCircle2 className="size-4" />
          {complete
            ? "Zuordnung erneut bestätigen"
            : "Zuordnung bestätigen & speichern"}
        </Button>
        {!assigned && (
          <p className="text-xs text-amber-800 dark:text-amber-200">
            Bitte jede Aufgabe einem Teilgebiet zuweisen (Mehrfachauswahl
            möglich).
          </p>
        )}
        {assigned && !balanced && (
          <p className="text-xs text-amber-800 dark:text-amber-200">
            Mindestens ein Teilgebiet hat keine Aufgabe – bei Bestätigung
            trotzdem speichern.
          </p>
        )}
        {complete && (
          <p className="text-xs text-emerald-700 dark:text-emerald-300">
            Gespeichert – Bereich klappt nach Bestätigung ein.
          </p>
        )}
      </div>
    </div>
  );
}
