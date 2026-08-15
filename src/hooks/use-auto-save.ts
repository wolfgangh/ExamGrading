"use client";

import { useEffect, useRef, useState } from "react";
import type { ExamProject } from "@/lib/types";
import { saveDraft, saveExam } from "@/lib/storage";
import { broadcastExamSync } from "@/lib/exam-sync";

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
  /** Periodisches Speichern alle 15 s, solange ungesicherte Änderungen */
  const intervalMs = options?.intervalMs ?? 15_000;
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const first = useRef(true);
  const projectRef = useRef(project);
  const dirtyRef = useRef(false);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const queuedRef = useRef(false);
  const persistFlag = useRef(persist);
  persistFlag.current = persist;

  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  useEffect(() => {
    first.current = true;
    dirtyRef.current = false;
  }, [project?.id]);

  const persistNow = async () => {
    const ev = projectRef.current;
    if (!ev) return;
    const writtenAt = ev.updatedAt;
    setStatus("saving");
    try {
      await saveDraft(ev);
      if (persistFlag.current) {
        await saveExam(ev);
      }
      broadcastExamSync({
        type: "saved",
        examId: ev.id,
        updatedAt: ev.updatedAt,
      });
      if (projectRef.current?.updatedAt === writtenAt) {
        dirtyRef.current = false;
      }
      setStatus("saved");
      setLastSavedAt(new Date());
    } catch {
      setStatus("error");
    }
  };

  const enqueuePersist = () => {
    if (inFlightRef.current) {
      queuedRef.current = true;
      return;
    }
    inFlightRef.current = persistNow().finally(() => {
      inFlightRef.current = null;
      if (queuedRef.current) {
        queuedRef.current = false;
        enqueuePersist();
      }
    });
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
      timer.current = null;
      enqueuePersist();
    }, debounceMs);

    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
        if (dirtyRef.current) enqueuePersist();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, debounceMs, persist]);

  useEffect(() => {
    if (!project || !intervalMs || intervalMs <= 0) return;

    const id = setInterval(() => {
      if (!projectRef.current || !dirtyRef.current) return;
      enqueuePersist();
    }, intervalMs);

    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, intervalMs, persist]);

  useEffect(() => {
    const flush = () => {
      if (!dirtyRef.current || !projectRef.current) return;
      enqueuePersist();
    };
    window.addEventListener("pagehide", flush);
    const onVis = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVis);
      flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  const saveNow = async () => {
    if (!projectRef.current) return;
    dirtyRef.current = true;
    enqueuePersist();
    if (inFlightRef.current) await inFlightRef.current;
  };

  return { status, lastSavedAt, saveNow };
}
