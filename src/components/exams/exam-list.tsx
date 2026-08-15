"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  Copy,
  FileJson,
  MoreHorizontal,
  Trash2,
  Upload,
} from "lucide-react";
import { useExams } from "@/hooks/use-exams";
import { NewExamDialog } from "@/components/exams/new-exam-dialog";
import {
  ImportConflictDialog,
  type ImportConflictResolution,
} from "@/components/exams/import-conflict-dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  EXAM_TYPE_LABELS,
  isHisManualAssessmentExam,
  type ExamProject,
} from "@/lib/types";
import { downloadBlob, downloadJson } from "@/lib/download";
import {
  exportExamJson,
  listExams,
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
  assertZipEntryUncompressed,
  assertZipJsonEntries,
  MAX_PROJECT_ARCHIVE_BYTES,
  MAX_SEMESTER_ZIP_BYTES,
} from "@/lib/import-limits";
import {
  clearImportedCopyMeta,
  findExistingExamMatches,
  formatImportDateTime,
  labelImportedCopy,
} from "@/lib/project-import-conflict";
import { createId } from "@/lib/id";
import {
  currentSemesterLabel,
  semesterSlug,
} from "@/lib/semester";
import { datedExportFilename, cn } from "@/lib/utils";
import { getExamWorkflowSummary } from "@/lib/workflow-steps";
import { buildEnrichedRows } from "@/lib/matching/match";

type PendingImportConflict = {
  fileLabel: string;
  project: ExamProject;
  matches: ExamProject[];
  byId: boolean;
};

type ImportBatchResults = {
  asCopy: string[];
  replaced: string[];
  plain: string[];
  skipped: string[];
  fail: string[];
  lastId: string | null;
};

/** Personen mit erfassten Punkten (nicht: Länge des points-Arrays). */
function countPeopleWithPoints(exam: ExamProject): number {
  return (exam.points ?? []).filter((p) => {
    if (p.totalPoints != null && Number.isFinite(p.totalPoints)) return true;
    if (p.totalOverride != null && Number.isFinite(p.totalOverride)) return true;
    if (
      p.bySubArea &&
      Object.values(p.bySubArea).some((v) => v != null && Number.isFinite(v))
    ) {
      return true;
    }
    if (
      p.byQuestion &&
      Object.values(p.byQuestion).some((v) => v != null && Number.isFinite(v))
    ) {
      return true;
    }
    return false;
  }).length;
}

/**
 * Meta-Zeile auf Prüfungskarten.
 * StA/Portfolio: Prüflinge; THE/elektrP: Antritte + mit Punkten; Klausur: mit Punkten (kein Antritt).
 */
function examListCountsLabel(exam: ExamProject): string {
  const his = exam.hisRows?.length ?? 0;
  if (isHisManualAssessmentExam(exam.examType)) {
    const rows = buildEnrichedRows(exam);
    const withGrade = rows.filter((r) => r.finalGrade != null).length;
    const n = withGrade > 0 ? withGrade : rows.length;
    return `${his} HIS · ${n} Prüflinge`;
  }
  const withPoints = countPeopleWithPoints(exam);
  if (exam.examType === "written") {
    return `${his} HIS · ${withPoints} mit Punkten`;
  }
  // THE / elektrP / Sonstige
  const att = exam.attendance?.length ?? 0;
  return `${his} HIS · ${att} Antritte · ${withPoints} mit Punkten`;
}

const SEMESTER_FILTER_ALL = "__all__";
const SEMESTER_FILTER_NONE = "__none__";

function emptyImportResults(): ImportBatchResults {
  return {
    asCopy: [],
    replaced: [],
    plain: [],
    skipped: [],
    fail: [],
    lastId: null,
  };
}

