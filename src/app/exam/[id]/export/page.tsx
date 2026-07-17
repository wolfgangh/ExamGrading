"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useExamContext } from "@/components/exam/exam-context";
import { Button, buttonVariants } from "@/components/ui/button";
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
import { downloadAndMarkBackup } from "@/lib/backup-actions";
import {
  backupStatusLabel,
  canAccessProtectedExport,
  isBackupStale,
} from "@/lib/backup-status";
import { cn } from "@/lib/utils";
import {
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  HardDrive,
  ShieldAlert,
} from "lucide-react";

export default function ExportPage() {
  const { id } = useParams<{ id: string }>();
  const { project, setProject, rows, stats } = useExamContext();
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const items = useMemo(
    () => (project && rows ? validateForExport(project, rows) : []),
    [project, rows]
  );

  if (!project || !stats) return null;

  const hasError = items.some((i) => i.level === "error");
  const backupOk = canAccessProtectedExport(project);
  const backupStale = isBackupStale(project);

  const doHisExport = async () => {
    if (!backupOk) return;
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
    downloadAndMarkBackup(project, setProject);
    setMessage(
      `Projektsicherung heruntergeladen (${projectArchiveSummary(project)}). Bitte neben den Klausurdateien ablegen. HIS-Export und PDFs sind jetzt freigeschaltet.`
    );
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Export</h1>
        <p className="text-muted-foreground">
          Zuerst JSON-Sicherung, dann HIS/QIS-Noteneintrag. PDF-Listen unter{" "}
          <Link
            href={`/exam/${id}/documents`}
            className="font-medium text-foreground underline"
          >
            Dokumente
          </Link>
          .
        </p>
      </div>

      {/* Sicherung zuerst – prominente Karte */}
      <Card
        id="sicherung"
        className={cn(
          "surface-panel scroll-mt-20",
          backupStale &&
            "border-amber-500 ring-2 ring-amber-400/40 dark:border-amber-600"
        )}
      >
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <HardDrive className="size-4" />
            1. Projektsicherung (Pflicht)
          </CardTitle>
          <CardDescription>
            Vollständiges JSON-Archiv – enthält alle Daten. Original-Excel-Pfade
            werden nicht benötigt (nur Dateinamen in den Logs). Status:{" "}
            <strong>{backupStatusLabel(project)}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {backupStale && (
            <div className="flex gap-2 rounded-lg border border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-50">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" />
              <span>
                Daten nur in diesem Browser. Ohne Sicherung sind HIS-Export und
                PDF-Dokumente gesperrt.
              </span>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              type="button"
              variant={backupStale ? "default" : "outline"}
              onClick={doProjectBackup}
            >
              <FileJson className="size-4" />
              Projekt sichern (.json)
            </Button>
            {!backupStale && (
              <span className="text-xs text-emerald-700 dark:text-emerald-300">
                Aktuell gesichert
              </span>
            )}
          </div>
          <p className="break-all font-mono text-xs text-muted-foreground">
            {projectArchiveFilename(project)}
          </p>
        </CardContent>
      </Card>

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
        <CardHeader className="pb-2">
          <CardTitle className="text-base">2. HIS/QIS Excel</CardTitle>
          <CardDescription>
            Noteneintragsdatei(en) für den Upload – erst nach Sicherung
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            size="sm"
            onClick={() => void doHisExport()}
            disabled={exporting || hasError || !backupOk}
          >
            <FileSpreadsheet className="size-4" />
            {exporting ? "Exportiere…" : "Excel exportieren"}
          </Button>
          {!backupOk && (
            <p className="text-xs text-amber-800 dark:text-amber-200">
              Bitte zuerst die Projektsicherung durchführen.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="surface-panel">
        <CardContent className="flex flex-wrap items-center gap-3 pt-4">
          <FileText className="size-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            PDF-Listen (ebenfalls erst nach Sicherung):
          </p>
          <Link
            href={`/exam/${id}/documents`}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "gap-1.5"
            )}
          >
            Zu Dokumente
          </Link>
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
