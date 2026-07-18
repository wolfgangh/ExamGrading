"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useExamContext } from "@/components/exam/exam-context";
import { ImportDropzone } from "@/components/import/import-dropzone";
import { ImportPreviewDialog } from "@/components/import/import-preview-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  loadWorkbookFromFile,
  pickPointsWorksheet,
  worksheetToMatrix,
} from "@/lib/excel/workbook";
import { fileToBase64 } from "@/lib/excel/binary";
import { parseHisMatrix } from "@/lib/excel/parse-his";
import { parseAttendanceMatrix } from "@/lib/excel/parse-attendance";
import { parsePointsMatrix } from "@/lib/excel/parse-moodle-points";
import {
  buildHisSourceFromParse,
  getHisSources,
  removeHisSource,
  upsertHisSource,
} from "@/lib/his-sources";
import { clearWorkflowMilestonesOnImport } from "@/lib/workflow-milestones";
import { normalizeMatriculation } from "@/lib/matching/matriculation";
import type {
  ImportLogEntry,
  ImportType,
  PointsRecord,
  Student,
} from "@/lib/types";
import { Button } from "@/components/ui/button";
import { exportPointsTemplate } from "@/lib/excel/export-points-template";
import { Download, Trash2 } from "lucide-react";
import { isHisManualAssessmentExam } from "@/lib/types";
import { AddStudentForm } from "@/components/exam/add-student-form";

type PreviewState = {
  type: ImportType;
  fileName: string;
  rowCount: number;
  preview: Record<string, string>[];
  warnings: string[];
  errors: string[];
  apply: () => void;
  isPointsReimport?: boolean;
};

function mergeStudents(
  existing: Record<string, Student>,
  incoming: Student[]
): Record<string, Student> {
  const next = { ...existing };
  for (const s of incoming) {
    const key = normalizeMatriculation(s.matriculationNumber);
    if (!key) continue;
    const prev = next[key];
    next[key] = {
      matriculationNumber: s.matriculationNumber,
      lastName: s.lastName || prev?.lastName || "",
      firstName: s.firstName || prev?.firstName || "",
      email: s.email || prev?.email,
      attempt: s.attempt ?? prev?.attempt ?? null,
    };
  }
  return next;
}

