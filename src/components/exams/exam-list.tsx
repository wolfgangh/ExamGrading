"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Copy,
  FileJson,
  HardDrive,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { useExams } from "@/hooks/use-exams";
import { NewExamDialog } from "@/components/exams/new-exam-dialog";
import { AppHeader } from "@/components/layout/app-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EXAM_TYPE_LABELS, type ExamProject } from "@/lib/types";
import { downloadJson } from "@/lib/utils";
import {
  exportExamJson,
  parseExamJson,
  saveExam,
} from "@/lib/storage";
import {
  projectArchiveFilename,
  projectArchiveSummary,
} from "@/lib/project-archive";
import {
  isBackupStale,
  markProjectBackedUp,
  markProjectRestoredFromBackup,
} from "@/lib/backup-status";
import { createId } from "@/lib/id";

export function ExamList() {
  const { exams, loading, error, refresh, remove, duplicate } = useExams();
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [importErr, setImportErr] = useState<string | null>(null);

  const importJson = async (file: File) => {
    setImportMsg(null);
    setImportErr(null);
    try {
      const text = await file.text();
      let project = parseExamJson(text);
      project.id = createId("exam");
      project.createdAt = new Date().toISOString();
      project = markProjectRestoredFromBackup(project);
      await saveExam(project);
      await refresh();
      setImportMsg(
        `Sicherung importiert: ${projectArchiveSummary(project)}. Daten liegen wieder nur in diesem Browser – bei Änderungen erneut sichern. Original-Excel-Pfade werden nicht benötigt (Daten stecken in der JSON-Datei).`
      );
      router.push(`/exam/${project.id}/overview`);
    } catch (e) {
      setImportErr(
        e instanceof Error
          ? e.message
          : "Sicherung konnte nicht importiert werden."
      );
    }
  };

  const exportBackup = async (exam: ExamProject) => {
    downloadJson(projectArchiveFilename(exam), exportExamJson(exam));
    await saveExam(markProjectBackedUp(exam));
    await refresh();
  };

  return (
    <div className="page-shell">
      <AppHeader
        actions={
          <>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importJson(f);
                e.target.value = "";
              }}
            />
            <Button
              variant="outline"
              onClick={() => fileRef.current?.click()}
              title="Vollständige Projektsicherung (.json) wiederherstellen"
            >
              <HardDrive className="size-4" />
              Sicherung importieren
            </Button>
            <NewExamDialog onCreated={() => void refresh()} />
          </>
        }
      />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 space-y-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Prüfungen
            </h1>
            <p className="mt-1 text-muted-foreground">
              Notenvergabe und HIS/QIS-Export – ersetzt den Excel-Workflow.
            </p>
          </div>

          <div className="rounded-xl border border-amber-300/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-50">
            <p className="font-medium">Daten nur in diesem Browser</p>
            <p className="mt-1 opacity-90">
              Prüfungsprojekte werden lokal gespeichert (IndexedDB), nicht auf
              dem Server. Nach Importen und vor dem HIS-/PDF-Export:{" "}
              <strong>JSON-Sicherung</strong> herunterladen und neben den
              Klausurdateien ablegen. Wechsel des PCs nur über
              Sicherungs-Import.
            </p>
          </div>

          {importMsg && (
            <p className="text-sm text-emerald-700 dark:text-emerald-300">
              {importMsg}
            </p>
          )}
          {importErr && (
            <p className="text-sm text-destructive">{importErr}</p>
          )}
        </div>

        {loading && (
          <p className="text-muted-foreground">Lade Prüfungen…</p>
        )}
        {error && <p className="text-destructive">{error}</p>}

        {!loading && exams.length === 0 && (
          <Card className="surface-panel border-dashed">
            <CardHeader>
              <CardTitle>Noch keine Prüfung</CardTitle>
              <CardDescription>
                Legen Sie eine neue Prüfung an oder importieren Sie eine
                Projektsicherung (.json).
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <NewExamDialog onCreated={() => void refresh()} />
              <Button
                variant="outline"
                onClick={() => fileRef.current?.click()}
              >
                <HardDrive className="size-4" />
                Sicherung importieren
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {exams.map((exam) => {
            const stale = isBackupStale(exam);
            return (
              <Card
                key={exam.id}
                className="surface-panel transition-shadow hover:shadow-md"
              >
                <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
                  <div className="min-w-0">
                    <CardTitle className="truncate text-lg">
                      <Link
                        href={`/exam/${exam.id}/overview`}
                        className="hover:underline"
                      >
                        {exam.name}
                      </Link>
                    </CardTitle>
                    <CardDescription className="mt-1 space-y-0.5">
                      <span className="block">
                        {exam.examNumber || "ohne Nummer"}
                        {exam.semester ? ` · ${exam.semester}` : ""}
                      </span>
                      <span className="block">
                        {EXAM_TYPE_LABELS[exam.examType]} ·{" "}
                        {exam.hisRows.length} HIS · {exam.attendance.length}{" "}
                        Antritte · {exam.points.length} Punkte
                      </span>
                      {stale && (
                        <span className="mt-1 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-950 dark:bg-amber-900 dark:text-amber-50">
                          Sicherung ausstehend
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button variant="ghost" size="icon-sm">
                          <MoreHorizontal />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => void exportBackup(exam)}
                      >
                        <FileJson className="size-4" />
                        Sicherung exportieren
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => void duplicate(exam, false)}
                      >
                        <Copy className="size-4" />
                        Duplizieren
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => void duplicate(exam, true)}
                      >
                        <Copy className="size-4" />
                        Für Folgesemester (ohne Daten)
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => {
                          if (
                            confirm(
                              `Prüfung „${exam.name}“ wirklich löschen?`
                            )
                          ) {
                            void remove(exam.id);
                          }
                        }}
                      >
                        <Trash2 className="size-4" />
                        Löschen
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Geändert{" "}
                      {new Date(exam.updatedAt).toLocaleString("de-DE")}
                    </span>
                    <Link
                      href={`/exam/${exam.id}/overview`}
                      className="inline-flex h-7 items-center rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted"
                    >
                      Öffnen
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}
