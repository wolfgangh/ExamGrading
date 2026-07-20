"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
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
import { Badge } from "@/components/ui/badge";
import {
  EXAM_TYPE_LABELS,
  isHisManualAssessmentExam,
  type ExamProject,
} from "@/lib/types";
import { downloadBlob, downloadJson } from "@/lib/download";
import {
  exportExamJson,
  parseExamJson,
  saveExam,
} from "@/lib/storage";
import {
  buildProjectArchive,
  projectArchiveFilename,
  projectArchiveSummary,
} from "@/lib/project-archive";
import {
  isBackupStale,
  markProjectBackedUp,
  markProjectRestoredFromBackup,
} from "@/lib/backup-status";
import {
  assertFileSizeLimit,
  MAX_PROJECT_ARCHIVE_BYTES,
} from "@/lib/import-limits";
import { createId } from "@/lib/id";
import {
  currentSemesterLabel,
  semesterSlug,
} from "@/lib/semester";
import { datedExportFilename, cn } from "@/lib/utils";
import { getExamWorkflowSummary } from "@/lib/workflow-steps";
import { buildEnrichedRows } from "@/lib/matching/match";

/**
 * Meta-Zeile auf Prüfungskarten.
 * StA/Portfolio: Prüflinge (HIS + manuell); ohne Note nicht mitzählen, sobald Noten existieren.
 */
function examListCountsLabel(exam: ExamProject): string {
  const his = exam.hisRows?.length ?? 0;
  if (isHisManualAssessmentExam(exam.examType)) {
    const rows = buildEnrichedRows(exam);
    const withGrade = rows.filter((r) => r.finalGrade != null).length;
    const n = withGrade > 0 ? withGrade : rows.length;
    return `${his} HIS · ${n} Prüflinge`;
  }
  return `${his} HIS · ${exam.attendance?.length ?? 0} Antritte · ${exam.points?.length ?? 0} Punkte`;
}

