"use client";

import { useEffect, useMemo, useState } from "react";
import type { PointsRecord, QuestionDef, Student } from "@/lib/types";
import { recomputePointsRecord } from "@/lib/grades/points-total";
import { formatPoints } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Lock, LockOpen } from "lucide-react";
import type { SubArea } from "@/lib/types";

export function DetailPointsPanel({
  open,
  onOpenChange,
  student,
  record,
  questionDefs,
  subAreas,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: Student;
  record: PointsRecord | null;
  questionDefs: QuestionDef[];
  subAreas: SubArea[];
  onSave: (next: PointsRecord) => void;
}) {
  const [unlocked, setUnlocked] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const byQuestion = useMemo(
    () => record?.byQuestion ?? {},
    [record?.byQuestion]
  );
  const needs = new Set(record?.needsGrading ?? []);

  const defs = useMemo(() => {
    if (questionDefs.length > 0) return questionDefs;
    return Object.keys(byQuestion).map((id, i) => ({
      id,
      label: id.toUpperCase(),
      maxPoints: 0,
      orderIndex: i,
    }));
  }, [questionDefs, byQuestion]);

  // Reset draft when opening
  useEffect(() => {
    if (!open) return;
    const d: Record<string, string> = {};
    for (const q of defs) {
      const v = byQuestion[q.id];
      d[q.id] = v != null ? String(v).replace(".", ",") : "";
    }
    setDraft(d);
    setUnlocked(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, student.matriculationNumber]);

  const total = record
    ? recomputePointsRecord(
        {
          ...record,
          byQuestion: Object.fromEntries(
            defs.map((q) => {
              const raw = draft[q.id]?.trim() ?? "";
              if (!raw) return [q.id, null];
              const n = Number(raw.replace(",", "."));
              return [q.id, Number.isFinite(n) ? n : null];
            })
          ),
        },
        defs,
        subAreas
      ).totalPoints
    : null;

  const save = () => {
    const base: PointsRecord = record ?? {
      matriculationNumber: student.matriculationNumber,
      bySubArea: Object.fromEntries(subAreas.map((s) => [s.id, null])),
      totalPoints: null,
      source: "manual",
    };
    const byQ: Record<string, number | null> = {};
    const stillNeed: string[] = [];
    for (const q of defs) {
      const raw = draft[q.id]?.trim() ?? "";
      if (!raw) {
        byQ[q.id] = null;
        if (needs.has(q.id) || record?.needsGrading?.includes(q.id)) {
          stillNeed.push(q.id);
        }
      } else {
        const n = Number(raw.replace(",", "."));
        byQ[q.id] = Number.isFinite(n) ? n : null;
        if (byQ[q.id] == null) stillNeed.push(q.id);
      }
    }
    const next = recomputePointsRecord(
      {
        ...base,
        byQuestion: byQ,
        needsGrading: stillNeed,
        source: base.source === "moodle" ? "mixed" : base.source,
      },
      defs,
      subAreas
    );
    onSave(next);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Detailpunkte</DialogTitle>
          <DialogDescription>
            {student.lastName}, {student.firstName} ({student.matriculationNumber}
            ) · Gesamt berechnet:{" "}
            <strong>{formatPoints(total)}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={unlocked ? "default" : "outline"}
            onClick={() => setUnlocked((u) => !u)}
          >
            {unlocked ? (
              <>
                <LockOpen className="size-4" /> Bearbeitung aktiv
              </>
            ) : (
              <>
                <Lock className="size-4" /> Bearbeitung freigeben
              </>
            )}
          </Button>
          {!unlocked && (
            <span className="text-xs text-muted-foreground">
              Nur Detailaufgaben editierbar – keine Gesamtpunkte.
            </span>
          )}
        </div>

        {defs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Noch keine Aufgaben-Spalten aus dem THE-Import. Bitte
            Punkte-Excel importieren.
          </p>
        ) : (
          <div className="overflow-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aufgabe</TableHead>
                  <TableHead className="w-16">Max</TableHead>
                  <TableHead className="w-28">Punkte</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {defs.map((q) => {
                  const openTask =
                    needs.has(q.id) ||
                    (draft[q.id] === "" &&
                      record?.needsGrading?.includes(q.id));
                  return (
                    <TableRow
                      key={q.id}
                      className={
                        openTask
                          ? "bg-amber-50 dark:bg-amber-950/30"
                          : undefined
                      }
                    >
                      <TableCell className="font-medium">{q.label}</TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {q.maxPoints || "–"}
                      </TableCell>
                      <TableCell>
                        {unlocked ? (
                          <Input
                            className="h-8"
                            value={draft[q.id] ?? ""}
                            placeholder={
                              openTask ? "Bewertung notwendig" : "–"
                            }
                            onChange={(e) =>
                              setDraft((d) => ({
                                ...d,
                                [q.id]: e.target.value,
                              }))
                            }
                          />
                        ) : (
                          <span className="tabular-nums">
                            {draft[q.id]
                              ? draft[q.id]
                              : openTask
                                ? "—"
                                : "–"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {openTask ? (
                          <Badge
                            variant="outline"
                            className="border-amber-500 text-amber-900 dark:text-amber-100"
                          >
                            Bewertung notwendig
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            ok
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Schließen
          </Button>
          <Button type="button" disabled={!unlocked} onClick={save}>
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
