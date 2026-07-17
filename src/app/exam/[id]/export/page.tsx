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
import { cn, downloadJson } from "@/lib/utils";
import { exportExamJson } from "@/lib/storage";
import {
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  HardDrive,
} from "lucide-react";

export default function ExportPage() {
  const { id } = useParams<{ id: string }>();
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
      `Projektsicherung heruntergeladen (${projectArchiveSummary(project)}).`
    );
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Export</h1>
        <p className="text-muted-foreground">
          HIS/QIS-Noteneintrag und Projektsicherung. PDF-Listen unter{" "}
          <Link
            href={`/exam/${id}/documents`}
            className="font-medium text-foreground underline"
          >
            Dokumente
          </Link>
          .
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

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="surface-panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">HIS/QIS Excel</CardTitle>
            <CardDescription>
              Noteneintragsdatei(en) für den Upload
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              size="sm"
              onClick={() => void doHisExport()}
              disabled={exporting || hasError}
            >
              <FileSpreadsheet className="size-4" />
              {exporting ? "Exportiere…" : "Excel exportieren"}
            </Button>
          </CardContent>
        </Card>

        <Card id="sicherung" className="surface-panel scroll-mt-20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <HardDrive className="size-4" />
              Projektsicherung
            </CardTitle>
            <CardDescription>
              JSON-Archiv für Ablage neben den Klausurdateien
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button
              size="sm"
              type="button"
              variant="outline"
              onClick={doProjectBackup}
            >
              <FileJson className="size-4" />
              Projekt sichern
            </Button>
            <p className="break-all font-mono text-xs text-muted-foreground">
              {projectArchiveFilename(project)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="surface-panel">
        <CardContent className="flex flex-wrap items-center gap-3 pt-4">
          <FileText className="size-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Notenliste, manuelle Notenmeldung, Zweitkorrektur und
            Notenänderungen als PDF:
          </p>
          <Link
            href={`/exam/${id}/documents`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
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