export function ExamList() {
  const { exams, loading, error, refresh, remove, duplicate } = useExams();
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [importErr, setImportErr] = useState<string | null>(null);
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  const semesterNow = currentSemesterLabel();
  const semesterExams = exams.filter(
    (e) => (e.semester || "").trim() === semesterNow
  );

  const importJsonFiles = async (files: FileList | File[]) => {
    setImportMsg(null);
    setImportErr(null);
    setExportMsg(null);
    const list = Array.from(files);
    if (list.length === 0) return;

    const ok: string[] = [];
    const fail: string[] = [];
    let lastId: string | null = null;

    for (const file of list) {
      try {
        assertFileSizeLimit(file, MAX_PROJECT_ARCHIVE_BYTES, "JSON-Sicherung");
        const text = await file.text();
        let project = parseExamJson(text);
        project.id = createId("exam");
        project.createdAt = new Date().toISOString();
        project = markProjectRestoredFromBackup(project);
        await saveExam(project);
        ok.push(projectArchiveSummary(project));
        lastId = project.id;
      } catch (e) {
        fail.push(
          `${file.name}: ${
            e instanceof Error ? e.message : "Import fehlgeschlagen"
          }`
        );
      }
    }

    await refresh();

    if (ok.length > 0) {
      setImportMsg(
        ok.length === 1
          ? `Sicherung importiert: ${ok[0]}. Daten liegen wieder nur in diesem Browser.`
          : `${ok.length} Sicherungen importiert: ${ok.join(" · ")}`
      );
    }
    if (fail.length > 0) {
      setImportErr(fail.join(" | "));
    }
    // Nur bei genau einer erfolgreichen Datei zur Prüfung springen
    if (ok.length === 1 && fail.length === 0 && lastId) {
      router.push(`/exam/${lastId}/overview`);
    }
  };

  const exportBackup = async (exam: ExamProject) => {
    void downloadJson(projectArchiveFilename(exam), exportExamJson(exam));
    await saveExam(markProjectBackedUp(exam));
    await refresh();
  };

  const exportSemesterZip = async () => {
    setExportMsg(null);
    setImportErr(null);
    if (semesterExams.length === 0) {
      setExportMsg(
        `Keine Prüfung mit Semester „${semesterNow}“. Bitte Semester in den Prüfungseinstellungen setzen.`
      );
      return;
    }
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      for (const exam of semesterExams) {
        const name = projectArchiveFilename(exam, "general");
        zip.file(name, buildProjectArchive(exam));
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const zipName = datedExportFilename(
        `ExamGrade_${semesterSlug(semesterNow)}_Semester`,
        "zip"
      );
      await downloadBlob(zipName, blob);

      for (const exam of semesterExams) {
        await saveExam(markProjectBackedUp(exam));
      }
      await refresh();
      setExportMsg(
        `${semesterExams.length} Prüfung(en) „${semesterNow}“ als ZIP heruntergeladen und als gesichert markiert.`
      );
    } catch (e) {
      setImportErr(
        e instanceof Error
          ? e.message
          : "Semester-Export fehlgeschlagen."
      );
    }
  };

  return (
    <div className="page-shell flex min-h-0 flex-1 flex-col overflow-hidden">
      <AppHeader
        actions={
          <>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = e.target.files;
                if (files?.length) void importJsonFiles(files);
                e.target.value = "";
              }}
            />
            <Button
              variant="outline"
              onClick={() => fileRef.current?.click()}
              title="Eine oder mehrere Projektsicherungen (.json) wiederherstellen"
            >
              <HardDrive className="size-4" />
              Sicherung importieren
            </Button>
            <Button
              variant="outline"
              onClick={() => void exportSemesterZip()}
              title={`Alle Prüfungen des Semesters „${semesterNow}“ als ZIP`}
              disabled={loading}
            >
              <Archive className="size-4" />
              Semester sichern
            </Button>
            <NewExamDialog onCreated={() => void refresh()} />
          </>
        }
      />

      <main className="mx-auto min-h-0 w-full max-w-6xl flex-1 overflow-auto px-4 py-8">
        <div className="mb-6 space-y-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Prüfungen
            </h1>
            <p className="mt-1 text-muted-foreground">
              Notenvergabe und HISinOne-Export – ersetzt den Excel-Workflow.
              Aktuelles Semester: <strong>{semesterNow}</strong>
              {semesterExams.length > 0 && (
                <> · {semesterExams.length} Prüfung(en) in diesem Semester</>
              )}
            </p>
          </div>

          <div className="rounded-xl border border-amber-300/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-50">
            <p className="font-medium">Daten nur in diesem Browser</p>
            <p className="mt-1 opacity-90">
              Prüfungsprojekte werden lokal gespeichert (IndexedDB), nicht auf
              dem Server. Nach Importen und vor dem HISinOne-/PDF-Export:{" "}
              <strong>JSON-Sicherung</strong> herunterladen. Mehrere Dateien
              können auf einmal importiert werden. „Semester sichern“ packt
              alle Prüfungen mit Semester „{semesterNow}“ in eine ZIP-Datei.
            </p>
          </div>

          {importMsg && (
            <p className="text-sm text-emerald-700 dark:text-emerald-300">
              {importMsg}
            </p>
          )}
          {exportMsg && (
            <p className="text-sm text-emerald-700 dark:text-emerald-300">
              {exportMsg}
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
                Legen Sie eine neue Prüfung an oder importieren Sie eine oder
                mehrere Projektsicherungen (.json).
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
            const semester = (exam.semester || "").trim();
            const isCurrentSemester = semester === semesterNow;
            const workflow = getExamWorkflowSummary(exam);
            const statusHref = workflow.nextOpen?.href
              ? workflow.nextOpen.href
              : `/exam/${exam.id}/overview`;

            return (
              <Card
                key={exam.id}
                className="surface-panel transition-shadow hover:shadow-md"
              >
                <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="truncate text-lg">
                      <Link
                        href={`/exam/${exam.id}/overview`}
                        className="hover:underline"
                      >
                        {exam.name}
                      </Link>
                    </CardTitle>

                    {/* Semester · Prüfungsform · Workflow-Status */}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge
                        variant={isCurrentSemester ? "default" : "secondary"}
                        className={cn(
                          "h-6 px-2.5 text-[0.7rem] font-semibold tracking-wide",
                          !semester && "opacity-70"
                        )}
                        title="Semester"
                      >
                        {semester || "ohne Semester"}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="h-6 max-w-full px-2.5 text-[0.7rem] font-semibold"
                        title="Prüfungsform"
                      >
                        {EXAM_TYPE_LABELS[exam.examType]}
                      </Badge>
                      <Link
                        href={statusHref}
                        className="inline-flex max-w-full hover:opacity-90"
                        title={
                          workflow.complete
                            ? "Workflow abgeschlossen"
                            : "Nächster Workflow-Schritt"
                        }
                      >
                        <Badge
                          variant={workflow.complete ? "outline" : "default"}
                          className={cn(
                            "h-6 max-w-full px-2.5 text-[0.7rem] font-semibold",
                            workflow.complete
                              ? "border-emerald-600/40 bg-emerald-50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-950/50 dark:text-emerald-100"
                              : workflow.nextOpen?.critical
                                ? "bg-amber-600 text-white hover:bg-amber-600/90 dark:bg-amber-700"
                                : undefined
                          )}
                        >
                          {workflow.complete
                            ? workflow.statusLabel
                            : `Nächster: ${workflow.nextOpen?.label ?? "—"} · ${workflow.doneCount}/${workflow.totalCount}`}
                        </Badge>
                      </Link>
                    </div>

                    <CardDescription className="mt-2 space-y-0.5">
                      <span className="block">
                        {exam.examNumber || "ohne Nummer"}
                        {" · "}
                        {examListCountsLabel(exam)}
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
                <CardContent className="space-y-2">
                  {/* Fortschrittsbalken Workflow */}
                  <div
                    className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                    title={`Workflow ${workflow.doneCount}/${workflow.totalCount}`}
                  >
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        workflow.complete ? "bg-emerald-600" : "bg-primary"
                      )}
                      style={{ width: `${workflow.progressPct}%` }}
                    />
                  </div>
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
