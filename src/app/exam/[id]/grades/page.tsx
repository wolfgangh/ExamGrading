"use client";

import { useMemo, useState } from "react";
import { useExamContext } from "@/components/exam/exam-context";
import { StudentsTable } from "@/components/grades/students-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { normalizeMatriculation } from "@/lib/matching/matriculation";
import type { PointsRecord } from "@/lib/types";
import { GERMAN_GRADES } from "@/lib/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatGrade } from "@/lib/utils";

export default function GradesPage() {
  const { project, setProject, rows } = useExamContext();
  const [editKey, setEditKey] = useState<string | null>(null);
  const [gradeValue, setGradeValue] = useState<string>("");
  const [comment, setComment] = useState("");

  const editRow = useMemo(
    () => rows.find((r) => r.key === editKey) ?? null,
    [rows, editKey]
  );

  if (!project) return null;

  const openEdit = (key: string) => {
    const row = rows.find((r) => r.key === key);
    setEditKey(key);
    setGradeValue(
      row?.gradeOverride != null
        ? String(row.gradeOverride)
        : row?.calculatedGrade != null
          ? String(row.calculatedGrade)
          : ""
    );
    setComment(row?.comment ?? "");
  };

  const saveOverride = () => {
    if (!editKey) return;
    const parsed =
      gradeValue.trim() === ""
        ? null
        : Number(gradeValue.replace(",", "."));
    const gradeOverride =
      parsed != null && Number.isFinite(parsed) ? parsed : null;

    setProject((prev) => {
      const idx = prev.points.findIndex(
        (p) => normalizeMatriculation(p.matriculationNumber) === editKey
      );
      const base: PointsRecord =
        idx >= 0
          ? prev.points[idx]
          : {
              matriculationNumber: editKey,
              bySubArea: Object.fromEntries(
                prev.subAreas.map((sa) => [sa.id, null])
              ),
              totalPoints: null,
              source: "manual",
            };
      const next: PointsRecord = {
        ...base,
        gradeOverride,
        comment: comment.trim() || undefined,
        source: base.source === "moodle" ? "mixed" : base.source,
      };
      const points = [...prev.points];
      if (idx >= 0) points[idx] = next;
      else points.push(next);
      return { ...prev, points };
    });
    setEditKey(null);
  };

  const clearOverride = () => {
    if (!editKey) return;
    setProject((prev) => {
      const idx = prev.points.findIndex(
        (p) => normalizeMatriculation(p.matriculationNumber) === editKey
      );
      if (idx < 0) {
        setEditKey(null);
        return prev;
      }
      const points = [...prev.points];
      points[idx] = {
        ...points[idx],
        gradeOverride: null,
        comment: comment.trim() || undefined,
      };
      return { ...prev, points };
    });
    setEditKey(null);
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Notenübersicht
        </h1>
        <p className="text-muted-foreground">
          Filterbare Gesamtliste. Note anklicken für manuelle Überschreibung
          mit Kommentar.
        </p>
      </div>

      <StudentsTable rows={rows} editable onEditGrade={openEdit} />

      <Dialog open={!!editKey} onOpenChange={(o) => !o && setEditKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Note bearbeiten</DialogTitle>
            <DialogDescription>
              {editRow
                ? `${editRow.student.lastName}, ${editRow.student.firstName} (${editRow.key})`
                : ""}
              {editRow?.calculatedGrade != null && (
                <> · berechnet: {formatGrade(editRow.calculatedGrade)}</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Note (Override)</Label>
              <Select
                value={gradeValue}
                onValueChange={(v) => v && setGradeValue(v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Note wählen">
                    {gradeValue
                      ? formatGrade(Number(gradeValue))
                      : "Note wählen"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {GERMAN_GRADES.map((g) => (
                    <SelectItem key={g} value={String(g)}>
                      {formatGrade(g)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                step="0.1"
                min={1}
                max={5}
                value={gradeValue}
                onChange={(e) => setGradeValue(e.target.value)}
                placeholder="oder manuell eingeben"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="comment">Begründung / Kommentar</Label>
              <Textarea
                id="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder="z. B. Nachkorrektur, Härtefall…"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="outline" onClick={clearOverride}>
              Override entfernen
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditKey(null)}
              >
                Abbrechen
              </Button>
              <Button type="button" onClick={saveOverride}>
                Speichern
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
