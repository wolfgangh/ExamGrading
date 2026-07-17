"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import { useExam } from "@/hooks/use-exam";

type ExamContextValue = ReturnType<typeof useExam>;

const ExamContext = createContext<ExamContextValue | null>(null);

export function ExamProvider({
  examId,
  children,
}: {
  examId: string;
  children: ReactNode;
}) {
  const value = useExam(examId);
  return (
    <ExamContext.Provider value={value}>{children}</ExamContext.Provider>
  );
}

export function useExamContext(): ExamContextValue {
  const ctx = useContext(ExamContext);
  if (!ctx) {
    throw new Error("useExamContext muss innerhalb von ExamProvider liegen.");
  }
  return ctx;
}
