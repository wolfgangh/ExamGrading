"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ExamProject } from "@/lib/types";
import { getDraft, getExam, saveExam } from "@/lib/storage";
import { pickNewerProject } from "@/lib/project-load";
import { useAutoSave } from "@/hooks/use-auto-save";
import { buildEnrichedRows } from "@/lib/matching/match";
import { computeStatistics } from "@/lib/grades/statistics";
import { subscribeExamSync } from "@/lib/exam-sync";

export function useExam(id: string) {
  const [project, setProject] = useState<ExamProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadSeq = useRef(0);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const seq = ++loadSeq.current;
    if (!opts?.silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const draft = await getDraft(id);
      const stored = await getExam(id);
      if (seq !== loadSeq.current) return;
      const chosen = pickNewerProject(draft, stored);
      if (!chosen) {
        setError("Prüfung nicht gefunden");
        setProject(null);
      } else {
        setProject(chosen);
      }
    } catch (e) {
      if (seq !== loadSeq.current) return;
      setError(e instanceof Error ? e.message : "Laden fehlgeschlagen");
    } finally {
      if (seq === loadSeq.current && !opts?.silent) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return subscribeExamSync((msg) => {
      if (msg.examId !== id) return;
      if (msg.type === "deleted") {
        setError("Prüfung wurde in einem anderen Tab gelöscht");
        setProject(null);
        return;
      }
      if (msg.type === "saved") {
        void load({ silent: true });
      }
    });
  }, [id, load]);

  const updateProject = useCallback(
    (updater: ExamProject | ((prev: ExamProject) => ExamProject)) => {
      setProject((prev) => {
        if (!prev) return prev;
        const next =
          typeof updater === "function" ? updater(prev) : updater;
        if (!next) return prev;
        // Explizites updatedAt (z. B. markProjectBackedUp) beibehalten
        if (next.updatedAt !== prev.updatedAt) {
          return next;
        }
        // Inhaltliche Änderung → Zeitstempel anheben (Backup wird stale)
        return {
          ...next,
          updatedAt: new Date().toISOString(),
        };
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
        ? computeStatistics(rows, project.gradeSchema, undefined, project)
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