export default function ImportPage() {
  const { project, setProject } = useExamContext();
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [keepOverrides, setKeepOverrides] = useState(true);
  const [replaceAllPoints, setReplaceAllPoints] = useState(true);
  const keepOverridesRef = useRef(keepOverrides);
  const replaceAllPointsRef = useRef(replaceAllPoints);
  keepOverridesRef.current = keepOverrides;
  replaceAllPointsRef.current = replaceAllPoints;
  const pointsRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("focus") === "points") {
      pointsRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [searchParams]);

  if (!project) return null;

  const pushLog = (
    type: ImportType,
    fileName: string,
    log: Omit<ImportLogEntry, "at" | "fileName">
  ): ImportLogEntry => ({
    ...log,
    type,
    fileName,
    at: new Date().toISOString(),
  });

  const parseHisFile = async (file: File) => {
    const [wb, originalXlsxBase64] = await Promise.all([
      loadWorkbookFromFile(file),
      fileToBase64(file),
    ]);
    const sheet =
      wb.worksheets.find((s) => /noteneintrag|his|qis/i.test(s.name)) ??
      wb.worksheets[0];
    const matrix = worksheetToMatrix(sheet);
    const result = parseHisMatrix(matrix, { fileName: file.name });
    const source = buildHisSourceFromParse({
      rows: result.rows,
      meta: {
        ...result.meta,
        sheetName: sheet.name,
      },
      fileName: file.name,
      originalXlsxBase64,
      sheetName: sheet.name,
    });
    return { result, source, sheetName: sheet.name };
  };

  const handleHisFile = async (file: File) => {
    const { result, source } = await parseHisFile(file);

    const warnings = [...result.log.warnings];
    if (result.meta.examNumber) {
      warnings.unshift(`Prüfungsnummer: ${result.meta.examNumber}`);
    }
    if (source.programCode) {
      warnings.unshift(`Studiengang: ${source.programCode}`);
    }
    warnings.unshift(
      "Originaldatei gespeichert – Export bleibt HisinOne-kompatibel."
    );

    setPreview({
      type: "his",
      fileName: file.name,
      rowCount: result.rows.length,
      preview: result.preview,
      warnings,
      errors: result.log.errors,
      apply: () => {
        setProject((prev) => {
          const students = mergeStudents(
            prev.students,
            result.rows.map((r) => ({
              matriculationNumber: r.matriculationNumber,
              lastName: r.lastName,
              firstName: r.firstName,
            }))
          );
          const lecturers =
            prev.lecturers.length > 0
              ? prev.lecturers
              : result.meta.lecturers ?? prev.lecturers;
          let next = upsertHisSource(prev, source);
          next = {
            ...next,
            lecturers,
            students,
            importLogs: [
              pushLog("his", file.name, {
                ...result.log,
                warnings,
              }),
              ...prev.importLogs,
            ].slice(0, 30),
          };
          return clearWorkflowMilestonesOnImport(next);
        });
      },
    });
  };

  const handleHisFiles = async (files: File[]) => {
    if (files.length === 1) {
      await handleHisFile(files[0]);
      return;
    }
    // Mehrere Dateien: nacheinander einlesen und ohne Einzel-Preview hinzufügen
    for (const file of files) {
      const { result, source } = await parseHisFile(file);
      if (result.log.errors.length) continue;
      setProject((prev) => {
        const students = mergeStudents(
          prev.students,
          result.rows.map((r) => ({
            matriculationNumber: r.matriculationNumber,
            lastName: r.lastName,
            firstName: r.firstName,
          }))
        );
        const lecturers =
          prev.lecturers.length > 0
            ? prev.lecturers
            : result.meta.lecturers ?? prev.lecturers;
        return clearWorkflowMilestonesOnImport({
          ...upsertHisSource(prev, source),
          lecturers,
          students,
          importLogs: [
            pushLog("his", file.name, {
              ...result.log,
              warnings: [
                "Originaldatei gespeichert – Export bleibt HisinOne-kompatibel.",
                ...result.log.warnings,
              ],
            }),
            ...prev.importLogs,
          ].slice(0, 30),
        });
      });
    }
  };

  const handleAttendance = async (file: File) => {
    const wb = await loadWorkbookFromFile(file);
    const sheet =
      wb.worksheets.find((s) => /antritt/i.test(s.name)) ?? wb.worksheets[0];
    const matrix = worksheetToMatrix(sheet);
    const result = parseAttendanceMatrix(matrix);

    const hisKeys = new Set(
      project.hisRows
        .map((r) => normalizeMatriculation(r.matriculationNumber))
        .filter(Boolean) as string[]
    );
    const matched = result.records.filter((a) => {
      const k = normalizeMatriculation(a.matriculationNumber);
      return k && hisKeys.has(k);
    }).length;
    const orphan = result.records.length - matched;
    const warnings = [...result.log.warnings];
    if (project.attendance.length > 0) {
      warnings.unshift(
        `Ersetzt die bisherige Antrittsliste (${project.attendance.length} Einträge).`
      );
    }
    warnings.unshift(
      `Matching: ${matched} in HIS gefunden, ${orphan} ohne HIS-Zuordnung.`
    );

    setPreview({
      type: "attendance",
      fileName: file.name,
      rowCount: result.records.length,
      preview: result.preview,
      warnings,
      errors: result.log.errors,
      apply: () => {
        setProject((prev) =>
          clearWorkflowMilestonesOnImport({
            ...prev,
            attendance: result.records,
            students: mergeStudents(prev.students, result.students),
            importLogs: [
              pushLog("attendance", file.name, {
                ...result.log,
                warnings,
                matched,
                unmatched: orphan,
              }),
              ...prev.importLogs,
            ].slice(0, 30),
          })
        );
      },
    });
  };

  const handlePoints = async (file: File) => {
    const wb = await loadWorkbookFromFile(file);
    // Detailpunkte mit F-Spalten bevorzugen (nicht nur Gesamtpunkte-Blatt)
    const sheet = pickPointsWorksheet(wb);
    const matrix = worksheetToMatrix(sheet);
    const result = parsePointsMatrix(matrix, project.subAreas, {
      knownStudents: project.students,
    });
    const isReimport = project.points.length > 0;

    const warnings = [...result.log.warnings];
    if (wb.worksheets.length > 1) {
      warnings.unshift(`Arbeitsblatt „${sheet.name}“ verwendet.`);
    }
    if (
      project.examType !== "written" &&
      !result.questionDefs?.length &&
      result.records.length > 0
    ) {
      warnings.unshift(
        "Keine Aufgaben-Spalten (F 1, F 2, …) – Gesamtpunkte werden genutzt (bei THE optional Detailblatt wählen)."
      );
    }
    if (
      project.examType === "written" &&
      result.records.length > 0
    ) {
      warnings.unshift(
        "Klausur-Punkteimport: Match über Matrikelnummer. Personen ohne HIS erscheinen als Sonderfälle."
      );
    }
    if (isReimport) {
      warnings.unshift(
        `Re-Import: bisher ${project.points.length} Punktedatensätze – Optionen im Dialog prüfen.`
      );
    }
    if (result.matchStats?.length) {
      const viaLogin = result.matchStats.find((m) => m.method === "login");
      if (viaLogin) {
        warnings.unshift(
          `${viaLogin.count} Zuordnung(en) über Anmeldename.`
        );
      }
    }
    if (Object.keys(project.students).length === 0) {
      warnings.unshift(
        "Noch keine Studierendenstammdaten – bitte zuerst HIS und Antritt importieren (Match über Anmeldename)."
      );
    }

    setPreview({
      type: "points",
      fileName: file.name,
      rowCount: result.records.length,
      preview: result.preview,
      warnings,
      errors: result.log.errors,
      isPointsReimport: isReimport,
      apply: () => {
        const replace = replaceAllPointsRef.current;
        const keep = keepOverridesRef.current;
        setProject((prev) => {
          let nextPoints: PointsRecord[];

          if (replace) {
            nextPoints = result.records.map((rec) => {
              if (!keep) return rec;
              const key = normalizeMatriculation(rec.matriculationNumber);
              const old = prev.points.find(
                (p) =>
                  normalizeMatriculation(p.matriculationNumber) === key
              );
              if (!old) return rec;
              return {
                ...rec,
                gradeOverride: old.gradeOverride,
                totalOverride: old.totalOverride,
                comment: old.comment ?? rec.comment,
                source:
                  old.gradeOverride != null || old.totalOverride != null
                    ? "mixed"
                    : rec.source,
              };
            });
          } else {
            const byKey = new Map(
              prev.points.map((p) => [
                normalizeMatriculation(p.matriculationNumber) ??
                  p.matriculationNumber,
                p,
              ])
            );
            for (const rec of result.records) {
              const key =
                normalizeMatriculation(rec.matriculationNumber) ??
                rec.matriculationNumber;
              const old = byKey.get(key);
              if (old && keep) {
                byKey.set(key, {
                  ...rec,
                  gradeOverride: old.gradeOverride,
                  totalOverride: old.totalOverride,
                  comment: old.comment ?? rec.comment,
                  source:
                    old.gradeOverride != null || old.totalOverride != null
                      ? "mixed"
                      : rec.source,
                });
              } else {
                byKey.set(key, rec);
              }
            }
            nextPoints = [...byKey.values()];
          }

          return clearWorkflowMilestonesOnImport({
            ...prev,
            points: nextPoints,
            questionDefs:
              result.questionDefs?.length > 0
                ? result.questionDefs
                : prev.questionDefs,
            students: mergeStudents(prev.students, result.students),
            importLogs: [
              pushLog("points", file.name, {
                ...result.log,
                warnings,
              }),
              ...prev.importLogs,
            ].slice(0, 30),
          });
        });
      },
    });
  };

  const lastByType = (type: ImportType) =>
    project.importLogs.find((l) => l.type === type);

  const hisSources = getHisSources(project);
  const isKlausur = project.examType === "written";
  const isHisManual = isHisManualAssessmentExam(project.examType);
  const canExportTemplate = project.hisRows.length > 0;

  const downloadTemplate = async () => {
    if (!canExportTemplate) return;
    await exportPointsTemplate(project);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Importe</h1>
        <p className="text-muted-foreground">
          {isHisManual
            ? "HISinOne-Masterliste importieren, optional weitere Personen manuell hinzufügen (StA / Portfolio)."
            : isKlausur
              ? "Klausur: HIS-Masterliste, dann Punkte-Vorlage ausfüllen und importieren."
              : "HIS-Masterliste (ggf. mehrere Studiengänge), Antrittsliste und Punkte. Matching über Matrikelnummer / Anmeldename."}
        </p>
      </div>

      <div
        className={
          isHisManual || isKlausur
            ? "grid gap-4 md:grid-cols-2"
            : "grid gap-4 md:grid-cols-3"
        }
      >
        <div className="space-y-2">
          <ImportDropzone
            label="1. HIS / QIS Noteneintrag"
            description="Eine oder mehrere Dateien (z. B. MEB + MBW). Wird ergänzt, nicht überschrieben."
            multiple
            onFiles={handleHisFiles}
          />
          <StatusLine
            count={project.hisRows.length}
            log={lastByType("his")}
          />
          {hisSources.length > 0 && (
            <div className="space-y-1 rounded-lg border p-2 text-xs">
              {hisSources.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-2"
                >
                  <span>
                    <Badge variant="outline" className="mr-1">
                      {s.programCode}
                    </Badge>
                    {s.examNumber || s.label} · {s.rows.length}
                  </span>
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    onClick={() =>
                      setProject((prev) => removeHisSource(prev, s.id))
                    }
                    aria-label="HIS-Quelle entfernen"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {isHisManual ? (
          <Card className="surface-panel">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                2. Person manuell hinzufügen
              </CardTitle>
              <CardDescription>
                Zusätzliche Studierende ohne oder mit späterem HIS-Eintrag.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AddStudentForm project={project} onAdd={setProject} />
            </CardContent>
          </Card>
        ) : isKlausur ? (
          <div className="space-y-3">
            <Card className="surface-panel border-dashed">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">2. Punkte-Vorlage</CardTitle>
                <CardDescription>
                  Excel mit allen HIS-Personen zum Ausfüllen der Punkte.
                  Extra-Zeilen für Teilnehmer ohne HIS-Anmeldung.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!canExportTemplate}
                  onClick={() => void downloadTemplate()}
                >
                  <Download className="size-4" />
                  Vorlage herunterladen
                </Button>
                {!canExportTemplate && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Zuerst HIS importieren.
                  </p>
                )}
              </CardContent>
            </Card>

            <div ref={pointsRef} className="space-y-2" id="points-import">
              <ImportDropzone
                label={
                  project.points.length > 0
                    ? "3. Punkte aktualisieren (Vorlage)"
                    : "3. Punkte importieren (Vorlage)"
                }
                description="Ausgefüllte Klausur-Vorlage (Matrikelnummer + Gesamtpunkte). Personen ohne HIS möglich."
                onFile={handlePoints}
              />
              <StatusLine
                count={project.points.length}
                log={lastByType("points")}
              />
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <ImportDropzone
                label={
                  project.attendance.length > 0
                    ? "2. Antritt neu laden (ersetzt Liste)"
                    : "2. Antritt zur Prüfung"
                }
                description="Moodle: E-Mail, Datum, Name, Vorname, Matrikelnummer. Erneuter Import ersetzt die Antrittsliste."
                onFile={handleAttendance}
              />
              <StatusLine
                count={project.attendance.length}
                log={lastByType("attendance")}
              />
            </div>
            <div ref={pointsRef} className="space-y-2" id="points-import">
              <ImportDropzone
                label={
                  project.points.length > 0
                    ? "3. Punkte aktualisieren (Moodle / THE)"
                    : "3. Punkte (Moodle / THE)"
                }
                description={
                  project.points.length > 0
                    ? "THE/Moodle erneut importieren (Match: Anmeldename). Overrides optional behalten."
                    : "Moodle THE: Nachname, Vorname, Anmeldename, Bewertung/90 – Match über Anmeldename (zuerst Antritt laden)."
                }
                onFile={handlePoints}
              />
              <StatusLine
                count={project.points.length}
                log={lastByType("points")}
              />
            </div>
          </>
        )}
      </div>

      <Card className="surface-panel">
        <CardHeader>
          <CardTitle className="text-base">Import-Protokoll</CardTitle>
          <CardDescription>Letzte Importe und Warnungen</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {project.importLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Noch keine Importe durchgeführt.
            </p>
          ) : (
            project.importLogs.slice(0, 10).map((log, i) => (
              <div
                key={`${log.at}-${i}`}
                className="flex flex-wrap items-start justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {log.type === "his"
                      ? "HIS"
                      : log.type === "attendance"
                        ? "Antritt"
                        : "Punkte"}{" "}
                    · {log.fileName}
                  </p>
                  <p className="text-muted-foreground">
                    {new Date(log.at).toLocaleString("de-DE")} · {log.rowCount}{" "}
                    Zeilen
                    {log.warnings.length
                      ? ` · ${log.warnings.length} Warnungen`
                      : ""}
                  </p>
                </div>
                <Badge variant="outline">{log.rowCount}</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <ImportPreviewDialog
        open={!!preview}
        onOpenChange={(o) => !o && setPreview(null)}
        title={
          preview?.type === "his"
            ? "HIS-Import bestätigen"
            : preview?.type === "attendance"
              ? "Antritts-Import bestätigen"
              : preview?.isPointsReimport
                ? "Punkte aktualisieren"
                : "Punkte-Import bestätigen"
        }
        description={
          preview?.type === "points"
            ? `${preview.rowCount} Zeilen – Re-Import nach Moodle-Korrektur möglich.`
            : undefined
        }
        preview={preview?.preview ?? []}
        warnings={preview?.warnings ?? []}
        errors={preview?.errors ?? []}
        rowCount={preview?.rowCount ?? 0}
        confirming={confirming}
        confirmLabel={
          preview?.type === "points"
            ? `${preview.rowCount} Punkte übernehmen`
            : undefined
        }
        extra={
          preview?.type === "points" ? (
            <div className="space-y-2 rounded-lg border p-3 text-sm">
              <p className="font-medium">Aktualisierungsoptionen</p>
              <label className="flex items-start gap-2">
                <input
                  type="radio"
                  className="mt-1"
                  checked={replaceAllPoints}
                  onChange={() => setReplaceAllPoints(true)}
                />
                <span>
                  <strong>Ersetzen:</strong> Punkteliste durch Import
                  ersetzen (empfohlen nach Korrektur)
                </span>
              </label>
              <label className="flex items-start gap-2">
                <input
                  type="radio"
                  className="mt-1"
                  checked={!replaceAllPoints}
                  onChange={() => setReplaceAllPoints(false)}
                />
                <span>
                  <strong>Zusammenführen:</strong> nur Matrikelnummern aus
                  der Datei aktualisieren, übrige behalten
                </span>
              </label>
              <label className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={keepOverrides}
                  onChange={(e) => setKeepOverrides(e.target.checked)}
                />
                Manuelle Noten-/Punkte-Overrides und Kommentare behalten
              </label>
            </div>
          ) : null
        }
        onConfirm={() => {
          if (!preview) return;
          setConfirming(true);
          try {
            preview.apply();
            setPreview(null);
          } finally {
            setConfirming(false);
          }
        }}
      />
    </div>
  );
}

function StatusLine({
  count,
  log,
}: {
  count: number;
  log?: ImportLogEntry;
}) {
  return (
    <p className="text-center text-xs text-muted-foreground">
      {count > 0 ? (
        <>
          <span className="font-medium text-emerald-700 dark:text-emerald-400">
            {count} importiert
          </span>
          {log ? ` · ${log.fileName}` : null}
        </>
      ) : (
        "Noch nicht importiert"
      )}
    </p>
  );
}
