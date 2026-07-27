"use client";

import { useMemo, useState } from "react";
import { useExamContext } from "@/components/exam/exam-context";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { exportGradesListPdf } from "@/lib/pdf/export-grades-pdf";
import { isPortfolioExam, isStaCriteriaExam } from "@/lib/types";
import { Checkbox } from "@/components/ui/checkbox";
import {
  exportManualGradesPdf,
  filterManualGradeRows,
} from "@/lib/pdf/export-manual-grades-pdf";
import {
  exportFailersPdf,
  filterFailerRows,
  secondCorrectionComplete,
} from "@/lib/pdf/export-failers-pdf";
import {
  exportGradeChangesPdf,
  filterGradeChangeRows,
} from "@/lib/pdf/export-grade-changes-pdf";
import { exportNotenspiegelPdf } from "@/lib/pdf/export-notenspiegel-pdf";
import { exportNotenspiegelExcel } from "@/lib/excel/export-notenspiegel";
import { exportHisExcel } from "@/lib/excel/export-his";
import { getHisSources } from "@/lib/his-sources";
import {
  findPointsRecord,
  resolveProgramCode,
} from "@/lib/pdf/pdf-common";
import { normalizeMatriculation } from "@/lib/matching/matriculation";
import { downloadAndMarkBackup } from "@/lib/backup-actions";
import {
  canAccessProtectedExport,
  isBackupStale,
} from "@/lib/backup-status";
import {
  hasOpenGrading,
  openGradingSummary,
} from "@/lib/grades/open-grading";
import {
  hasUnresolvedOrphans,
  unresolvedOrphanSummary,
} from "@/lib/matching/orphan-resolution";
import { cn, formatGrade, formatPoints } from "@/lib/utils";
import { HISINONE_LABEL, type PointsRecord } from "@/lib/types";
import { validateForExport } from "@/lib/validations";
import {
  FileSpreadsheet,
  FileText,
  GitMerge,
  HardDrive,
  ListChecks,
  ShieldAlert,
} from "lucide-react";

function upsertPoints(
  points: PointsRecord[],
  matKey: string,
  patch: Partial<PointsRecord>,
  subAreaIds: string[]
): PointsRecord[] {
  const idx = points.findIndex(
    (p) => normalizeMatriculation(p.matriculationNumber) === matKey
  );
  if (idx < 0) {
    return [
      ...points,
      {
        matriculationNumber: matKey,
        bySubArea: Object.fromEntries(subAreaIds.map((id) => [id, null])),
        totalPoints: null,
        source: "manual",
        ...patch,
      },
    ];
  }
  const next = [...points];
  next[idx] = { ...next[idx], ...patch };
  return next;
}

