"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { HardDrive, ShieldAlert } from "lucide-react";
import { useExamContext } from "@/components/exam/exam-context";
import { Button } from "@/components/ui/button";
import { downloadAndMarkBackup } from "@/lib/backup-actions";
import {
  backupStatusLabel,
  isBackupStale,
} from "@/lib/backup-status";
import { cn } from "@/lib/utils";

export function BackupBanner() {
  const { id } = useParams<{ id: string }>();
  const { project, setProject } = useExamContext();

  if (!project || !isBackupStale(project)) return null;

  return (
    <div
      role="alert"
      className={cn(
        "border-b border-amber-500 bg-amber-50 px-4 py-3 text-amber-950",
        "dark:border-amber-600 dark:bg-amber-950/60 dark:text-amber-50"
      )}
    >
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-start gap-3">
        <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-300" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-semibold">
            Datensicherung erforderlich
          </p>
          <p className="text-sm leading-snug opacity-95">
            Prüfungsdaten liegen <strong>nur in diesem Browser</strong>{" "}
            (IndexedDB) – nicht auf dem Server. Bitte JSON-Sicherung
            herunterladen und neben den Klausur-Excel-Dateien ablegen.
            HISinOne-Export und PDF-Dokumente sind gesperrt, bis die Sicherung
            erfolgt ist.
          </p>
          <p className="text-xs opacity-80">
            Status: {backupStatusLabel(project)} · Die Sicherung enthält alle
            Daten; Pfade zu Original-Excel werden nicht benötigt.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            className="bg-amber-800 text-white hover:bg-amber-900 dark:bg-amber-600 dark:hover:bg-amber-500"
            onClick={() => downloadAndMarkBackup(project, setProject)}
          >
            <HardDrive className="size-4" />
            Jetzt sichern
          </Button>
          <Link
            href={`/exam/${id}/export#sicherung`}
            className="inline-flex h-7 items-center rounded-lg border border-amber-700/40 bg-white/60 px-2.5 text-[0.8rem] font-medium hover:bg-white dark:border-amber-500/40 dark:bg-amber-950/40"
          >
            Zur Export-Seite
          </Link>
        </div>
      </div>
    </div>
  );
}
