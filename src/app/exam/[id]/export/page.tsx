"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useExamContext } from "@/components/exam/exam-context";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { exportHisExcel } from "@/lib/excel/export-his";
import { validateForExport } from "@/lib/validations";
import {
  projectArchiveFilename,
  projectArchiveSummary,
} from "@/lib/project-archive";
import { downloadJson } from "@/lib/utils";
import { exportExamJson } from "@/lib/storage";
import { exportGradesListPdf } from "@/lib/pdf/export-grades-pdf";
import {
  exportManualGradesPdf,
  filterManualGradeRows,
} from "@/lib/pdf/export-manual-grades-pdf";
import {
  exportFailersPdf,
  filterFailerRows,
} from "@/lib/pdf/export-failers-pdf";
import {
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  HardDrive,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function ExportPage() {
  const { project, rows, stats } = useExamContext();
  const [exporting, setExporting] = useState(false);
  const [pdfBusy, setPdfBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const items = useMemo(
    () => (project && rows ? validateForExport(project, rows) : []),
    [project, rows]
  );

  const manualCount = useMemo(
    () => (rows ? filterManualGradeRows(rows).length : 0),
    [rows]
  );
  const failerCount = useMemo(
    () => (rows ? filterFailerRows(rows).length : 0),
    [rows]
  );

  if (!project || !stats) return null;

  const hasError = items.some((i) => i.level === "error");

  const doHisExport = async () => {
    setExporting(true);
    setMessage(null);
    try {
      await exportHisExcel(project, rows, stats);
      setMessage("HIS-Excel wurde heruntergeladen.");
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Export fehlgeschlagen"
      );
    } finally {
      setExporting(false);
    }
  };

  const doProjectBackup = () => {
    downloadJson(projectArchiveFilename(project), exportExamJson(project));
    setMessage(
      `Projektsicherung heruntergeladen (${projectArchiveSummary(project)}). Bitte neben den Klausur-Excel-Dateien ablegen.`
    );
  };

  const runPdf = (key: string, fn: () => void, okMsg: string) => {
    setPdfBusy(key);
    setMessage(null);
    try {
      fn();
      setMessage(okMsg);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "PDF-Export fehlgeschlagen");
    } finally {
      setPdfBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Export</h1>
        <p className="text-muted-foreground">
          HIS/QIS-Noteneintrag, PDF-Listen für Akte und Unterschrift sowie
          Projektsicherung.
        </p>
      </div>

      <Card className="surface-panel">
        <CardHeader>
          <CardTitle className="text-base">Validierung</CardTitle>
          <CardDescription>
            Vor dem HIS-Upload prüfen – No-Shows erhalten eine leere Note.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {items.map((item, i) => (
            <div
              key={i}
              className={cn(
                "flex items-start justify-between gap-2 rounded-lg border px-3 py-2 text-sm",
                item.level === "error" &&
                  "border-destructive/40 bg-destructive/5 text-destructive",
                item.level === "warning" &&
                  "border-amber-300 bg-amber-50 text-amber-950 dark:bg-amber-950/20 dark:text-amber-100",
                item.level === "info" && "bg-muted/40"
              )}
            >
              <span>{item.message}</span>
              {item.count != null && (
                <span className="shrink-0 font-semibold tabular-nums">
                  {item.count}
                </span>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="surface-panel">
        <CardHeader>
          <CardTitle className="text-base">HIS/QIS Excel</CardTitle>
          <CardDescription>
            Noteneintragsdatei(en) für den Upload ins Campus-System
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={() => void doHisExport()}
            disabled={exporting || hasError}
          >
            <FileSpreadsheet className="size-4" />
            {exporting ? "Exportiere…" : "HIS/QIS Excel exportieren"}
          </Button>
        </CardContent>
      </Card>

      <Card className="surface-panel">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="size-4" />
            PDF-Export
          </CardTitle>
          <CardDescription>
            Druckbare Listen mit Kopfdaten und Unterschriftsfeldern
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={pdfBusy != null || rows.length === 0}
              onClick={() =>
                runPdf(
                  "grades",
                  () => exportGradesListPdf(project, rows),
                  "Notenliste-PDF wurde heruntergeladen."
                )
              }
            >
              <FileText className="size-4" />
              {pdfBusy === "grades" ? "…" : "Notenliste"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pdfBusy != null || manualCount === 0}
              onClick={() =>
                runPdf(
                  "manual",
                  () => exportManualGradesPdf(project, rows),
                  "Manuelle Notenmeldung-PDF wurde heruntergeladen."
                )
              }
            >
              <FileText className="size-4" />
              {pdfBusy === "manual"
                ? "…"
                : `Manuelle Notenmeldung${manualCount ? ` (${manualCount})` : ""}`}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pdfBusy != null || failerCount === 0}
              onClick={() =>
                runPdf(
                  "failers",
                  () => exportFailersPdf(project, rows),
                  "Zweitkorrektur-/Durchfaller-PDF wurde heruntergeladen."
                )
              }
            >
              <FileText className="size-4" />
              {pdfBusy === "failers"
                ? "…"
                : `Durchfaller / Zweitkorrektur${failerCount ? ` (${failerCount})` : ""}`}
            </Button>
          </div>
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            <li>
              <strong className="text-foreground">Notenliste:</strong> alle
              Teilnehmer inkl. No-Shows und ohne HIS; Punkte, Note,
              Unterschriftsfelder.
            </li>
            <li>
              <strong className="text-foreground">Manuelle Notenmeldung:</strong>{" "}
              nur Sonderfälle ohne HISinOne-Anmeldung (Formular für den
              Fachbereich).
              {manualCount === 0 && " – derzeit keine passenden Kandidaten."}
            </li>
            <li>
              <strong className="text-foreground">Zweitkorrektur:</strong>{" "}
              Durchfaller mit leeren Feldern für Zweitkorrektur und Anmerkungen.
              {failerCount === 0 && " – derzeit keine Durchfaller."}
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card id="sicherung" className="surface-panel scroll-mt-20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <HardDrive className="size-4" />
            Projektsicherung
          </CardTitle>
          <CardDescription>
            Vollständiges Archiv (JSON) zum Ablegen neben den
            Klausur-Excel-Dateien. Auf der{" "}
            <Link href="/" className="font-medium text-foreground underline">
              Startseite
            </Link>{" "}
            wieder importierbar.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" onClick={doProjectBackup}>
            <FileJson className="size-4" />
            Projekt sichern (.json)
          </Button>
          <p className="text-xs text-muted-foreground">
            Dateiname:{" "}
            <span className="font-mono">
              {projectArchiveFilename(project)}
            </span>
          </p>
        </CardContent>
      </Card>

      {message && (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <Download className="mt-0.5 size-4 shrink-0" />
          {message}
        </p>
      )}
    </div>
  );
}
