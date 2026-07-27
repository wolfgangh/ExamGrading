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
  isOnlineStyleExam,
  isPortfolioExam,
  isStaCriteriaExam,
  isStaManualExam,
  supportsStudentGroups,
} from "@/lib/types";
import {
  getMoodlePointsRoundStep,
  MOODLE_ROUND_STEP_OPTIONS,
} from "@/lib/grades/round-half-points";
import type { MoodlePointsRoundStep } from "@/lib/types";
import {
  collapseLecturerGradesToSimple,
  defaultPortfolioComponents,
  resolveComponentCriteriaScale,
  seedLecturerGradesFromSimple,
  withComponentCriteriaScale,
} from "@/lib/grades/portfolio";
import { ensurePortfolioScenarios } from "@/lib/grades/scenarios";
import { Switch } from "@/components/ui/switch";
import {
  createStudentGroup,
  removeStudentGroup,
  sortedStudentGroups,
} from "@/lib/student-groups";
import { formatGrade } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { LecturerPicker } from "@/components/exam/lecturer-picker";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { id } = useParams<{ id: string }>();
  const { project, setProject } = useExamContext();
  if (!project) return null;

  const gradingLocked = hasOpenGrading(project);
  const isHisManual = isHisManualAssessmentExam(project.examType);
  const isStaCrit = isStaCriteriaExam(project.examType);
  const isPortfolio = isPortfolioExam(project.examType);
  const showGroups = supportsStudentGroups(project.examType);
  const groups = sortedStudentGroups(project);

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
      portfolioComponents: (prev.portfolioComponents ?? []).map((c) => {
        if (c.id !== cid) return c;
        if (patch.criteriaScale) {
          return withComponentCriteriaScale(
            { ...c, ...patch },
            patch.criteriaScale
          );
        }
        return { ...c, ...patch };
      }),
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

  const showScenariosCard =
    !isStaManualExam(project.examType) &&
    (!isPortfolio ||
      project.portfolioCriteriaMode === true);

  const metaCard = (
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
          <LecturerPicker
            value={project.lecturers ?? []}
            onChange={(lecturers) => updateMeta("lecturers", lecturers)}
            id="settings-lecturers"
          />
        </CardContent>
      </Card>
  );

  const scenariosCard = showScenariosCard ? (
      <Card className="surface-panel">
        <CardHeader>
          <CardTitle className="text-base">Notenszenarien</CardTitle>
          <CardDescription>
            {isPortfolio
              ? "Portfolio mit Punkte/Prozent-TLs: 50 % / 40 % / frei / eigene Grenzen. Aktives Szenario unter Notenszenarien wählen. "
              : isStaCrit
                ? "Notenschlüssel für den berechneten Gesamtwert der Kriterien. "
                : "Szenarien 45 / 40 / frei – Vergleich und aktives Szenario unter Notenszenarien. "}
            Aktive Bestehensgrenze: {project.gradeSchema.passThreshold} Punkte
            {project.gradeSchema.maxPoints > 0
              ? ` (${Math.round((project.gradeSchema.passThreshold / project.gradeSchema.maxPoints) * 1000) / 10} %)`
              : ""}
            .
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
  ) : null;

  return (
    <div
      className={cn(
        "mx-auto space-y-6",
        isStaCrit || isPortfolio ? "max-w-5xl" : "max-w-3xl"
      )}
    >
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Einstellungen
        </h1>
        <p className="text-muted-foreground">
          Metadaten, Teilgebiete und Notenschema (analog Excel „Definitionen“ /
          „Notenszenarien“).
        </p>
      </div>

      {isStaCrit ? (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          {metaCard}
          {scenariosCard}
        </div>
      ) : (
        metaCard
      )}

      {isOnlineStyleExam(project.examType) && (
        <Card className="surface-panel">
          <CardHeader>
            <CardTitle className="text-base">Moodle- / THE-Import</CardTitle>
            <CardDescription>
              Optionen für den Punkteimport aus Moodle (THE / elektronische
              Prüfung). Betrifft künftige Importe; manuelle Matrix-Eingaben
              bleiben unberührt.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-1.5">
              <Label htmlFor="moodle-round-step">Punkterundung beim Import</Label>
              <Select
                value={String(getMoodlePointsRoundStep(project))}
                onValueChange={(v) => {
                  if (!v) return;
                  const step: MoodlePointsRoundStep =
                    v === "none" ? "none" : v === "0.25" ? 0.25 : 0.5;
                  setProject((prev) => ({
                    ...prev,
                    moodlePointsRoundStep: step,
                    // Legacy-Flag synchron halten
                    roundMoodlePointsToHalf: step !== "none",
                  }));
                }}
              >
                <SelectTrigger id="moodle-round-step" className="w-full max-w-md">
                  <SelectValue>
                    {
                      MOODLE_ROUND_STEP_OPTIONS.find(
                        (o) =>
                          String(o.value) ===
                          String(getMoodlePointsRoundStep(project))
                      )?.label
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {MOODLE_ROUND_STEP_OPTIONS.map((o) => (
                    <SelectItem key={String(o.value)} value={String(o.value)}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Beispiel: </span>
                {
                  MOODLE_ROUND_STEP_OPTIONS.find(
                    (o) =>
                      String(o.value) ===
                      String(getMoodlePointsRoundStep(project))
                  )?.example
                }
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {showGroups && (
        <Card className="surface-panel">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Studentengruppen</CardTitle>
              <CardDescription>
                Gruppen anlegen und in der Bewertung filtern – Noten pro
                Gruppe eintragen und schnell wechseln.
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setProject((prev) => ({
                  ...prev,
                  studentGroups: [
                    ...(prev.studentGroups ?? []),
                    createStudentGroup(
                      `Gruppe ${(prev.studentGroups?.length ?? 0) + 1}`,
                      prev.studentGroups ?? []
                    ),
                  ],
                }))
              }
            >
              <Plus className="size-4" />
              Gruppe
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {groups.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Noch keine Gruppen. Nach dem Anlegen unter Bewertung /
                Notenübersicht zuordnen und filtern.
              </p>
            ) : (
              groups.map((g) => {
                const n = Object.values(project.students).filter(
                  (s) => s.groupId === g.id
                ).length;
                return (
                  <div
                    key={g.id}
                    className="flex flex-wrap items-end gap-2 rounded-lg border p-3"
                  >
                    <div className="grid min-w-[12rem] flex-1 gap-1">
                      <Label className="text-xs">Name</Label>
                      <Input
                        value={g.name}
                        onChange={(e) =>
                          setProject((prev) => ({
                            ...prev,
                            studentGroups: (prev.studentGroups ?? []).map(
                              (x) =>
                                x.id === g.id
                                  ? { ...x, name: e.target.value }
                                  : x
                            ),
                          }))
                        }
                      />
                    </div>
                    <span className="pb-2 text-xs tabular-nums text-muted-foreground">
                      {n} Person(en)
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() =>
                        setProject((prev) => removeStudentGroup(prev, g.id))
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      )}

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
                  className="space-y-2 rounded-lg border p-3"
                >
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_5rem_5rem_9rem_5rem_auto]">
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
                            Object.keys(
                              CRITERION_SCALE_LABELS
                            ) as CriterionScale[]
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
                  <div className="grid gap-1">
                    <Label className="text-xs">
                      Beschreibung (Tooltip in der Bewertung)
                    </Label>
                    <Textarea
                      value={c.description ?? ""}
                      placeholder="Detaillierte Erläuterung des Kriteriums …"
                      rows={2}
                      className="min-h-[3.5rem] resize-y text-sm"
                      onChange={(e) =>
                        updateCriterion(c.id, {
                          description: e.target.value || undefined,
                        })
                      }
                    />
                  </div>
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
            <div className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-0.5">
                <Label htmlFor="portfolio-criteria-mode" className="text-sm">
                  Teilleistungen über Kriterien bewerten
                </Label>
                <p className="text-xs text-muted-foreground">
                  Pro Teilleistung gewichtete Kriterien (Prozent, Punkte oder
                  Note) → berechnete Teilnote. Kombinierbar mit „je Dozent“.
                  Standard: aus (direkte Teilnote).
                </p>
              </div>
              <Switch
                id="portfolio-criteria-mode"
                checked={project.portfolioCriteriaMode === true}
                onCheckedChange={(on) =>
                  setProject((prev) => {
                    const next = {
                      ...prev,
                      portfolioCriteriaMode: on,
                      portfolioComponents: (prev.portfolioComponents ?? []).map(
                        (pc) => {
                          if (on && !(pc.criteria?.length)) {
                            return withComponentCriteriaScale(
                              {
                                ...pc,
                                criteria: [
                                  {
                                    id: createId("crit"),
                                    name: "Inhalt",
                                    code: "K1",
                                    weight: 1,
                                    scale: "points",
                                    maxPoints: 6,
                                  },
                                ],
                              },
                              "points"
                            );
                          }
                          if (on) {
                            return withComponentCriteriaScale(
                              pc,
                              resolveComponentCriteriaScale(pc)
                            );
                          }
                          return pc;
                        }
                      ),
                    };
                    return on ? ensurePortfolioScenarios(next) : next;
                  })
                }
              />
            </div>
            <div className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-0.5">
                <Label htmlFor="portfolio-per-lecturer" className="text-sm">
                  Teilnoten je Dozent (Gleichgewichtung)
                </Label>
                <p className="text-xs text-muted-foreground">
                  {project.portfolioCriteriaMode
                    ? "Jeder Dozent füllt die Kriterien pro Teilleistung; Teilnote = Mittel der Dozenten-Noten."
                    : "Jeder Dozent vergibt Noten pro Teilleistung. Die Teilnote ist das Mittel über alle Dozenten."}{" "}
                  Standard: aus.
                </p>
                {(project.lecturers ?? []).length === 0 && (
                  <p className="text-xs text-amber-800 dark:text-amber-200">
                    Bitte zuerst Dozenten unter Stammdaten eintragen.
                  </p>
                )}
              </div>
              <Switch
                id="portfolio-per-lecturer"
                checked={project.portfolioPerLecturerGrading === true}
                onCheckedChange={(on) => {
                  setProject((prev) =>
                    on
                      ? seedLecturerGradesFromSimple(prev)
                      : collapseLecturerGradesToSimple(prev)
                  );
                }}
              />
            </div>
            {(project.portfolioComponents ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Keine Teilleistungen – bitte hinzufügen.
              </p>
            ) : (
              (project.portfolioComponents ?? []).map((c) => (
                <div
                  key={c.id}
                  className="space-y-3 rounded-lg border p-3"
                >
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_5rem_5rem_auto]">
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
                {project.portfolioCriteriaMode && (
                  <div className="space-y-2 border-t pt-3">
                    <div className="grid max-w-md gap-1.5">
                      <Label className="text-xs">
                        Bewertungsart dieser Teilleistung
                      </Label>
                      <Select
                        value={resolveComponentCriteriaScale(c)}
                        onValueChange={(v) => {
                          if (!v) return;
                          updatePortfolioComponent(c.id, {
                            criteriaScale: v as CriterionScale,
                          });
                          if (v === "points" || v === "percent") {
                            setProject((prev) =>
                              ensurePortfolioScenarios(prev)
                            );
                          }
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {
                              CRITERION_SCALE_LABELS[
                                resolveComponentCriteriaScale(c)
                              ]
                            }
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {(
                            Object.keys(
                              CRITERION_SCALE_LABELS
                            ) as CriterionScale[]
                          ).map((s) => (
                            <SelectItem key={s} value={s}>
                              {CRITERION_SCALE_LABELS[s]}
                              {s === "grade"
                                ? " (ohne Szenarien)"
                                : " (Szenarien anwendbar)"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-muted-foreground">
                        Gilt für alle Kriterien dieser TL. Punkte/Prozent:
                        Noten über Notenszenarien; Note: feste Umrechnung.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        Kriterien für {c.code || c.name}
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const scale = resolveComponentCriteriaScale(c);
                          setProject((prev) => ({
                            ...prev,
                            portfolioComponents: (
                              prev.portfolioComponents ?? []
                            ).map((pc) =>
                              pc.id === c.id
                                ? {
                                    ...pc,
                                    criteriaScale: scale,
                                    criteria: [
                                      ...(pc.criteria ?? []),
                                      {
                                        id: createId("crit"),
                                        name: "Kriterium",
                                        code: `K${(pc.criteria?.length ?? 0) + 1}`,
                                        weight: 1,
                                        scale,
                                        maxPoints:
                                          scale === "points" ? 6 : 100,
                                      },
                                    ],
                                  }
                                : pc
                            ),
                          }));
                        }}
                      >
                        <Plus className="size-3.5" />
                        Kriterium
                      </Button>
                    </div>
                    {(c.criteria ?? []).length === 0 ? (
                      <p className="text-xs text-amber-800 dark:text-amber-200">
                        Noch keine Kriterien – bitte hinzufügen.
                      </p>
                    ) : (
                      (c.criteria ?? []).map((crit) => (
                        <div
                          key={crit.id}
                          className="space-y-2 rounded-md border bg-muted/20 p-2"
                        >
                          <div
                            className={cn(
                              "grid grid-cols-1 gap-2",
                              resolveComponentCriteriaScale(c) === "points"
                                ? "sm:grid-cols-[1fr_4rem_4rem_4.5rem_auto]"
                                : "sm:grid-cols-[1fr_4rem_4rem_auto]"
                            )}
                          >
                            <Input
                              value={crit.name}
                              placeholder="Name"
                              onChange={(e) =>
                                setProject((prev) => ({
                                  ...prev,
                                  portfolioComponents: (
                                    prev.portfolioComponents ?? []
                                  ).map((pc) =>
                                    pc.id === c.id
                                      ? {
                                          ...pc,
                                          criteria: (pc.criteria ?? []).map(
                                            (k) =>
                                              k.id === crit.id
                                                ? {
                                                    ...k,
                                                    name: e.target.value,
                                                  }
                                                : k
                                          ),
                                        }
                                      : pc
                                  ),
                                }))
                              }
                            />
                            <Input
                              value={crit.code}
                              placeholder="Kürzel"
                              onChange={(e) =>
                                setProject((prev) => ({
                                  ...prev,
                                  portfolioComponents: (
                                    prev.portfolioComponents ?? []
                                  ).map((pc) =>
                                    pc.id === c.id
                                      ? {
                                          ...pc,
                                          criteria: (pc.criteria ?? []).map(
                                            (k) =>
                                              k.id === crit.id
                                                ? {
                                                    ...k,
                                                    code: e.target.value,
                                                  }
                                                : k
                                          ),
                                        }
                                      : pc
                                  ),
                                }))
                              }
                            />
                            <Input
                              type="number"
                              step="0.5"
                              value={crit.weight}
                              title="Gewicht"
                              onChange={(e) =>
                                setProject((prev) => ({
                                  ...prev,
                                  portfolioComponents: (
                                    prev.portfolioComponents ?? []
                                  ).map((pc) =>
                                    pc.id === c.id
                                      ? {
                                          ...pc,
                                          criteria: (pc.criteria ?? []).map(
                                            (k) =>
                                              k.id === crit.id
                                                ? {
                                                    ...k,
                                                    weight:
                                                      Number(e.target.value) ||
                                                      0,
                                                  }
                                                : k
                                          ),
                                        }
                                      : pc
                                  ),
                                }))
                              }
                            />
                            {resolveComponentCriteriaScale(c) === "points" && (
                              <Input
                                type="number"
                                value={crit.maxPoints ?? ""}
                                placeholder="Max"
                                title="Max. Punkte dieses Kriteriums"
                                onChange={(e) =>
                                  setProject((prev) => ({
                                    ...prev,
                                    portfolioComponents: (
                                      prev.portfolioComponents ?? []
                                    ).map((pc) =>
                                      pc.id === c.id
                                        ? {
                                            ...pc,
                                            criteria: (pc.criteria ?? []).map(
                                              (k) =>
                                                k.id === crit.id
                                                  ? {
                                                      ...k,
                                                      maxPoints:
                                                        Number(
                                                          e.target.value
                                                        ) || 0,
                                                    }
                                                  : k
                                            ),
                                          }
                                        : pc
                                    ),
                                  }))
                                }
                              />
                            )}
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              onClick={() =>
                                setProject((prev) => ({
                                  ...prev,
                                  portfolioComponents: (
                                    prev.portfolioComponents ?? []
                                  ).map((pc) =>
                                    pc.id === c.id
                                      ? {
                                          ...pc,
                                          criteria: (
                                            pc.criteria ?? []
                                          ).filter((k) => k.id !== crit.id),
                                        }
                                      : pc
                                  ),
                                }))
                              }
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                          <div className="grid gap-1">
                            <Label className="text-[11px] text-muted-foreground">
                              Beschreibung (Tooltip)
                            </Label>
                            <Textarea
                              value={crit.description ?? ""}
                              placeholder="Detaillierte Erläuterung dieses Teilkriteriums …"
                              rows={2}
                              className="min-h-[3rem] resize-y text-sm"
                              onChange={(e) =>
                                setProject((prev) => ({
                                  ...prev,
                                  portfolioComponents: (
                                    prev.portfolioComponents ?? []
                                  ).map((pc) =>
                                    pc.id === c.id
                                      ? {
                                          ...pc,
                                          criteria: (pc.criteria ?? []).map(
                                            (k) =>
                                              k.id === crit.id
                                                ? {
                                                    ...k,
                                                    description:
                                                      e.target.value ||
                                                      undefined,
                                                  }
                                                : k
                                          ),
                                        }
                                      : pc
                                  ),
                                }))
                              }
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
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

      {/* THE/Klausur/Portfolio: Szenarien unterhalb; bei STA bereits neben Metadaten */}
      {!isStaCrit && scenariosCard}
      {isPortfolio && !scenariosCard && project.portfolioCriteriaMode && (
        <Card className="surface-panel">
          <CardHeader>
            <CardTitle className="text-base">Notenszenarien</CardTitle>
            <CardDescription>
              Für Punkte- oder Prozent-Teilleistungen: Szenarien unter
              „Notenszenarien“ wählen (50 % / 40 % / frei / eigene Grenzen).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href={`/exam/${id}/scenarios`}
              className={cn(buttonVariants())}
            >
              Notenszenarien öffnen
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
