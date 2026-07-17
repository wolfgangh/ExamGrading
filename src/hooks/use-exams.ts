"use client";

import { useCallback, useEffect, useState } from "react";
import type { ExamProject } from "@/lib/types";
import { deleteExam, listExams, saveExam } from "@/lib/storage";
import { duplicateExamProject } from "@/lib/project-factory";

export function useExams() {
  const [exams, setExams] = useState<ExamProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listExams();
      setExams(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Laden fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const remove = useCallback(
    async (id: string) => {
      await deleteExam(id);
      await refresh();
    },
    [refresh]
  );

  const duplicate = useCallback(
    async (source: ExamProject, clearData = false) => {
      const copy = duplicateExamProject(source, { clearData });
      await saveExam(copy);
      await refresh();
      return copy;
    },
    [refresh]
  );

  return { exams, loading, error, refresh, remove, duplicate };
}
