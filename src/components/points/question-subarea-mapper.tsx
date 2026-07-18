"use client";

import type { QuestionDef, SubArea } from "@/lib/types";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { cn } from "@/lib/utils";
import {
  countQuestionsPerSubArea,
  isSubAreaMappingAssigned,
  isSubAreaMappingBalanced,
  isSubAreaMappingComplete,
} from "@/lib/grades/subarea-mapping";
import type { ExamProject } from "@/lib/types";
import { CheckCircle2, AlertTriangle } from "lucide-react";

export function QuestionSubareaMapper({
  project,
  questionDefs,
  subAreas,
  onChange,
  onConfirm,
}: {
  project: ExamProject;
  questionDefs: QuestionDef[];
  subAreas: SubArea[];
  onChange: (questionId: string, subAreaId: string) => void;
  onConfirm: () => void;
}) {
  if (questionDefs.length === 0 || subAreas.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Keine Aufgaben oder Teilgebiete vorhanden. Zuerst THE-Punkte
        importieren und Teilgebiete in den Einstellungen prüfen.
      </p>
    );
  }

  const ids = new Set(subAreas.map((s) => s.id));
  const assigned = isSubAreaMappingAssigned(project);
  const balanced = isSubAreaMappingBalanced(project);
  const complete = isSubAreaMappingComplete(project);
  const perSa = countQuestionsPerSubArea(questionDefs, subAreas);
  const canConfirm = assigned;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Label className="text-sm font-medium">
            Aufgaben den Teilgebieten zuordnen
          </Label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Steuert Summen je Teilgebiet (z. B. Finanzierung vs. Investition).
            Ohne Zuordnung werden Teilgebietssummen nicht berechnet.
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
        {perSa.map(({ subArea, count, maxPoints }) => (
          <span
            key={subArea.id}
            className={cn(
              "rounded-md border px-2 py-1 tabular-nums",
              count === 0
                ? "border-amber-400 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
                : "border-emerald-200 bg-emerald-50/80 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100"
            )}
          >
            {subArea.name}: {count} Aufg. · max {maxPoints} P
          </span>
        ))}
      </div>

      <div className="overflow-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Aufgabe</TableHead>
              <TableHead className="w-20">Max</TableHead>
              <TableHead>Teilgebiet</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {questionDefs.map((q) => {
              const hasValid =
                q.subAreaId != null && ids.has(q.subAreaId);
              return (
                <TableRow
                  key={q.id}
                  className={cn(
                    hasValid
                      ? "bg-emerald-50/50 dark:bg-emerald-950/20"
                      : "bg-amber-50/70 dark:bg-amber-950/30"
                  )}
                >
                  <TableCell className="font-medium">{q.label}</TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {q.maxPoints || "–"}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={hasValid ? q.subAreaId! : ""}
                      onValueChange={(v) => v && onChange(q.id, v)}
                    >
                      <SelectTrigger
                        className={cn(
                          "w-full max-w-xs",
                          !hasValid &&
                            "border-amber-500 ring-1 ring-amber-400/50"
                        )}
                      >
                        <SelectValue placeholder="Teilgebiet wählen…">
                          {hasValid
                            ? (subAreas.find((s) => s.id === q.subAreaId)
                                ?.name ?? "–")
                            : "Teilgebiet wählen…"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {subAreas.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name} ({s.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={!canConfirm}
          variant={complete && balanced ? "outline" : "default"}
          onClick={onConfirm}
        >
          <CheckCircle2 className="size-4" />
          {complete
            ? "Zuordnung erneut bestätigen"
            : "Zuordnung bestätigen & speichern"}
        </Button>
        {!assigned && (
          <p className="text-xs text-amber-800 dark:text-amber-200">
            Bitte jede Aufgabe einem Teilgebiet zuweisen.
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
            Gespeichert – Teilgebietssummen sind freigegeben.
          </p>
        )}
      </div>
    </div>
  );
}
