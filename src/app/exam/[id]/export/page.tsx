"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreOptions, PageHeader } from "@/components/layout/page-kit";
import { useParams, useSearchParams } from "next/navigation";
import { useExamContext } from "@/components/exam/exam-context";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title="Sicherung"
        description="JSON-Projektsicherung – die Daten liegen nur in diesem Browser."
        action={
          <Button
            type="button"
            size="lg"
            variant={backupStale ? "default" : "outline"}
            onClick={doProjectBackup}
          >
            <FileJson className="size-4" />
            JSON-Sicherung herunterladen
          </Button>
        }
      />

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
            Status
          </CardTitle>
          <CardDescription>
            <strong>{backupStatusLabel(project)}</strong>
            {" · "}
            Schritt: <strong>{stageLabel}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {backupStale ? (
            <div className="flex gap-2 rounded-lg border border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-50">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" />
              <span>
                Seit der letzten Sicherung geändert. Ohne aktuelle Sicherung sind{" "}
                {HISINONE_LABEL}-Export und PDF-Dokumente gesperrt.
              </span>
            </div>
          ) : (
            <p className="text-sm text-emerald-700 dark:text-emerald-300">
              Aktuell gesichert – seither keine Änderungen.
            </p>
          )}
          <p className="break-all font-mono text-xs text-muted-foreground">
            Dateiname: {filenamePreview}
          </p>
          {message && (
            <p className="text-sm text-emerald-700 dark:text-emerald-300">
              {message}
            </p>
          )}
        </CardContent>
      </Card>

      <MoreOptions label="Wiederherstellen und Hinweise">
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>
            Wiederherstellen: auf der Startseite die JSON-Datei importieren
            (bei gleicher Prüfung wird nachgefragt).
          </li>
          <li>
            Dateinamen unterscheiden die Schritte (…_nach-Import /
            …_nach-Zuordnung / …_nach-Noten).
          </li>
          <li>
            Notenliste, {HISINONE_LABEL}-Excel und Notenspiegel stehen unter{" "}
            <Link href={`/exam/${id}/documents`} className="text-primary underline-offset-2 hover:underline">
              Dokumente
            </Link>
            ; dort auch die Export-Prüfung.
          </li>
          <li>In MS Teams können Downloads blockiert sein – ggf. im Browser öffnen.</li>
        </ul>
      </MoreOptions>
    </div>
  );
}
