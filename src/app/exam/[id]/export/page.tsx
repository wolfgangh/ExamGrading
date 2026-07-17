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
import { Download, FileJson, FileSpreadsheet, HardDrive } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ExportPage() {
  const { project, rows, stats } = useExamContext();
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const items = useMemo(
    () => (project && rows ? validateForExport(project, rows) : []),
    [project, rows]
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

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Export</h1>
        <p className="text-muted-foreground">
          HIS/QIS-Noteneintrag sowie vollständige Projektsicherung zur Ablage
          neben den Klausurdateien.
        </p>
      </div>

      <Card className="surface-panel">
        <CardHeader>
          <CardTitle className="text-base">Validierung</CardTitle>
          <CardDescription>
            Vor dem Upload prüfen – No-Shows erhalten eine leere Note.
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

      <Card id="sicherung" className="surface-panel scroll-mt-20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <HardDrive className="size-4" />
            Projektsicherung
          </CardTitle>
          <CardDescription>
            Vollständiges Archiv (JSON) zum Ablegen neben den
            Klausur-Excel-Dateien. Enthält Stammdaten, HIS, Antritte, Punkte,
            Aufgabendetails, Szenarien und manuelle Notenkorrekturen. Auf der{" "}
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

      <Card className="surface-panel">
        <CardHeader>
          <CardTitle className="text-base">Export-Inhalt (HIS)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">Noteneintrag:</strong> Pro
            Studiengang/HIS-Quelle eine Datei. Enthält u. a. Matrikelnummer und
            Note.
          </p>
          <p>
            <strong className="text-foreground">Statistik:</strong> Ø Note,
            Median, Stabw., Bestehensquote.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
