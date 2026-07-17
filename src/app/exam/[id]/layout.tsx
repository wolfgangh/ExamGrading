"use client";

import { use } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { ExamSidebar } from "@/components/layout/exam-sidebar";
import { SummaryPanel } from "@/components/layout/summary-panel";
import { ExamProvider, useExamContext } from "@/components/exam/exam-context";
import { Badge } from "@/components/ui/badge";

function ExamShell({
  examId,
  children,
}: {
  examId: string;
  children: React.ReactNode;
}) {
  const { project, loading, error, saveStatus, lastSavedAt, stats } =
    useExamContext();

  if (loading) {
    return (
      <div className="page-shell flex items-center justify-center p-12 text-muted-foreground">
        Prüfung wird geladen…
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="page-shell flex items-center justify-center p-12 text-destructive">
        {error ?? "Prüfung nicht gefunden"}
      </div>
    );
  }

  const saveLabel =
    saveStatus === "saving"
      ? "Speichert…"
      : saveStatus === "saved"
        ? lastSavedAt
          ? `Gespeichert ${lastSavedAt.toLocaleTimeString("de-DE", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}`
          : "Gespeichert"
        : saveStatus === "error"
          ? "Speicherfehler"
          : "Auto-Save aktiv";

  return (
    <div className="page-shell flex min-h-screen flex-col">
      <AppHeader
        subtitle={project.name}
        actions={
          <Badge
            variant="outline"
            className="font-normal"
            title="Automatisches Speichern im Browser (IndexedDB)"
          >
            {saveLabel}
          </Badge>
        }
      />
      <div className="flex min-h-0 flex-1">
        <ExamSidebar examId={examId} />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="border-b bg-card/50 px-4 py-2">
            <SummaryPanel stats={stats} compact />
          </div>
          <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}

export default function ExamLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <ExamProvider examId={id}>
      <ExamShell examId={id}>{children}</ExamShell>
    </ExamProvider>
  );
}