export function ExamList() {
  const { exams, loading, error, refresh, remove, duplicate } = useExams();
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [importErr, setImportErr] = useState<string | null>(null);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [conflictQueue, setConflictQueue] = useState<PendingImportConflict[]>(
    []
  );
  const [conflictIndex, setConflictIndex] = useState(0);
  const [importResults, setImportResults] = useState<ImportBatchResults>(
    emptyImportResults
  );
  const workingExamsRef = useRef<ExamProject[]>([]);
  /** Default: aktuelles Semester; „Alle“ / „ohne Semester“ wählbar */
  const [semesterFilter, setSemesterFilter] = useState<string>(() =>
    currentSemesterLabel()
  );

  const semesterNow = currentSemesterLabel();
  const semesterExams = exams.filter(
    (e) => (e.semester || "").trim() === semesterNow
  );

  const semesterOptions = useMemo(() => {
    const set = new Set<string>();
    for (const e of exams) {
      const s = (e.semester || "").trim();
      if (s) set.add(s);
    }
    // Aktuelles Semester immer anbieten
    set.add(semesterNow);
    return [...set].sort((a, b) => a.localeCompare(b, "de"));
  }, [exams, semesterNow]);

  const filteredExams = useMemo(() => {
    if (semesterFilter === SEMESTER_FILTER_ALL) return exams;
    if (semesterFilter === SEMESTER_FILTER_NONE) {
      return exams.filter((e) => !(e.semester || "").trim());
    }
    return exams.filter(
      (e) => (e.semester || "").trim() === semesterFilter
    );
  }, [exams, semesterFilter]);

  const noneSemesterCount = useMemo(
    () => exams.filter((e) => !(e.semester || "").trim()).length,
    [exams]
  );

  const isZipFile = (file: File): boolean => {
    const n = file.name.toLowerCase();
    return (
      n.endsWith(".zip") ||
      file.type === "application/zip" ||
      file.type === "application/x-zip-compressed"
    );
  };

  const saveAsNewCopy = async (
    imported: ExamProject,
    match: ExamProject | null
  ): Promise<{ summary: string; id: string; project: ExamProject }> => {
    let project = { ...imported };
    project.id = createId("exam");
    project.createdAt = new Date().toISOString();
    if (match) {
      project = labelImportedCopy(project, match.name, match.id);
    } else {
      project = clearImportedCopyMeta(project);
    }
    project = markProjectRestoredFromBackup(project);
    await saveExam(project);
    return {
      summary: projectArchiveSummary(project),
      id: project.id,
      project,
    };
  };

  const saveReplacing = async (
    imported: ExamProject,
    match: ExamProject
  ): Promise<{ summary: string; id: string; project: ExamProject }> => {
    let project = clearImportedCopyMeta({ ...imported });
    project.id = match.id;
    project.createdAt = match.createdAt;
    project = markProjectRestoredFromBackup(project);
    await saveExam(project);
    return {
      summary: projectArchiveSummary(project),
      id: project.id,
      project,
    };
  };

  const finishImportBatch = async (results: ImportBatchResults) => {
    setConflictQueue([]);
    setConflictIndex(0);
    setImportBusy(false);
    await refresh();

    const parts: string[] = [];
    if (results.plain.length > 0) {
      parts.push(
        results.plain.length === 1
          ? `importiert: ${results.plain[0]}`
          : `${results.plain.length} neu importiert`
      );
    }
    if (results.asCopy.length > 0) {
      parts.push(
        results.asCopy.length === 1
          ? `als neue Version: ${results.asCopy[0]}`
          : `${results.asCopy.length} als neue Version`
      );
    }
    if (results.replaced.length > 0) {
      parts.push(
        results.replaced.length === 1
          ? `ersetzt: ${results.replaced[0]}`
          : `${results.replaced.length} ersetzt`
      );
    }
    if (results.skipped.length > 0) {
      parts.push(
        results.skipped.length === 1
          ? `übersprungen: ${results.skipped[0]}`
          : `${results.skipped.length} übersprungen`
      );
    }

    const successCount =
      results.plain.length + results.asCopy.length + results.replaced.length;

    if (parts.length > 0) {
      setImportMsg(
        `${parts.join(" · ")}. Daten liegen nur in diesem Browser.`
      );
    } else if (results.fail.length === 0) {
      setImportMsg(null);
    }

    if (results.fail.length > 0) {
      setImportErr(results.fail.join(" | "));
    }

    if (
      successCount === 1 &&
      results.fail.length === 0 &&
      results.skipped.length === 0 &&
      results.lastId
    ) {
      router.push(`/exam/${results.lastId}/overview`);
    }
  };

  const upsertWorkingExam = (project: ExamProject) => {
    const list = workingExamsRef.current;
    const idx = list.findIndex((e) => e.id === project.id);
    if (idx >= 0) list[idx] = project;
    else list.push(project);
  };

  const resolveConflict = async (resolution: ImportConflictResolution) => {
    const current = conflictQueue[conflictIndex];
    if (!current) return;

    const results = { ...importResults };
    results.asCopy = [...results.asCopy];
    results.replaced = [...results.replaced];
    results.skipped = [...results.skipped];
    results.fail = [...results.fail];

    try {
      if (resolution.action === "copy") {
        const match =
          current.matches.find((m) => m.id === resolution.matchId) ??
          current.matches[0];
        if (!match) throw new Error("Keine passende Prüfung für die Kopie.");
        const { summary, id, project } = await saveAsNewCopy(
          current.project,
          match
        );
        results.asCopy.push(summary);
        results.lastId = id;
        upsertWorkingExam(project);
      } else if (resolution.action === "replace") {
        const match =
          current.matches.find((m) => m.id === resolution.matchId) ??
          current.matches[0];
        if (!match) throw new Error("Keine passende Prüfung zum Ersetzen.");
        const { summary, id, project } = await saveReplacing(
          current.project,
          match
        );
        results.replaced.push(summary);
        results.lastId = id;
        upsertWorkingExam(project);
      } else if (resolution.action === "skip") {
        results.skipped.push(current.fileLabel);
      } else if (resolution.action === "abort_remaining") {
        results.skipped.push(current.fileLabel);
        for (let i = conflictIndex + 1; i < conflictQueue.length; i++) {
          results.skipped.push(conflictQueue[i].fileLabel);
        }
        setImportResults(results);
        await finishImportBatch(results);
        return;
      }
    } catch (e) {
      results.fail.push(
        `${current.fileLabel}: ${
          e instanceof Error ? e.message : "Import fehlgeschlagen"
        }`
      );
    }

    const next = conflictIndex + 1;
    if (next >= conflictQueue.length) {
      setImportResults(results);
      await finishImportBatch(results);
      return;
    }
    setImportResults(results);
    setConflictIndex(next);
  };

  /** JSON-Dateien und Semester-ZIPs (analog „Semester sichern“) importieren */
  const importBackupFiles = async (files: FileList | File[]) => {
    if (importBusy || conflictQueue.length > 0) return;
    setImportMsg(null);
    setImportErr(null);
    setExportMsg(null);
    const list = Array.from(files);
    if (list.length === 0) return;

    setImportBusy(true);
    const results = emptyImportResults();
    const conflicts: PendingImportConflict[] = [];

    try {
      workingExamsRef.current = await listExams();

      type ParsedItem = { fileLabel: string; project: ExamProject };
      const parsed: ParsedItem[] = [];

      for (const file of list) {
        try {
          if (isZipFile(file)) {
            assertFileSizeLimit(file, MAX_SEMESTER_ZIP_BYTES, "ZIP-Sicherung");
            const JSZip = (await import("jszip")).default;
            const zip = await JSZip.loadAsync(await file.arrayBuffer());
            const jsonEntries = Object.values(zip.files).filter(
              (e) =>
                !e.dir &&
                e.name.toLowerCase().endsWith(".json") &&
                !e.name.split("/").some((p) => p.startsWith("."))
            );
            if (jsonEntries.length === 0) {
              throw new Error(
                "ZIP enthält keine .json-Projektsicherungen."
              );
            }
            assertZipJsonEntries(jsonEntries, file.name);
            jsonEntries.sort((a, b) => a.name.localeCompare(b.name, "de"));
            for (const entry of jsonEntries) {
              try {
                const label = `${file.name}/${entry.name}`;
                assertZipEntryUncompressed(entry, label);
                const text = await entry.async("string");
                assertFileSizeLimit(
                  {
                    size: new TextEncoder().encode(text).length,
                    name: label,
                  },
                  MAX_PROJECT_ARCHIVE_BYTES,
                  "JSON-Sicherung"
                );
                parsed.push({
                  fileLabel: label,
                  project: parseExamJson(text),
                });
              } catch (e) {
                results.fail.push(
                  `${file.name}/${entry.name}: ${
                    e instanceof Error ? e.message : "Import fehlgeschlagen"
                  }`
                );
              }
            }
          } else {
            assertFileSizeLimit(
              file,
              MAX_PROJECT_ARCHIVE_BYTES,
              "JSON-Sicherung"
            );
            const text = await file.text();
            parsed.push({
              fileLabel: file.name,
              project: parseExamJson(text),
            });
          }
        } catch (e) {
          results.fail.push(
            `${file.name}: ${
              e instanceof Error ? e.message : "Import fehlgeschlagen"
            }`
          );
        }
      }

      for (const item of parsed) {
        try {
          const { matches, byId } = findExistingExamMatches(
            item.project,
            workingExamsRef.current
          );
          if (matches.length === 0) {
            const { summary, id, project } = await saveAsNewCopy(
              item.project,
              null
            );
            results.plain.push(summary);
            results.lastId = id;
            upsertWorkingExam(project);
          } else {
            conflicts.push({
              fileLabel: item.fileLabel,
              project: item.project,
              matches,
              byId,
            });
          }
        } catch (e) {
          results.fail.push(
            `${item.fileLabel}: ${
              e instanceof Error ? e.message : "Import fehlgeschlagen"
            }`
          );
        }
      }

      if (conflicts.length === 0) {
        await finishImportBatch(results);
        return;
      }

      setImportResults(results);
      setConflictQueue(conflicts);
      setConflictIndex(0);
      // Dialog übernimmt; Busy bleibt bis finishImportBatch
    } catch (e) {
      setImportBusy(false);
      setImportErr(
        e instanceof Error ? e.message : "Import fehlgeschlagen"
      );
    }
  };

  const activeConflict = conflictQueue[conflictIndex] ?? null;

  const exportBackup = async (exam: ExamProject) => {
    const result = await downloadJson(
      projectArchiveFilename(exam),
      exportExamJson(exam)
    );
    if (result.method === "failed") {
      setImportErr(
        result.error || `Sicherung von „${exam.name}“ fehlgeschlagen.`
      );
      return;
    }
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
      const zipResult = await downloadBlob(zipName, blob);
      if (zipResult.method === "failed") {
        throw new Error(
          zipResult.error || "Semester-ZIP konnte nicht heruntergeladen werden."
        );
      }

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
              accept="application/json,.json,application/zip,.zip"
              multiple
              className="hidden"
              disabled={importBusy || conflictQueue.length > 0}
              onChange={(e) => {
                const files = e.target.files;
                if (files?.length) void importBackupFiles(files);
                e.target.value = "";
              }}
            />
            <Button
              variant="secondary"
              size="sm"
              className="max-w-full shrink"
              onClick={() => fileRef.current?.click()}
              title="Gesicherte Prüfungen aus .json oder Semester-.zip in diesen Browser laden"
              disabled={importBusy || conflictQueue.length > 0}
            >
              <Upload className="size-4 shrink-0" />
              <span className="truncate">
                {importBusy || conflictQueue.length > 0 ? (
                  "Laden läuft…"
                ) : (
                  <>
                    <span className="sm:hidden">JSON/ZIP laden</span>
                    <span className="hidden sm:inline">
                      JSON/ZIP laden
                    </span>
                  </>
                )}
              </span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="max-w-full shrink"
              onClick={() => void exportSemesterZip()}
              title={`Alle Prüfungen mit Semester „${semesterNow}“ als ZIP herunterladen (Sicherung)`}
              disabled={loading}
            >
              <Archive className="size-4 shrink-0" />
              <span className="truncate">
                <span className="sm:hidden">Sem.-ZIP</span>
                <span className="hidden sm:inline">
                  Semester-ZIP speichern
                </span>
              </span>
            </Button>
            <NewExamDialog onCreated={() => void refresh()} />
          </>
        }
      />

      {activeConflict && (
        <ImportConflictDialog
          open
          fileLabel={activeConflict.fileLabel}
          imported={activeConflict.project}
          matches={activeConflict.matches}
          byId={activeConflict.byId}
          queueIndex={conflictIndex + 1}
          queueTotal={conflictQueue.length}
          onResolve={(r) => void resolveConflict(r)}
        />
      )}

      <main className="mx-auto min-h-0 w-full max-w-6xl flex-1 overflow-auto px-4 py-8">
        <div className="mb-6 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Prüfungen
              </h1>
              <p className="mt-1 text-muted-foreground">
                Notenvergabe und HISinOne-Export.
                {semesterFilter === SEMESTER_FILTER_ALL ? (
                  <>
                    {" "}
                    · {exams.length} Prüfung(en) gesamt
                    {semesterExams.length > 0 && (
                      <>
                        {" "}
                        · {semesterExams.length} im aktuellen Semester (
                        {semesterNow})
                      </>
                    )}
                  </>
                ) : semesterFilter === SEMESTER_FILTER_NONE ? (
                  <>
                    {" "}
                    · {filteredExams.length} ohne Semester
                  </>
                ) : (
                  <>
                    {" "}
                    · {filteredExams.length} Prüfung(en) in{" "}
                    <strong>{semesterFilter}</strong>
                  </>
                )}
              </p>
            </div>
            <div className="grid w-full gap-1 sm:w-56">
              <Label htmlFor="semester-filter" className="text-xs">
                Semester filtern
              </Label>
              <Select
                value={semesterFilter}
                onValueChange={(v) => v && setSemesterFilter(v)}
              >
                <SelectTrigger id="semester-filter" className="w-full">
                  <SelectValue>
                    {semesterFilter === SEMESTER_FILTER_ALL
                      ? "Alle Semester"
                      : semesterFilter === SEMESTER_FILTER_NONE
                        ? "Ohne Semester"
                        : semesterFilter}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEMESTER_FILTER_ALL}>
                    Alle Semester
                  </SelectItem>
                  {semesterOptions.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                      {s === semesterNow ? " (aktuell)" : ""}
                    </SelectItem>
                  ))}
                  {noneSemesterCount > 0 && (
                    <SelectItem value={SEMESTER_FILTER_NONE}>
                      Ohne Semester ({noneSemesterCount})
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-xl border border-amber-300/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-50">
            <p className="font-medium">Daten nur in diesem Browser</p>
            <p className="mt-1 opacity-90">
              Prüfungsprojekte werden lokal gespeichert (IndexedDB), nicht auf
              dem Server. Nach Importen und vor dem HISinOne-/PDF-Export:{" "}
              <strong>JSON-Sicherung</strong> herunterladen. Mehrere JSON-Dateien
              oder eine <strong>Semester-ZIP</strong> können importiert werden.
              „Semester-ZIP speichern“ packt alle Prüfungen mit Semester „
              {semesterNow}“ in eine ZIP-Datei.
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
                Legen Sie eine neue Prüfung an oder importieren Sie
                Projektsicherungen (.json) bzw. eine Semester-ZIP.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <NewExamDialog onCreated={() => void refresh()} />
              <Button
                variant="secondary"
                onClick={() => fileRef.current?.click()}
                title="Gesicherte Prüfungen aus .json oder Semester-.zip laden"
              >
                <Upload className="size-4" />
                JSON/ZIP laden
              </Button>
            </CardContent>
          </Card>
        )}

        {!loading && exams.length > 0 && filteredExams.length === 0 && (
          <Card className="surface-panel border-dashed">
            <CardHeader>
              <CardTitle className="text-base">
                Keine Prüfung in diesem Filter
              </CardTitle>
              <CardDescription>
                {semesterFilter === SEMESTER_FILTER_NONE
                  ? "Es gibt keine Prüfungen ohne gesetztes Semester."
                  : `Keine Prüfung mit Semester „${semesterFilter}“. Filter auf „Alle Semester“ stellen oder Semester in den Prüfungseinstellungen anpassen.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSemesterFilter(SEMESTER_FILTER_ALL)}
              >
                Alle Semester anzeigen
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {filteredExams.map((exam) => {
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
                      {exam.importedAsCopyAt && (
                        <span
                          className="mt-1 inline-block rounded bg-sky-100 px-1.5 py-0.5 text-xs font-medium text-sky-950 dark:bg-sky-900 dark:text-sky-50"
                          title={
                            exam.importedAsCopyOfName
                              ? `Import-Kopie zu „${exam.importedAsCopyOfName}“`
                              : "Als zusätzliche Version importiert"
                          }
                        >
                          Import-Kopie
                          {exam.importedAsCopyOfName
                            ? ` · zu „${exam.importedAsCopyOfName}“`
                            : ""}
                          {" · "}
                          {formatImportDateTime(exam.importedAsCopyAt)}
                        </span>
                      )}
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
