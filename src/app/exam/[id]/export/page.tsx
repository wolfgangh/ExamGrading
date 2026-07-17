"use client";

import { useMemo, useState } from "react";
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
  datedExportFilename,
  downloadJson,
} from "@/lib/utils";
import { exportExamJson } from "@/lib/storage";
import { Download, FileJson, FileSpreadsheet } from "lucide-react";
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

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Export</h1>
        <p className="text-muted-foreground">
          Fertige Noteneintragsdatei für den HIS/QIS-Upload sowie
          JSON-Backup des gesamten Prüfungsprojekts.
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
          <CardTitle className="text-base">Dateien erzeugen</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            onClick={() => void doHisExport()}
            disabled={exporting || hasError}
          >
            <FileSpreadsheet className="size-4" />
            {exporting ? "Exportiere…" : "HIS/QIS Excel exportieren"}
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              downloadJson(
                datedExportFilename(project.name || "Pruefung", "json"),
                exportExamJson(project)
              )
            }
          >
            <FileJson className="size-4" />
            JSON-Backup
          </Button>
        </CardContent>
      </Card>

      {message && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Download className="size-4" />
          {message}
        </p>
      )}

      <Card className="surface-panel">
        <CardHeader>
          <CardTitle className="text-base">Export-Inhalt</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>
            <strong className="text-foreground">Noteneintrag:</strong>{" "}
            Pro Studiengang/HIS-Quelle eine Datei (z. B. MEB und MBW getrennt).
            Enthält u. a. Matrikelnummer und Note (Leistung/bewertung).
          </p>
          <p>
            <strong className="text-foreground">Durchfaller:</strong> Note
            ≥ 4,0 mit Punkten.
          </p>
          <p>
            <strong className="text-foreground">Statistik:</strong>{" "}
            Kennzahlen und Notenverteilung.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
