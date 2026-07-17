"use client";

import { useState } from "react";
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
import { loadWorkbookFromFile, worksheetToMatrix } from "@/lib/excel/workbook";
import { parseHisMatrix } from "@/lib/excel/parse-his";
import { parseAttendanceMatrix } from "@/lib/excel/parse-attendance";
import { parsePointsMatrix } from "@/lib/excel/parse-moodle-points";
import { normalizeMatriculation } from "@/lib/matching/matriculation";
import type { ImportLogEntry, ImportType, Student } from "@/lib/types";

type PreviewState = {
  type: ImportType;
  fileName: string;
  rowCount: number;
  preview: Record<string, string>[];
  warnings: string[];
  errors: string[];
  apply: () => void;
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

  const handleHis = async (file: File) => {
    const wb = await loadWorkbookFromFile(file);
    // Prefer sheet with "Noteneintrag" or first sheet
    const sheet =
      wb.worksheets.find((s) => /noteneintrag|his|qis/i.test(s.name)) ??
      wb.worksheets[0];
    const matrix = worksheetToMatrix(sheet);
    const result = parseHisMatrix(matrix);

    setPreview({
      type: "his",
      fileName: file.name,
      rowCount: result.rows.length,
      preview: result.preview,
      warnings: result.log.warnings,
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
          // Optional: Dozenten aus Meta übernehmen wenn leer
          const lecturers =
            prev.lecturers.length > 0
              ? prev.lecturers
              : result.meta.lecturers ?? [];
          return {
            ...prev,
            hisRows: result.rows,
            hisTemplateMeta: {
              ...result.meta,
              originalFileName: file.name,
            },
            lecturers,
            students,
            importLogs: [
              pushLog("his", file.name, result.log),
              ...prev.importLogs,
            ].slice(0, 30),
          };
        });
      },
    });
  };

  const handleAttendance = async (file: File) => {
    const wb = await loadWorkbookFromFile(file);
    const sheet =
      wb.worksheets.find((s) => /antritt/i.test(s.name)) ?? wb.worksheets[0];
    const matrix = worksheetToMatrix(sheet);
    const result = parseAttendanceMatrix(matrix);

    setPreview({
      type: "attendance",
      fileName: file.name,
      rowCount: result.records.length,
      preview: result.preview,
      warnings: result.log.warnings,
      errors: result.log.errors,
      apply: () => {
        setProject((prev) => ({
          ...prev,
          attendance: result.records,
          students: mergeStudents(prev.students, result.students),
          importLogs: [
            pushLog("attendance", file.name, result.log),
            ...prev.importLogs,
          ].slice(0, 30),
        }));
      },
    });
  };

  const handlePoints = async (file: File) => {
    const wb = await loadWorkbookFromFile(file);
    const sheet =
      wb.worksheets.find((s) =>
        /punkte|detail|bewertung|grades/i.test(s.name)
      ) ?? wb.worksheets[0];
    const matrix = worksheetToMatrix(sheet);
    const result = parsePointsMatrix(matrix, project.subAreas);

    setPreview({
      type: "points",
      fileName: file.name,
      rowCount: result.records.length,
      preview: result.preview,
      warnings: result.log.warnings,
      errors: result.log.errors,
      apply: () => {
        setProject((prev) => ({
          ...prev,
          points: result.records,
          students: mergeStudents(prev.students, result.students),
          importLogs: [
            pushLog("points", file.name, result.log),
            ...prev.importLogs,
          ].slice(0, 30),
        }));
      },
    });
  };

  const lastByType = (type: ImportType) =>
    project.importLogs.find((l) => l.type === type);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Importe</h1>
        <p className="text-muted-foreground">
          HIS-Masterliste, Antrittsliste und Punkte per Excel. Matching über
          Matrikelnummer.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <ImportDropzone
            label="1. HIS / QIS Noteneintrag"
            description="Offizielle Anmeldeliste (Master). Enthält alle Angemeldeten inkl. No-Shows."
            onFile={handleHis}
          />
          <StatusLine
            count={project.hisRows.length}
            log={lastByType("his")}
          />
        </div>
        <div className="space-y-2">
          <ImportDropzone
            label="2. Antritt zur Prüfung"
            description="Moodle-Export der tatsächlichen Antritte."
            onFile={handleAttendance}
          />
          <StatusLine
            count={project.attendance.length}
            log={lastByType("attendance")}
          />
        </div>
        <div className="space-y-2">
          <ImportDropzone
            label="3. Punkte (Moodle / THE)"
            description="Bewertungsexport oder Punkte-Tabelle mit Matr.-Nr. und Gesamtpunkten."
            onFile={handlePoints}
          />
          <StatusLine
            count={project.points.length}
            log={lastByType("points")}
          />
        </div>
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
              : "Punkte-Import bestätigen"
        }
        preview={preview?.preview ?? []}
        warnings={preview?.warnings ?? []}
        errors={preview?.errors ?? []}
        rowCount={preview?.rowCount ?? 0}
        confirming={confirming}
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
