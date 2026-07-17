"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ExamProject } from "@/lib/types";
import { getDraft, getExam, saveExam } from "@/lib/storage";
import { useAutoSave } from "@/hooks/use-auto-save";
import { buildEnrichedRows } from "@/lib/matching/match";
import { computeStatistics } from "@/lib/grades/statistics";

export function useExam(id: string) {
  const [project, setProject] = useState<ExamProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const draft = await getDraft(id);
      const stored = await getExam(id);
      const chosen =
        draft && stored
          ? new Date(draft.updatedAt) > new Date(stored.updatedAt)
            ? draft
            : stored
          : draft ?? stored;
      if (!chosen) {
        setError("Prüfung nicht gefunden");
        setProject(null);
      } else {
        setProject(chosen);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Laden fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateProject = useCallback(
    (updater: ExamProject | ((prev: ExamProject) => ExamProject)) => {
      setProject((prev) => {
        if (!prev) return prev;
        return typeof updater === "function" ? updater(prev) : updater;
      });
    },
    []
  );

  const { status: saveStatus, lastSavedAt, saveNow } = useAutoSave(project);

  const persist = useCallback(async () => {
    if (!project) return;
    await saveExam(project);
    await saveNow();
  }, [project, saveNow]);

  const rows = useMemo(
    () => (project ? buildEnrichedRows(project) : []),
    [project]
  );

  const stats = useMemo(
    () =>
      project
        ? computeStatistics(rows, project.gradeSchema, 1, project)
        : null,
    [project, rows]
  );

  return {
    project,
    setProject: updateProject,
    loading,
    error,
    reload: load,
    saveStatus,
    lastSavedAt,
    saveNow: persist,
    rows,
    stats,
  };
}
