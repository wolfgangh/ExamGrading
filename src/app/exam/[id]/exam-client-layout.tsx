"use client";

import { AppHeader } from "@/components/layout/app-header";
import { ExamSidebar } from "@/components/layout/exam-sidebar";
import { SummaryPanel } from "@/components/layout/summary-panel";
import { ExamProvider, useExamContext } from "@/components/exam/exam-context";
import { BackupBanner } from "@/components/exam/backup-banner";
import { Badge } from "@/components/ui/badge";
import { isBackupStale } from "@/lib/backup-status";

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

  const backupNeeded = isBackupStale(project);

  return (
    <div className="page-shell flex min-h-0 flex-1 flex-col overflow-hidden">
      <AppHeader
        subtitle={project.name}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {backupNeeded && (
              <Badge
                variant="outline"
                className="border-amber-500 bg-amber-100 font-medium text-amber-950 dark:bg-amber-950 dark:text-amber-100"
              >
                Sicherung ausstehend
              </Badge>
            )}
            <Badge
              variant="outline"
              className="font-normal"
              title="Automatisches Speichern im Browser (IndexedDB) – nicht dasselbe wie JSON-Sicherung"
            >
              {saveLabel}
            </Badge>
          </div>
        }
      />
      <BackupBanner />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <ExamSidebar examId={examId} examType={project.examType} />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="shrink-0 border-b bg-card/50 px-4 py-2">
            <SummaryPanel stats={stats} compact />
          </div>
          <main className="min-h-0 flex-1 overflow-auto p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

/** Client-Shell für /exam/[id] – examId kommt vom Server-Layout */
export function ExamClientLayout({
  examId,
  children,
}: {
  examId: string;
  children: React.ReactNode;
}) {
  return (
    <ExamProvider examId={examId}>
      <ExamShell examId={examId}>{children}</ExamShell>
    </ExamProvider>
  );
}
