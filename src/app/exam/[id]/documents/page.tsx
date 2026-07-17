"use client";

import { useMemo, useState } from "react";
import { useExamContext } from "@/components/exam/exam-context";
import { Button } from "@/components/ui/button";
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
import { formatGrade, formatPoints } from "@/lib/utils";
import type { PointsRecord } from "@/lib/types";
import { FileText, HardDrive, ShieldAlert } from "lucide-react";

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
  const { project, setProject, rows } = useExamContext();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

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

  if (!project) return null;

  const backupOk = canAccessProtectedExport(project);
  const backupStale = isBackupStale(project);

  const run = (key: string, fn: () => void, ok: string) => {
    if (!backupOk) {
      setError(
        "Bitte zuerst die JSON-Projektsicherung durchführen (Export → Projekt sichern)."
      );
      return;
    }
    setBusy(key);
    setMessage(null);
    setError(null);
    try {
      fn();
      setMessage(ok);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export fehlgeschlagen");
    } finally {
      setBusy(null);
    }
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
          PDF-Listen mit OTH-Letterhead für Akte, Fachbereich und
          Prüfungsamt. Daten vor dem Export ggf. ergänzen.
        </p>
      </div>

      {backupStale && (
        <div
          role="alert"
          className="flex flex-wrap items-start gap-3 rounded-xl border border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-600 dark:bg-amber-950/50 dark:text-amber-50"
        >
          <ShieldAlert className="mt-0.5 size-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">PDF-Export gesperrt</p>
            <p className="mt-0.5 opacity-95">
              Bitte zuerst die Projektsicherung (JSON) herunterladen und
              ablegen. Die Sicherung enthält alle Daten – Pfade zu
              Original-Excel sind nicht erforderlich.
            </p>
          </div>
          <Button
            size="sm"
            className="bg-amber-800 text-white hover:bg-amber-900"
            onClick={() => {
              downloadAndMarkBackup(project, setProject);
              setMessage("Projektsicherung heruntergeladen – PDFs freigeschaltet.");
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
        {/* Notenliste */}
        <Card className="surface-panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Notenliste</CardTitle>
            <CardDescription>
              Alle Teilnehmer inkl. No-Shows und ohne HIS, mit
              Unterschriftsfeldern.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              size="sm"
              variant="outline"
              disabled={busy != null || rows.length === 0 || !backupOk}
              onClick={() =>
                run(
                  "grades",
                  () => exportGradesListPdf(project, rows),
                  "Notenliste heruntergeladen."
                )
              }
            >
              <FileText className="size-4" />
              {busy === "grades" ? "…" : "PDF erzeugen"}
            </Button>
          </CardContent>
        </Card>

        {/* Manuelle Notenmeldung */}
        <Card className="surface-panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Manuelle Notenmeldung
              {manualRows.length > 0 && (
                <Badge variant="secondary" className="ml-2 font-normal">
                  {manualRows.length}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Sonderfälle ohne HIS. Studiengang aus Import oder manuell.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {manualRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Keine Kandidaten ohne HIS-Anmeldung.
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
                busy != null || manualRows.length === 0 || !backupOk
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
      </div>

      {/* Zweitkorrektur */}
      <Card className="surface-panel">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base">
                Durchfaller / Zweitkorrektur
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
              disabled={busy != null || !scStatus.ready || !backupOk}
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
              Noch {scStatus.total - scStatus.filled} Zweitkorrektur-Punktzahl(en)
              fehlen.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Notenänderungen */}
      <Card className="surface-panel">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base">
                Notenänderungen
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
                busy != null || changeRows.length === 0 || !backupOk
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
  );
}
