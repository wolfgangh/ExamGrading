"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useExamContext } from "@/components/exam/exam-context";
import { PointsMatrix } from "@/components/points/points-matrix";
import { QuestionSubareaMapper } from "@/components/points/question-subarea-mapper";
import { QuestionStatsPanel } from "@/components/points/question-stats-panel";
import { DurationPointsScatterCard } from "@/components/charts/duration-points-scatter";
import { DurationHistogramCard } from "@/components/charts/duration-histogram-chart";
import { isOnlineStyleExam } from "@/lib/types";
import {
  computeQuestionStats,
  computeSubAreaStats,
} from "@/lib/grades/question-stats";
import {
  ensureQuestionDefs,
  projectWithEnsuredQuestionDefs,
} from "@/lib/grades/ensure-question-defs";
import { recomputePointsRecord } from "@/lib/grades/points-total";
import { normalizeMatriculation } from "@/lib/matching/matriculation";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  PageSectionNav,
  SECTION_SCROLL_MT,
} from "@/components/layout/page-section-nav";
import { cn } from "@/lib/utils";
import { CheckCircle2, Lock, LockOpen, RefreshCw } from "lucide-react";
import type { PointsRecord } from "@/lib/types";
import {
  isSubAreaMappingComplete,
  needsSubAreaMapping,
} from "@/lib/grades/subarea-mapping";