export default function DocumentsPage() {
  const { id } = useParams<{ id: string }>();
  const { project, setProject, rows, stats } = useExamContext();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [includeCriterionRaw, setIncludeCriterionRaw] = useState(false);

  const manualRows = useMemo(
    () => (rows ? filterManualGradeRows(rows) : []),
    [rows]
  );
  const failerRows = useMemo(
    () => (rows ? filterFailerRows(rows) : []),
    [rows]
  );
  const changeRows = useMemo(
    () => (project && rows ? filterGradeChangeRows(project, rows) : []),
    [project, rows]
  );
  const scStatus = useMemo(
    () =>
      project && rows
        ? secondCorrectionComplete(project, rows)
        : { total: 0, filled: 0, ready: false },
    [project, rows]
  );
  const hisSources = useMemo(
    () => (project ? getHisSources(project) : []),
    [project]
  );

  const validation = useMemo(
    () => (project && rows ? validateForExport(project, rows) : []),
    [project, rows]
  );
  const validationBlocked = validation.some((i) => i.level === "error");

  if (!project) return null;

  const backupOk = canAccessProtectedExport(project);
  const backupStale = isBackupStale(project);
  const gradingLocked = hasOpenGrading(project);
  const orphansLocked = hasUnresolvedOrphans(project, rows);
  const exportAllowed =
    backupOk && !gradingLocked && !orphansLocked && !validationBlocked;
  const pdfAllowed = exportAllowed;
  const notenspiegelReady =
    pdfAllowed && stats != null && stats.graded > 0;

  const run = (key: string, fn: () => void | Promise<void>, ok: string) => {
    if (gradingLocked) {
      setError(
        `Export gesperrt: ${openGradingSummary(project)}. Bitte zuerst alle Aufgaben bewerten.`
      );
      return;
    }
    if (orphansLocked) {
      setError(
        `Export gesperrt: ${unresolvedOrphanSummary(project, rows)}.`
      );
      return;
    }
    if (!backupOk) {
      setError(
        "Bitte zuerst die JSON-Projektsicherung durchführen (Menü Sicherung)."
      );
      return;
    }
    if (validationBlocked) {
      setError(
        "Export gesperrt – siehe Validierung (z. B. fehlende HISinOne-Vorlage)."
      );
      return;
    }
    setBusy(key);
    setMessage(null);
    setError(null);
    void (async () => {
      try {
        await fn();
        setMessage(ok);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Export fehlgeschlagen");
      } finally {
        setBusy(null);
      }
    })();
  };

  const patchStudent = (matKey: string, patch: Partial<PointsRecord>) => {
    setProject((prev) => ({
      ...prev,
      points: upsertPoints(
        prev.points,
        matKey,
        patch,
        prev.subAreas.map((s) => s.id)
      ),
    }));
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">Dokumente</h1>
        <p className="text-muted-foreground">
          Empfohlener Ablauf: Notenliste → {HISINONE_LABEL}-Excel hochladen →
          ggf. manuelle Notenmeldung. Zuerst JSON-Sicherung unter{" "}
          <Link
            href={`/exam/${id}/export`}
            className="font-medium text-foreground underline"
          >
            Sicherung
          </Link>
          .
        </p>
      </div>

      {orphansLocked && (
        <div
          role="alert"
          className="flex flex-wrap items-start gap-3 rounded-xl border border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-600 dark:bg-amber-950/50 dark:text-amber-50"
        >
          <GitMerge className="mt-0.5 size-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              Notenliste / {HISINONE_LABEL} gesperrt
            </p>
            <p className="mt-0.5 opacity-95">
              {unresolvedOrphanSummary(project, rows)}. Bitte unter Zuordnung
              zusammenführen oder ablehnen.
            </p>
          </div>
          <Link
            href={`/exam/${id}/matching`}
            className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
          >
            Zu Zuordnung
          </Link>
        </div>
      )}

      {gradingLocked && !orphansLocked && (
        <div
          role="alert"
          className="flex flex-wrap items-start gap-3 rounded-xl border border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-600 dark:bg-amber-950/50 dark:text-amber-50"
        >
          <ListChecks className="mt-0.5 size-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">PDF-Export gesperrt</p>
            <p className="mt-0.5 opacity-95">
              {openGradingSummary(project)}. Notenlisten und PDFs erst nach
              vollständiger Bewertung aller Aufgaben.
            </p>
          </div>
          <Link
            href={`/exam/${id}/detail-points`}
            className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
          >
            Zu Detailpunkten
          </Link>
        </div>
      )}

      {backupStale && !gradingLocked && !orphansLocked && (
        <div
          role="alert"
          className="flex flex-wrap items-start gap-3 rounded-xl border border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-600 dark:bg-amber-950/50 dark:text-amber-50"
        >
          <ShieldAlert className="mt-0.5 size-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Export gesperrt</p>
            <p className="mt-0.5 opacity-95">
              Bitte zuerst die Projektsicherung (JSON) herunterladen und
              ablegen.
            </p>
          </div>
          <Button
            size="sm"
            className="bg-amber-800 text-white hover:bg-amber-900"
            onClick={() => {
              downloadAndMarkBackup(project, setProject, {
                gradedCount: stats?.graded,
              });
              setMessage("Projektsicherung heruntergeladen – Exporte freigeschaltet.");
              setError(null);
            }}
          >
            <HardDrive className="size-4" />
            Jetzt sichern
          </Button>
        </div>
      )}

      {(message || error) && (
        <p
          className={
            error
              ? "text-sm text-destructive"
              : "text-sm text-emerald-700 dark:text-emerald-300"
          }
        >
          {error ?? message}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* 1 Notenliste */}
        <Card className="surface-panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">1. Notenliste</CardTitle>
            <CardDescription>
              Alle Teilnehmer inkl. No-Shows, mit Unterschriftsfeldern und
              dokumentierten Matrikel-Prüfungen. Teilnoten je Teilleistung in der
              Haupttabelle; Rohwerte optional.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {project &&
              ((isPortfolioExam(project.examType) &&
                project.portfolioCriteriaMode) ||
                (isStaCriteriaExam(project.examType) &&
                  (project.criteria?.length ?? 0) > 0)) && (
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <Checkbox
                    checked={includeCriterionRaw}
                    onCheckedChange={(v) =>
                      setIncludeCriterionRaw(v === true)
                    }
                    className="mt-0.5"
                  />
                  <span>
                    <span className="font-medium">
                      Rohwerte der Teilkriterien anhängen
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      Zusätzliche Tabelle(n) mit K1, K2, … (bei vielen Kriterien
                      in Abschnitten, ohne horizontalen Überlauf).
                    </span>
                  </span>
                </label>
              )}
            <Button
              size="sm"
              variant="outline"
              disabled={busy != null || rows.length === 0 || !pdfAllowed}
              onClick={() =>
                run(
                  "grades",
                  () =>
                    exportGradesListPdf(project, rows, {
                      includeCriterionRawValues: includeCriterionRaw,
                    }),
                  "Notenliste heruntergeladen."
                )
              }
            >
              <FileText className="size-4" />
              {busy === "grades" ? "…" : "PDF erzeugen"}
            </Button>
          </CardContent>
        </Card>

        {/* 2 HISinOne */}
        <Card className="surface-panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              2. {HISINONE_LABEL} Excel
              {hisSources.length > 1 && (
                <Badge
                  variant="default"
                  className="ml-2 bg-primary font-semibold tabular-nums"
                >
                  {hisSources.length} Dateien
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Formatgetreu aus der importierten Vorlage – nur die Notenspalte.
              Danach in {HISINONE_LABEL} hochladen.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {hisSources.length > 1 && (
              <div
                role="status"
                className="rounded-lg border-2 border-amber-500/80 bg-amber-50 px-3 py-2.5 text-sm text-amber-950 dark:border-amber-500 dark:bg-amber-950/40 dark:text-amber-50"
              >
                <p className="font-semibold">
                  {hisSources.length} separate Excel-Dateien
                </p>
                <p className="mt-0.5 text-xs opacity-95">
                  Pro importiertem Studiengang / HIS-Datei eine Vorlage. Bitte
                  jede Datei einzeln in {HISINONE_LABEL} hochladen.
                </p>
              </div>
            )}
            {hisSources.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Keine HIS-Quelle – bitte unter Import die Noteneintragsdatei(en)
                einlesen.
              </p>
            ) : hisSources.length === 1 ? (
              <Button
                size="sm"
                variant="default"
                className="w-full sm:w-auto"
                disabled={
                  busy != null ||
                  !pdfAllowed ||
                  !stats ||
                  project.hisRows.length === 0
                }
                title={
                  hisSources[0].originalFileName ||
                  hisSources[0].examNumber ||
                  hisSources[0].label
                }
                onClick={() => {
                  if (!stats) return;
                  const src = hisSources[0];
                  run(
                    "hisinone",
                    () =>
                      exportHisExcel(project, rows, stats, {
                        sourceId: src.id,
                      }),
                    `${HISINONE_LABEL}-Excel für ${src.programCode || src.label} heruntergeladen.`
                  );
                }}
              >
                <FileSpreadsheet className="size-4" />
                {busy === "hisinone"
                  ? "…"
                  : `Excel · ${hisSources[0].programCode || hisSources[0].label}`}
              </Button>
            ) : (
              <div className="flex flex-col gap-2">
                {hisSources.map((src) => {
                  const busyKey = `hisinone:${src.id}`;
                  const n = src.rows?.length ?? 0;
                  const label =
                    src.programCode ||
                    src.examNumber ||
                    src.label ||
                    "HIS";
                  return (
                    <div
                      key={src.id}
                      className="rounded-lg border-2 border-primary/40 bg-primary/5 p-2.5 dark:bg-primary/10"
                    >
                      <div className="mb-1.5 min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {label}
                          {src.examNumber &&
                            src.examNumber !== label && (
                              <span className="ml-1.5 font-normal text-muted-foreground">
                                · {src.examNumber}
                              </span>
                            )}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {n} Anmeldung(en)
                          {src.originalFileName
                            ? ` · ${src.originalFileName}`
                            : ""}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="default"
                        className="w-full"
                        disabled={
                          busy != null ||
                          !pdfAllowed ||
                          !stats ||
                          n === 0
                        }
                        title={
                          src.originalFileName ||
                          src.examNumber ||
                          src.label
                        }
                        onClick={() => {
                          if (!stats) return;
                          run(
                            busyKey,
                            () =>
                              exportHisExcel(project, rows, stats, {
                                sourceId: src.id,
                              }),
                            `${HISINONE_LABEL}-Excel für ${label} heruntergeladen.`
                          );
                        }}
                      >
                        <FileSpreadsheet className="size-4" />
                        {busy === busyKey
                          ? "…"
                          : `Excel exportieren · ${label}`}
                      </Button>
                    </div>
                  );
                })}
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  disabled={
                    busy != null ||
                    !pdfAllowed ||
                    !stats ||
                    project.hisRows.length === 0
                  }
                  onClick={() => {
                    if (!stats) return;
                    run(
                      "hisinone:all",
                      () => exportHisExcel(project, rows, stats),
                      `${hisSources.length} ${HISINONE_LABEL}-Excel-Dateien heruntergeladen.`
                    );
                  }}
                >
                  <FileSpreadsheet className="size-4" />
                  {busy === "hisinone:all"
                    ? "…"
                    : `Alle ${hisSources.length} Dateien nacheinander`}
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Bei älteren Projekten Originaldatei unter Import erneut einlesen.
            </p>
          </CardContent>
        </Card>

        {/* 3 Manuelle Notenmeldung */}
        <Card className="surface-panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              3. Manuelle Notenmeldung
              {manualRows.length > 0 && (
                <Badge variant="secondary" className="ml-2 font-normal">
                  {manualRows.length}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Sonderfälle ohne {HISINONE_LABEL}-Anmeldung. Studiengang aus
              Import oder manuell.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {manualRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Keine Kandidaten ohne {HISINONE_LABEL}-Anmeldung.
              </p>
            ) : (
              <div className="max-h-48 overflow-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Matr.</TableHead>
                      <TableHead>Note</TableHead>
                      <TableHead className="min-w-[6rem]">Studiengang</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {manualRows.map((r) => {
                      const fromHis = !!r.programCode;
                      const rec = findPointsRecord(project, r.key);
                      const value = fromHis
                        ? r.programCode!
                        : rec?.manualProgramCode ?? "";
                      return (
                        <TableRow key={r.key}>
                          <TableCell className="text-sm">
                            {r.student.lastName}, {r.student.firstName}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {r.key}
                          </TableCell>
                          <TableCell className="tabular-nums text-sm">
                            {formatGrade(r.finalGrade)}
                          </TableCell>
                          <TableCell>
                            {fromHis ? (
                              <Badge variant="outline">{value}</Badge>
                            ) : (
                              <Input
                                className="h-7 w-20"
                                placeholder="z. B. MBW"
                                value={value}
                                onChange={(e) =>
                                  patchStudent(r.key, {
                                    manualProgramCode:
                                      e.target.value.trim() || null,
                                  })
                                }
                              />
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
            <Button
              size="sm"
              variant="outline"
              disabled={
                busy != null || manualRows.length === 0 || !pdfAllowed
              }
              onClick={() =>
                run(
                  "manual",
                  () => exportManualGradesPdf(project, rows),
                  "Manuelle Notenmeldung heruntergeladen."
                )
              }
            >
              <FileText className="size-4" />
              {busy === "manual" ? "…" : "PDF erzeugen"}
            </Button>
          </CardContent>
        </Card>

        {/* 4 Durchfaller – neben manueller Notenmeldung */}
        <Card className="surface-panel">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">
                  4. Durchfaller / Zweitkorrektur
                  {failerRows.length > 0 && (
                    <Badge variant="secondary" className="ml-2 font-normal">
                      {scStatus.filled}/{scStatus.total} erfasst
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Vor dem PDF für alle Durchfaller die Zweitkorrektur-Punkte
                  eintragen (Anmerkungen optional).
                </CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={busy != null || !scStatus.ready || !pdfAllowed}
                onClick={() =>
                  run(
                    "failers",
                    () => exportFailersPdf(project, rows),
                    "Zweitkorrektur-PDF heruntergeladen."
                  )
                }
              >
                <FileText className="size-4" />
                {busy === "failers" ? "…" : "PDF erzeugen"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {failerRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Keine Durchfaller vorhanden.
              </p>
            ) : (
              <div className="max-h-72 overflow-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Matr.</TableHead>
                      <TableHead>Punkte Erst</TableHead>
                      <TableHead>Note</TableHead>
                      <TableHead className="min-w-[5.5rem]">
                        Punkte Zweit
                      </TableHead>
                      <TableHead className="min-w-[10rem]">Anmerkungen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {failerRows.map((r) => {
                      const rec = findPointsRecord(project, r.key);
                      return (
                        <TableRow key={r.key}>
                          <TableCell className="text-sm">
                            {r.student.lastName}, {r.student.firstName}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {r.key}
                          </TableCell>
                          <TableCell className="tabular-nums text-sm">
                            {formatPoints(r.totalPoints)}
                          </TableCell>
                          <TableCell className="tabular-nums text-sm">
                            {formatGrade(r.finalGrade)}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              step="0.5"
                              className="h-7 w-20"
                              value={
                                rec?.secondCorrectionPoints != null
                                  ? String(rec.secondCorrectionPoints)
                                  : ""
                              }
                              onChange={(e) => {
                                const raw = e.target.value.trim();
                                const num =
                                  raw === ""
                                    ? null
                                    : Number(raw.replace(",", "."));
                                patchStudent(r.key, {
                                  secondCorrectionPoints:
                                    num != null && Number.isFinite(num)
                                      ? num
                                      : null,
                                });
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              className="h-7 min-w-[8rem]"
                              value={rec?.secondCorrectionNotes ?? ""}
                              onChange={(e) =>
                                patchStudent(r.key, {
                                  secondCorrectionNotes: e.target.value,
                                })
                              }
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
            {failerRows.length > 0 && !scStatus.ready && (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                Noch {scStatus.total - scStatus.filled}{" "}
                Zweitkorrektur-Punktzahl(en) fehlen.
              </p>
            )}
          </CardContent>
        </Card>

        {/* 5 Notenspiegel – neben Notenänderungen */}
        <Card className="surface-panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">5. Notenspiegel</CardTitle>
            <CardDescription>
              Aggregierte Notenverteilung und Kennzahlen zum aktiven Szenario –
              ohne personenbezogene Daten. PDF oder Excel.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={busy != null || !notenspiegelReady}
              onClick={() => {
                if (!stats) return;
                run(
                  "spiegel-pdf",
                  () => exportNotenspiegelPdf(project, rows, stats),
                  "Notenspiegel (PDF) heruntergeladen."
                );
              }}
            >
              <FileText className="size-4" />
              {busy === "spiegel-pdf" ? "…" : "PDF"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy != null || !notenspiegelReady}
              onClick={() => {
                if (!stats) return;
                run(
                  "spiegel-xlsx",
                  () => exportNotenspiegelExcel(project, rows, stats),
                  "Notenspiegel (Excel) heruntergeladen."
                );
              }}
            >
              <FileSpreadsheet className="size-4" />
              {busy === "spiegel-xlsx" ? "…" : "Excel"}
            </Button>
            {stats && stats.graded <= 0 && (
              <p className="text-xs text-muted-foreground">
                Noch keine bewerteten Teilnehmer.
              </p>
            )}
          </CardContent>
        </Card>

        {/* 6 Notenänderungen */}
        <Card className="surface-panel">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">
                  6. Notenänderungen
                  {changeRows.length > 0 && (
                    <Badge variant="secondary" className="ml-2 font-normal">
                      {changeRows.length}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Manuelle Notenkorrekturen (z. B. nach Klausureinsicht) für das
                  Prüfungsamt. Noten in der Notenübersicht anpassen.
                </CardDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={
                  busy != null || changeRows.length === 0 || !pdfAllowed
                }
                onClick={() =>
                  run(
                    "changes",
                    () => exportGradeChangesPdf(project, rows),
                    "Notenänderungsliste heruntergeladen."
                  )
                }
              >
                <FileText className="size-4" />
                {busy === "changes" ? "…" : "PDF erzeugen"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {changeRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Keine geänderten Noten. In der Notenübersicht eine Note manuell
                überschreiben, um sie hier zu listen.
              </p>
            ) : (
              <div className="max-h-56 overflow-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Matr.</TableHead>
                      <TableHead>Studiengr.</TableHead>
                      <TableHead>Bisher</TableHead>
                      <TableHead>Neu</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {changeRows.map((c) => (
                      <TableRow key={c.row.key}>
                        <TableCell className="text-sm">
                          {c.row.student.lastName}, {c.row.student.firstName}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {c.row.key}
                        </TableCell>
                        <TableCell className="text-sm">
                          {c.programCode ||
                            resolveProgramCode(c.row, project) ||
                            "–"}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {formatGrade(c.previousGrade)}
                        </TableCell>
                        <TableCell className="tabular-nums font-medium">
                          {formatGrade(c.newGrade)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
