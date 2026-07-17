"use client";

import { useEffect, useRef, useState } from "react";
import type { ExamProject } from "@/lib/types";
import { saveDraft, saveExam } from "@/lib/storage";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function useAutoSave(
  project: ExamProject | null,
  options?: {
    debounceMs?: number;
    persist?: boolean;
    intervalMs?: number;
  }
) {
  const debounceMs = options?.debounceMs ?? 800;
  const persist = options?.persist ?? true;
  const intervalMs = options?.intervalMs ?? 30_000;
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const first = useRef(true);
  const projectRef = useRef(project);
  const dirtyRef = useRef(false);

  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  const persistNow = async (ev: ExamProject) => {
    setStatus("saving");
    try {
      await saveDraft(ev);
      if (persist) {
        await saveExam(ev);
      }
      setStatus("saved");
      setLastSavedAt(new Date());
      dirtyRef.current = false;
    } catch {
      setStatus("error");
    }
  };

  useEffect(() => {
    if (!project) return;
    if (first.current) {
      first.current = false;
      return;
    }

    dirtyRef.current = true;
    if (timer.current) clearTimeout(timer.current);
    setStatus("saving");

    timer.current = setTimeout(() => {
      void persistNow(project);
    }, debounceMs);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, debounceMs, persist]);

  useEffect(() => {
    if (!project || !intervalMs || intervalMs <= 0) return;

    const id = setInterval(() => {
      const ev = projectRef.current;
      if (!ev || !dirtyRef.current) return;
      void persistNow(ev);
    }, intervalMs);

    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, intervalMs, persist]);

  const saveNow = async () => {
    if (!project) return;
    await persistNow(project);
  };

  return { status, lastSavedAt, saveNow };
}