export default function DetailPointsPage() {
  const { id } = useParams<{ id: string }>();
  const { project, setProject } = useExamContext();
  const [unlocked, setUnlocked] = useState(false);
  const [search, setSearch] = useState("");
  const [onlyOpen, setOnlyOpen] = useState(false);
  /** Accordion value: ["subareas"] open, [] closed */
  const [subMapOpen, setSubMapOpen] = useState<string[]>(["subareas"]);

  // questionDefs aus byQuestion rekonstruieren und einmal persistieren
  useEffect(() => {
    if (!project) return;
    if (project.questionDefs && project.questionDefs.length > 0) return;
    const next = projectWithEnsuredQuestionDefs(project);
    if (next.questionDefs && next.questionDefs.length > 0) {
      setProject(() => next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, project?.points?.length]);

  const effectiveProject = useMemo(() => {
    if (!project) return null;
    const defs = ensureQuestionDefs(project);
    if (defs === project.questionDefs) return project;
    return { ...project, questionDefs: defs };
  }, [project]);

  const questionStats = useMemo(
    () => (effectiveProject ? computeQuestionStats(effectiveProject) : []),
    [effectiveProject]
  );
  const subAreaStats = useMemo(
    () => (effectiveProject ? computeSubAreaStats(effectiveProject) : []),
    [effectiveProject]
  );
  const pctMap = useMemo(() => {
    const m: Record<string, number | null> = {};
    for (const q of questionStats) m[q.questionId] = q.averagePercent;
    return m;
  }, [questionStats]);

  // Nach Bestätigung einklappen; bei unvollständiger Zuordnung wieder öffnen
  // (vor early return – Hooks-Regeln)
  useEffect(() => {
    if (!project) return;
    if (!needsSubAreaMapping(project)) return;
    if (isSubAreaMappingComplete(project)) {
      setSubMapOpen([]);
    } else {
      setSubMapOpen(["subareas"]);
    }
  }, [project]);

  if (!project || !effectiveProject) return null;

  const taskCount = ensureQuestionDefs(effectiveProject).length;
  const hasPointsButNoTasks =
    project.points.length > 0 && taskCount === 0;
  const showSubareaMapping = needsSubAreaMapping(effectiveProject);
  const subMapComplete = isSubAreaMappingComplete(effectiveProject);

  const updateQuestionSubAreas = (
    questionIds: string[],
    subAreaId: string
  ) => {
    if (questionIds.length === 0) return;
    const idSet = new Set(questionIds);
    setProject((prev) => {
      const baseDefs = ensureQuestionDefs(prev);
      const questionDefs = baseDefs.map((q) =>
        idSet.has(q.id) ? { ...q, subAreaId } : q
      );
      const points = prev.points.map((rec) =>
        recomputePointsRecord(rec, questionDefs, prev.subAreas)
      );
      return {
        ...prev,
        questionDefs,
        points,
        subAreaMappingConfirmedAt: undefined,
      };
    });
  };

  const confirmSubAreaMapping = () => {
    setProject((prev) => {
      const questionDefs = ensureQuestionDefs(prev);
      const points = prev.points.map((rec) =>
        recomputePointsRecord(rec, questionDefs, prev.subAreas)
      );
      return {
        ...prev,
        questionDefs,
        points,
        subAreaMappingConfirmedAt: new Date().toISOString(),
      };
    });
  };

  const onCellCommit = (
    matKey: string,
    questionId: string,
    value: number | null
  ) => {
    setProject((prev) => {
      const defs = ensureQuestionDefs(prev);
      const idx = prev.points.findIndex(
        (p) => normalizeMatriculation(p.matriculationNumber) === matKey
      );
      const base: PointsRecord =
        idx >= 0
          ? prev.points[idx]
          : {
              matriculationNumber: matKey,
              bySubArea: Object.fromEntries(
                prev.subAreas.map((s) => [s.id, null])
              ),
              totalPoints: null,
              source: "manual",
              byQuestion: {},
            };

      const byQuestion = {
        ...(base.byQuestion ?? {}),
        [questionId]: value,
      };
      let needsGrading = [...(base.needsGrading ?? [])];
      if (value != null) {
        needsGrading = needsGrading.filter((id) => id !== questionId);
      }

      const next = recomputePointsRecord(
        {
          ...base,
          byQuestion,
          needsGrading,
          source: base.source === "moodle" ? "mixed" : base.source,
        },
        defs,
        prev.subAreas
      );

      const points = [...prev.points];
      if (idx >= 0) points[idx] = next;
      else points.push(next);
      return {
        ...prev,
        questionDefs: prev.questionDefs?.length ? prev.questionDefs : defs,
        points,
      };
    });
  };

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight">
            Detailpunkte (Matrix)
          </h1>
          <p className="text-muted-foreground">
            Einzelpunkte je Aufgabe für alle Studierenden. Gesamtpunkte und
            Teilgebietssummen werden berechnet.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/exam/${id}/import?focus=points`}
            className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}
          >
            <RefreshCw className="size-4" />
            THE neu laden
          </Link>
          <Button
            type="button"
            variant={unlocked ? "default" : "outline"}
            onClick={() => setUnlocked((u) => !u)}
            disabled={taskCount === 0}
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
        </div>
      </div>

      {hasPointsButNoTasks && (
        <div className="rounded-xl border border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-600 dark:bg-amber-950/50 dark:text-amber-50">
          <p className="font-medium">Keine Aufgaben-Spalten gefunden</p>
          <p className="mt-1">
            Die importierten Punkte enthalten keine Einzelaufgaben (F&nbsp;1,
            F&nbsp;2, …). Bitte die Moodle-THE-Datei erneut unter{" "}
            <Link
              href={`/exam/${id}/import?focus=points`}
              className="font-semibold underline"
            >
              Importe
            </Link>{" "}
            laden (Spalten wie „F 1 /10,00“). Nur Gesamtpunkte reichen für die
            Matrix nicht.
          </p>
        </div>
      )}

      <PageSectionNav
        sections={[
          ...(showSubareaMapping
            ? [{ id: "teilgebiete", label: "Teilgebiete" }]
            : []),
          { id: "punktematrix", label: "Punktematrix" },
          ...(taskCount > 0
            ? [{ id: "aufgaben-auswertung", label: "Aufgaben-Auswertung" }]
            : []),
          ...(isOnlineStyleExam(project.examType)
            ? [{ id: "dauer-analyse", label: "Bearbeitungsdauer" }]
            : []),
        ]}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Suche Name / Matr.…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-xs"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4"
            checked={onlyOpen}
            onChange={(e) => setOnlyOpen(e.target.checked)}
          />
          nur offene Bewertungen
        </label>
        <Badge variant="secondary">{taskCount} Aufgaben</Badge>
        {unlocked && (
          <Badge className="bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100">
            Edit-Modus – Zellen nach Eingabe mit Tab verlassen
          </Badge>
        )}
      </div>

      {showSubareaMapping && (
        <Accordion
          id="teilgebiete"
          className={cn(
            "surface-panel rounded-xl border px-3",
            SECTION_SCROLL_MT,
            subMapComplete
              ? "border-emerald-400/80 ring-1 ring-emerald-400/30 dark:border-emerald-700"
              : "border-amber-500 ring-2 ring-amber-400/40 dark:border-amber-600"
          )}
          value={subMapOpen}
          onValueChange={(v) =>
            setSubMapOpen(Array.isArray(v) ? (v as string[]) : [])
          }
        >
          <AccordionItem value="subareas" className="border-0">
            <AccordionTrigger className="py-3 hover:no-underline">
              <span className="flex flex-wrap items-center gap-2 pr-2 text-left">
                <span className="font-semibold">Zuordnung Teilgebiete</span>
                <Badge variant="outline" className="font-normal">
                  {taskCount} Aufg. · {effectiveProject.subAreas.length} Gebiete
                </Badge>
                {subMapComplete ? (
                  <Badge className="border-transparent bg-emerald-600/15 text-emerald-900 dark:text-emerald-100">
                    <CheckCircle2 className="mr-1 size-3.5" />
                    Bestätigt
                  </Badge>
                ) : (
                  <Badge className="border-transparent bg-amber-600/20 text-amber-950 dark:text-amber-50">
                    Erforderlich
                  </Badge>
                )}
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-3">
              <p className="mb-3 text-sm text-muted-foreground">
                Pflicht bei mehreren Teilgebieten – steuert Σ-Spalten und
                Auswertungen. Bitte zuordnen und bestätigen.
              </p>
              <QuestionSubareaMapper
                project={effectiveProject}
                questionDefs={ensureQuestionDefs(effectiveProject)}
                subAreas={effectiveProject.subAreas}
                onChangeMany={updateQuestionSubAreas}
                onConfirm={confirmSubAreaMapping}
              />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      <Card
        id="punktematrix"
        className={cn("surface-panel overflow-hidden", SECTION_SCROLL_MT)}
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Punktematrix</CardTitle>
          <CardDescription>
            ! = Bewertung notwendig · Gesamt und Σ Teilgebiet nur lesend
            {isOnlineStyleExam(project.examType)
              ? " · Spalte Dauer aus Moodle-Import"
              : ""}{" "}
            · horizontal und vertikal im Rahmen scrollen
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 sm:p-0">
          <div className="px-0 sm:px-0">
            <PointsMatrix
              project={effectiveProject}
              unlocked={unlocked}
              search={search}
              onlyOpen={onlyOpen}
              onCellCommit={onCellCommit}
              questionStatsPercent={pctMap}
              recomputeKey={project.updatedAt}
            />
          </div>
        </CardContent>
      </Card>

      {taskCount > 0 && (
        <div id="aufgaben-auswertung" className={SECTION_SCROLL_MT}>
          <QuestionStatsPanel
            questionStats={questionStats}
            subAreaStats={subAreaStats}
          />
        </div>
      )}

      {isOnlineStyleExam(project.examType) && (
        <div
          id="dauer-analyse"
          className={cn(
            "grid grid-cols-1 items-start gap-4 xl:grid-cols-5",
            SECTION_SCROLL_MT
          )}
        >
          <div className="min-w-0 xl:col-span-2">
            <DurationHistogramCard project={effectiveProject} />
          </div>
          <div className="min-w-0 xl:col-span-3">
            <DurationPointsScatterCard project={effectiveProject} />
          </div>
        </div>
      )}
    </div>
  );
}
