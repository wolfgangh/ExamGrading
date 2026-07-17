"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useExamContext } from "@/components/exam/exam-context";
import { PointsMatrix } from "@/components/points/points-matrix";
import { QuestionSubareaMapper } from "@/components/points/question-subarea-mapper";
import { QuestionStatsPanel } from "@/components/points/question-stats-panel";
import {
  computeQuestionStats,
  computeSubAreaStats,
} from "@/lib/grades/question-stats";
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
import { cn } from "@/lib/utils";
import { Lock, LockOpen, RefreshCw } from "lucide-react";
import type { PointsRecord } from "@/lib/types";

export default function DetailPointsPage() {
  const { id } = useParams<{ id: string }>();
  const { project, setProject } = useExamContext();
  const [unlocked, setUnlocked] = useState(false);
  const [search, setSearch] = useState("");
  const [onlyOpen, setOnlyOpen] = useState(false);

  const questionStats = useMemo(
    () => (project ? computeQuestionStats(project) : []),
    [project]
  );
  const subAreaStats = useMemo(
    () => (project ? computeSubAreaStats(project) : []),
    [project]
  );
  const pctMap = useMemo(() => {
    const m: Record<string, number | null> = {};
    for (const q of questionStats) m[q.questionId] = q.averagePercent;
    return m;
  }, [questionStats]);

  if (!project) return null;

  const updateQuestionSubArea = (questionId: string, subAreaId: string) => {
    setProject((prev) => {
      const questionDefs = (prev.questionDefs ?? []).map((q) =>
        q.id === questionId ? { ...q, subAreaId } : q
      );
      const points = prev.points.map((rec) =>
        recomputePointsRecord(rec, questionDefs, prev.subAreas)
      );
      return { ...prev, questionDefs, points };
    });
  };

  const onCellCommit = (
    matKey: string,
    questionId: string,
    value: number | null
  ) => {
    setProject((prev) => {
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
      } else if (!needsGrading.includes(questionId)) {
        // optional: leave needs flag if was open
      }

      const next = recomputePointsRecord(
        {
          ...base,
          byQuestion,
          needsGrading,
          source: base.source === "moodle" ? "mixed" : base.source,
        },
        prev.questionDefs ?? [],
        prev.subAreas
      );

      const points = [...prev.points];
      if (idx >= 0) points[idx] = next;
      else points.push(next);
      return { ...prev, points };
    });
  };

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
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

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Suche Name / Matr.…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
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
        <Badge variant="secondary">
          {project.questionDefs?.length ?? 0} Aufgaben
        </Badge>
        {unlocked && (
          <Badge className="bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100">
            Edit-Modus – Zellen nach Eingabe mit Tab verlassen
          </Badge>
        )}
      </div>

      {(project.subAreas.length > 1 ||
        (project.questionDefs?.length ?? 0) > 0) && (
        <Card className="surface-panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Zuordnung Teilgebiete</CardTitle>
            <CardDescription>
              Für Auswertungen und Σ-Spalten in der Matrix
            </CardDescription>
          </CardHeader>
          <CardContent>
            <QuestionSubareaMapper
              questionDefs={project.questionDefs ?? []}
              subAreas={project.subAreas}
              onChange={updateQuestionSubArea}
            />
          </CardContent>
        </Card>
      )}

      <Card className="surface-panel">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Punktematrix</CardTitle>
          <CardDescription>
            ! = Bewertung notwendig · Gesamt und Σ Teilgebiet nur lesend
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PointsMatrix
            project={project}
            unlocked={unlocked}
            search={search}
            onlyOpen={onlyOpen}
            onCellCommit={onCellCommit}
            questionStatsPercent={pctMap}
            recomputeKey={project.updatedAt}
          />
        </CardContent>
      </Card>

      <QuestionStatsPanel
        questionStats={questionStats}
        subAreaStats={subAreaStats}
      />
    </div>
  );
}
