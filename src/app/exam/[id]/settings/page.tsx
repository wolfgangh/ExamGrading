"use client";

import { useExamContext } from "@/components/exam/exam-context";
import { generateLinearGradeSchema } from "@/lib/grades/schema";
import { createId } from "@/lib/id";
import type { ExamType, SubArea } from "@/lib/types";
import { EXAM_TYPE_LABELS } from "@/lib/types";
import { formatGrade } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Plus, Trash2 } from "lucide-react";

export default function SettingsPage() {
  const { project, setProject } = useExamContext();
  if (!project) return null;

  const updateMeta = <K extends keyof typeof project>(
    key: K,
    value: (typeof project)[K]
  ) => {
    setProject((prev) => ({ ...prev, [key]: value }));
  };

  const updateSubArea = (id: string, patch: Partial<SubArea>) => {
    setProject((prev) => {
      const subAreas = prev.subAreas.map((sa) =>
        sa.id === id ? { ...sa, ...patch } : sa
      );
      const maxPoints = subAreas.reduce((s, sa) => s + sa.maxPoints, 0);
      return {
        ...prev,
        subAreas,
        gradeSchema: {
          ...prev.gradeSchema,
          maxPoints,
        },
      };
    });
  };

  const regenerateSchema = () => {
    setProject((prev) => {
      const maxPoints = prev.subAreas.reduce((s, sa) => s + sa.maxPoints, 0);
      return {
        ...prev,
        gradeSchema: generateLinearGradeSchema(
          maxPoints || prev.gradeSchema.maxPoints,
          prev.gradeSchema.passThreshold,
          prev.gradeSchema.roundPointsUp
        ),
      };
    });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Einstellungen
        </h1>
        <p className="text-muted-foreground">
          Metadaten, Teilgebiete und Notenschema (analog Excel „Definitionen“ /
          „Notenszenarien“).
        </p>
      </div>

      <Card className="surface-panel">
        <CardHeader>
          <CardTitle className="text-base">Prüfungsmetadaten</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Name</Label>
            <Input
              value={project.name}
              onChange={(e) => updateMeta("name", e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Prüfungsnummer</Label>
            <Input
              value={project.examNumber}
              onChange={(e) => updateMeta("examNumber", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Semester</Label>
              <Input
                value={project.semester}
                onChange={(e) => updateMeta("semester", e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Typ</Label>
              <Select
                value={project.examType}
                onValueChange={(v) =>
                  v && updateMeta("examType", v as ExamType)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {EXAM_TYPE_LABELS[project.examType]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(EXAM_TYPE_LABELS) as ExamType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {EXAM_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Dozenten (Komma-getrennt)</Label>
            <Input
              value={project.lecturers.join(", ")}
              onChange={(e) =>
                updateMeta(
                  "lecturers",
                  e.target.value
                    .split(/[,;]/)
                    .map((s) => s.trim())
                    .filter(Boolean)
                )
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card className="surface-panel">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Teilgebiete</CardTitle>
            <CardDescription>
              Summe der Maxima = Gesamtpunktzahl
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setProject((prev) => ({
                ...prev,
                subAreas: [
                  ...prev.subAreas,
                  {
                    id: createId("sa"),
                    name: "Neues Teilgebiet",
                    code: "X",
                    maxPoints: 0,
                  },
                ],
              }))
            }
          >
            <Plus className="size-4" />
            Hinzufügen
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {project.subAreas.map((sa) => (
            <div
              key={sa.id}
              className="grid grid-cols-[1fr_5rem_6rem_auto] items-end gap-2"
            >
              <div className="grid gap-1">
                <Label className="text-xs">Name</Label>
                <Input
                  value={sa.name}
                  onChange={(e) =>
                    updateSubArea(sa.id, { name: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Kürzel</Label>
                <Input
                  value={sa.code}
                  onChange={(e) =>
                    updateSubArea(sa.id, { code: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Max. Pkte</Label>
                <Input
                  type="number"
                  value={sa.maxPoints}
                  onChange={(e) =>
                    updateSubArea(sa.id, {
                      maxPoints: Number(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={project.subAreas.length <= 1}
                onClick={() =>
                  setProject((prev) => ({
                    ...prev,
                    subAreas: prev.subAreas.filter((s) => s.id !== sa.id),
                  }))
                }
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="surface-panel">
        <CardHeader>
          <CardTitle className="text-base">Notenschema</CardTitle>
          <CardDescription>
            Lineare Skala wie im Excel-Notenszenario (Schrittweite aus max. −
            Bestehensgrenze)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Bestehensgrenze (Punkte)</Label>
              <Input
                type="number"
                value={project.gradeSchema.passThreshold}
                onChange={(e) =>
                  setProject((prev) => ({
                    ...prev,
                    gradeSchema: {
                      ...prev.gradeSchema,
                      passThreshold: Number(e.target.value) || 0,
                    },
                  }))
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Max. Punkte (Schema)</Label>
              <Input
                type="number"
                value={project.gradeSchema.maxPoints}
                onChange={(e) =>
                  setProject((prev) => ({
                    ...prev,
                    gradeSchema: {
                      ...prev.gradeSchema,
                      maxPoints: Number(e.target.value) || 0,
                    },
                  }))
                }
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4"
              checked={project.gradeSchema.roundPointsUp}
              onChange={(e) =>
                setProject((prev) => ({
                  ...prev,
                  gradeSchema: {
                    ...prev.gradeSchema,
                    roundPointsUp: e.target.checked,
                  },
                }))
              }
            />
            Punkte vor Notenbildung aufrunden (Excel ROUNDUP)
          </label>
          <Button type="button" onClick={regenerateSchema}>
            Schwellen neu berechnen
          </Button>

          <div className="overflow-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Note</TableHead>
                  <TableHead>ab Punkte</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...project.gradeSchema.thresholds]
                  .sort((a, b) => a.grade - b.grade)
                  .map((t) => (
                    <TableRow key={t.grade}>
                      <TableCell className="font-medium">
                        {formatGrade(t.grade)}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {t.minPoints}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
