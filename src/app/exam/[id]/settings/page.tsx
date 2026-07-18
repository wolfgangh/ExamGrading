"use client";

import { useExamContext } from "@/components/exam/exam-context";
import { createId } from "@/lib/id";
import type {
  AssessmentCriterion,
  CriterionScale,
  ExamType,
  PortfolioComponent,
  SubArea,
} from "@/lib/types";
import {
  EXAM_TYPE_LABELS,
  isHisManualAssessmentExam,
  isPortfolioExam,
  isStaCriteriaExam,
  isStaManualExam,
} from "@/lib/types";
import { defaultPortfolioComponents } from "@/lib/grades/portfolio";
import { formatGrade } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
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
import Link from "next/link";
import { useParams } from "next/navigation";
import { rebuildScenariosForMaxPoints } from "@/lib/grades/scenarios";
import {
  hasOpenGrading,
  openGradingSummary,
} from "@/lib/grades/open-grading";
import { CRITERION_SCALE_LABELS } from "@/lib/grades/sta-criteria";
import { recomputeStaCriteriaRecord } from "@/lib/grades/sta-criteria";
import { semesterSelectOptions } from "@/lib/semester";
import { ComboboxField } from "@/components/ui/combobox-field";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { id } = useParams<{ id: string }>();
  const { project, setProject } = useExamContext();
  if (!project) return null;

  const gradingLocked = hasOpenGrading(project);
  const isHisManual = isHisManualAssessmentExam(project.examType);
  const isStaCrit = isStaCriteriaExam(project.examType);
  const isPortfolio = isPortfolioExam(project.examType);

  const updateMeta = <K extends keyof typeof project>(
    key: K,
    value: (typeof project)[K]
  ) => {
    setProject((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "examType" && value === "sta_criteria") {
        next.criteria = next.criteria ?? [];
      }
      if (key === "examType" && value === "portfolio") {
        next.portfolioComponents =
          next.portfolioComponents?.length
            ? next.portfolioComponents
            : defaultPortfolioComponents(createId);
      }
      return next;
    });
  };

  const updatePortfolioComponent = (
    cid: string,
    patch: Partial<PortfolioComponent>
  ) => {
    setProject((prev) => ({
      ...prev,
      portfolioComponents: (prev.portfolioComponents ?? []).map((c) =>
        c.id === cid ? { ...c, ...patch } : c
      ),
    }));
  };

  const updateCriterion = (
    cid: string,
    patch: Partial<AssessmentCriterion>
  ) => {
    setProject((prev) => {
      const criteria = (prev.criteria ?? []).map((c) =>
        c.id === cid ? { ...c, ...patch } : c
      );
      const max = prev.gradeSchema.maxPoints;
      const points = prev.points.map((p) =>
        recomputeStaCriteriaRecord(p, criteria, max)
      );
      return { ...prev, criteria, points };
    });
  };

  const updateSubArea = (id: string, patch: Partial<SubArea>) => {
    setProject((prev) => {
      const subAreas = prev.subAreas.map((sa) =>
        sa.id === id ? { ...sa, ...patch } : sa
      );
      const maxPoints = subAreas.reduce((s, sa) => s + sa.maxPoints, 0);
      return rebuildScenariosForMaxPoints(
        { ...prev, subAreas },
        maxPoints || prev.gradeSchema.maxPoints
      );
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
            <ComboboxField
              label="Semester"
              value={project.semester}
              onChange={(v) => updateMeta("semester", v)}
              options={semesterSelectOptions()}
              placeholder={semesterSelectOptions()[0]}
              clearable
            />
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

      {isStaCrit && (
        <Card className="surface-panel">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">
                Bewertungskriterien (StA)
              </CardTitle>
              <CardDescription>
                Gewichte relativ (müssen nicht 100 ergeben). Skala: Prozent,
                Punkte oder Note. Gesamtwert → Notenschlüssel.
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setProject((prev) => ({
                  ...prev,
                  criteria: [
                    ...(prev.criteria ?? []),
                    {
                      id: createId("crit"),
                      name: "Neues Kriterium",
                      code: `K${(prev.criteria?.length ?? 0) + 1}`,
                      weight: 1,
                      scale: "percent" as CriterionScale,
                      maxPoints: 10,
                    },
                  ],
                }))
              }
            >
              <Plus className="size-4" />
              Kriterium
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {(project.criteria ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Noch keine Kriterien – bitte hinzufügen, dann unter
                Kriterienbewertung die Werte eintragen.
              </p>
            ) : (
              (project.criteria ?? []).map((c) => (
                <div
                  key={c.id}
                  className="grid grid-cols-1 gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_5rem_5rem_9rem_5rem_auto]"
                >
                  <div className="grid gap-1">
                    <Label className="text-xs">Name</Label>
                    <Input
                      value={c.name}
                      onChange={(e) =>
                        updateCriterion(c.id, { name: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">Kürzel</Label>
                    <Input
                      value={c.code}
                      onChange={(e) =>
                        updateCriterion(c.id, { code: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">Gewicht</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={c.weight}
                      onChange={(e) =>
                        updateCriterion(c.id, {
                          weight: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">Skala</Label>
                    <Select
                      value={c.scale}
                      onValueChange={(v) =>
                        v &&
                        updateCriterion(c.id, {
                          scale: v as CriterionScale,
                        })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {CRITERION_SCALE_LABELS[c.scale]}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {(
                          Object.keys(CRITERION_SCALE_LABELS) as CriterionScale[]
                        ).map((s) => (
                          <SelectItem key={s} value={s}>
                            {CRITERION_SCALE_LABELS[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">Max Pkte</Label>
                    <Input
                      type="number"
                      disabled={c.scale !== "points"}
                      value={c.maxPoints ?? ""}
                      onChange={(e) =>
                        updateCriterion(c.id, {
                          maxPoints: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="self-end"
                    onClick={() =>
                      setProject((prev) => {
                        const criteria = (prev.criteria ?? []).filter(
                          (x) => x.id !== c.id
                        );
                        const max = prev.gradeSchema.maxPoints;
                        const points = prev.points.map((p) =>
                          recomputeStaCriteriaRecord(p, criteria, max)
                        );
                        return { ...prev, criteria, points };
                      })
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))
            )}
            <Link
              href={`/exam/${id}/assessment`}
              className={cn(buttonVariants({ variant: "secondary", size: "sm" }))}
            >
              Zur Kriterienbewertung
            </Link>
          </CardContent>
        </Card>
      )}

      {isPortfolio && (
        <Card className="surface-panel">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">
                Teilleistungen (Portfolio)
              </CardTitle>
              <CardDescription>
                Standard: zwei Teilleistungen mit gleichem Gewicht. Namen und
                Gewichte anpassen; Gesamtnote = gewichteter Mittelwert der
                Teilnoten (nächste deutsche Note).
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setProject((prev) => ({
                  ...prev,
                  portfolioComponents: [
                    ...(prev.portfolioComponents ??
                      defaultPortfolioComponents(createId)),
                    {
                      id: createId("pc"),
                      name: `Teilleistung ${(prev.portfolioComponents?.length ?? 0) + 1}`,
                      code: `TL${(prev.portfolioComponents?.length ?? 0) + 1}`,
                      weight: 1,
                    },
                  ],
                }))
              }
            >
              <Plus className="size-4" />
              Teilleistung
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {(project.portfolioComponents ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Keine Teilleistungen – bitte hinzufügen.
              </p>
            ) : (
              (project.portfolioComponents ?? []).map((c) => (
                <div
                  key={c.id}
                  className="grid grid-cols-1 gap-2 rounded-lg border p-3 sm:grid-cols-[1fr_5rem_5rem_auto]"
                >
                  <div className="grid gap-1">
                    <Label className="text-xs">Bezeichnung</Label>
                    <Input
                      value={c.name}
                      onChange={(e) =>
                        updatePortfolioComponent(c.id, {
                          name: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">Kürzel</Label>
                    <Input
                      value={c.code}
                      onChange={(e) =>
                        updatePortfolioComponent(c.id, {
                          code: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">Gewicht</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={c.weight}
                      onChange={(e) =>
                        updatePortfolioComponent(c.id, {
                          weight: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="self-end"
                    disabled={(project.portfolioComponents?.length ?? 0) <= 1}
                    onClick={() =>
                      setProject((prev) => ({
                        ...prev,
                        portfolioComponents: (
                          prev.portfolioComponents ?? []
                        ).filter((x) => x.id !== c.id),
                      }))
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))
            )}
            <Link
              href={`/exam/${id}/assessment`}
              className={cn(
                buttonVariants({ variant: "secondary", size: "sm" })
              )}
            >
              Zu den Teilnoten
            </Link>
          </CardContent>
        </Card>
      )}

      {!isHisManual && (
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
      )}

      {!isStaManualExam(project.examType) && !isPortfolio && (
      <Card className="surface-panel">
        <CardHeader>
          <CardTitle className="text-base">Notenszenarien</CardTitle>
          <CardDescription>
            {isStaCrit
              ? "Notenschlüssel für den berechneten Gesamtwert der Kriterien. "
              : "Szenarien 45 / 40 / frei – Vergleich und aktives Szenario unter Notenszenarien. "}
            Aktive Bestehensgrenze: {project.gradeSchema.passThreshold} Punkte.
            {gradingLocked && (
              <>
                {" "}
                Notenschlüssel derzeit gesperrt: {openGradingSummary(project)}.
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Link
            href={`/exam/${id}/scenarios`}
            className={cn(buttonVariants())}
          >
            Notenszenarien öffnen
          </Link>
          <div className="overflow-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Note (aktiv)</TableHead>
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
      )}
    </div>
  );
}
