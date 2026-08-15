"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useExamContext } from "@/components/exam/exam-context";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { validateForExport } from "@/lib/validations";
import {
  projectArchiveFilename,
  projectArchiveSummary,
} from "@/lib/project-archive";
import { downloadAndMarkBackup } from "@/lib/backup-actions";
import {
  backupStatusLabel,
  isBackupStale,
} from "@/lib/backup-status";
import { cn } from "@/lib/utils";
import {
  FileJson,
  FileText,
  HardDrive,
  ShieldAlert,
} from "lucide-react";
import { HISINONE_LABEL } from "@/lib/types";
import {
  type BackupStage,
  inferBackupStage,
} from "@/lib/workflow-milestones";
import { listUnresolvedOrphans } from "@/lib/matching/orphan-resolution";
import { isOnlineStyleExam } from "@/lib/types";

function parseStage(raw: string | null): BackupStage | undefined {
  if (raw === "import" || raw === "matching" || raw === "grades" || raw === "general") {
    return raw;
  }
  return undefined;
}

export default function ExportPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { project, setProject, rows, stats } = useExamContext();
  const [message, setMessage] = useState<string | null>(null);

  const items = useMemo(
    () => (project && rows ? validateForExport(project, rows) : []),
    [project, rows]
  );

  if (!project || !stats) return null;

  const backupStale = isBackupStale(project);
  const unresolvedN = isOnlineStyleExam(project.examType)
    ? listUnresolvedOrphans(project, rows).length
    : 0;
  const stageFromQuery = parseStage(searchParams.get("stage"));
  const stage =
    stageFromQuery ??
    inferBackupStage(project, {
      gradedCount: stats.graded,
      unresolvedOrphanCount: unresolvedN,
    });
  const filenamePreview = projectArchiveFilename(project, stage);

  const doProjectBackup = () => {
    void (async () => {
      try {
        await downloadAndMarkBackup(project, setProject, {
          gradedCount: stats.graded,
          unresolvedOrphanCount: unresolvedN,
          stage,
        });
        setMessage(
          `Projektsicherung heruntergeladen (${projectArchiveSummary(project)}, Datei: ${filenamePreview}). Bitte neben den Klausurdateien ablegen. Notenliste und ${HISINONE_LABEL}-Export sind freigeschaltet (sofern keine weiteren Sperren).`
        );
      } catch (e) {
        setMessage(
          e instanceof Error
            ? e.message
            : "Sicherung konnte nicht heruntergeladen werden."
        );
      }
    })();
  };

  const stageLabel =
    stage === "import"
      ? "nach Import"
      : stage === "matching"
        ? "nach Zuordnung"
        : stage === "grades"
          ? "nach Noten"
          : "allgemein";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Sicherung</h1>
        <p className="text-muted-foreground">
          JSON-Projektsicherung – jederzeit und bei Änderungen. Dateinamen
          unterscheiden die Workflow-Schritte (…_nach-Import / …_nach-Zuordnung
          / …_nach-Noten). Notenliste und {HISINONE_LABEL}-Dateien exportieren
          Sie unter{" "}
          <Link
            href={`/exam/${id}/documents`}
            className="font-medium text-foreground underline"
          >
            Dokumente
          </Link>
          . In MS Teams können Downloads blockiert sein – ggf. im Browser öffnen.
        </p>
      </div>

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
            Projektsicherung (Pflicht vor Exporten)
          </CardTitle>
          <CardDescription>
            Vollständiges JSON-Archiv – enthält alle Daten inkl. Matrikel-Audits.
            Status: <strong>{backupStatusLabel(project)}</strong>
            {" · "}
            Schritt: <strong>{stageLabel}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {backupStale && (
            <div className="flex gap-2 rounded-lg border border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-50">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" />
              <span>
                Daten nur in diesem Browser. Ohne aktuelle Sicherung sind{" "}
                {HISINONE_LABEL}-Export und PDF-Dokumente gesperrt.
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
            Dateiname: {filenamePreview}
          </p>
        </CardContent>
      </Card>

      <Card className="surface-panel">
        <CardHeader>
          <CardTitle className="text-base">Validierung (Export-Status)</CardTitle>
          <CardDescription>
            Prüft u. a. offene Bewertungen, ungeprüfte Matrikel-Sonderfälle,
            Teilgebiet-Zuordnung und {HISINONE_LABEL}-Vorlagen.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Hinweise.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {items.map((item, i) => (
                <li
                  key={`${item.level}-${i}`}
                  className={cn(
                    "rounded-lg border px-3 py-2",
                    item.level === "error" &&
                      "border-destructive/40 bg-destructive/5 text-destructive",
                    item.level === "warning" &&
                      "border-amber-400/50 bg-amber-50 dark:bg-amber-950/30",
                    item.level === "info" && "border-border bg-muted/30"
                  )}
                >
                  {item.message}
                  {item.count != null && (
                    <span className="ml-1 tabular-nums opacity-80">
                      ({item.count})
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          <Link
            href={`/exam/${id}/documents`}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "mt-2 gap-1.5"
            )}
          >
            <FileText className="size-4" />
            Zu Dokumenten
          </Link>
        </CardContent>
      </Card>

      {message && (
        <p className="text-sm text-emerald-700 dark:text-emerald-300">
          {message}
        </p>
      )}
    </div>
  );
}
