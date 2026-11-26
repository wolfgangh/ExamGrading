"use client";

import type { EnrichedStudentRow } from "@/lib/types";
import { HISINONE_LABEL } from "@/lib/types";
import { takeoverNotice } from "@/lib/manual-participants";
import { cn } from "@/lib/utils";

/**
 * Kennzeichnung der Herkunft: „manuell“ (manuelle Teilnehmerliste) bzw.
 * Hinweis nach Übernahme aus der manuellen Liste in eine HISinOne-Datei.
 */
export function ParticipantSourceBadges({
  row,
  className,
}: {
  row: Pick<EnrichedStudentRow, "fromManualList" | "student">;
  className?: string;
}) {
  const notice = takeoverNotice(row.student);
  if (!row.fromManualList && !notice) return null;
  return (
    <span className={cn("inline-flex flex-wrap gap-1 align-middle", className)}>
      {row.fromManualList && (
        <span
          className="rounded border border-sky-500/60 bg-sky-50 px-1 py-px text-[0.625rem] font-medium text-sky-900 dark:bg-sky-950/60 dark:text-sky-100"
          title={`Manuelle Teilnehmerliste – keine ${HISINONE_LABEL}-Datei; Notenmeldung über Excel-Notenliste / manuelle Notenmeldung`}
        >
          manuell
        </span>
      )}
      {notice && (
        <span
          className="rounded border border-amber-500/60 bg-amber-50 px-1 py-px text-[0.625rem] font-medium text-amber-950 dark:bg-amber-950/60 dark:text-amber-50"
          title={notice}
        >
          von manuell → {HISINONE_LABEL}
        </span>
      )}
    </span>
  );
}
