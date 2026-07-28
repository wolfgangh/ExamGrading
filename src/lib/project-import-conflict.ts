import {
  EXAM_TYPE_LABELS,
  type ExamProject,
} from "@/lib/types";

export type ExamMatchResult = {
  matches: ExamProject[];
  /** true wenn per Projekt-Id gematcht */
  byId: boolean;
};

export type ProjectImportSummary = {
  name: string;
  semester: string;
  examType: string;
  examTypeLabel: string;
  examNumber: string;
  updatedAt: string;
  createdAt: string;
  lastBackupAt?: string;
  hisCount: number;
  attendanceCount: number;
  pointsRecords: number;
  peopleWithPoints: number;
  gradeOverrideCount: number;
  notAttendedCount: number;
  lecturersCount: number;
  groupsCount: number;
};

export type ProjectImportDiffRow = {
  key: string;
  label: string;
  local: string;
  imported: string;
  /** Am neueren updatedAt – nur bei Zeitstempel-Zeilen */
  newerSide?: "local" | "imported" | "equal";
  /** Werte unterscheiden sich */
  differs: boolean;
};

function normalizeName(name: string): string {
  return (name || "").trim().toLocaleLowerCase("de");
}

function ts(iso: string | undefined): number {
  if (!iso) return 0;
  const n = new Date(iso).getTime();
  return Number.isFinite(n) ? n : 0;
}

function hasPointData(p: ExamProject["points"][number]): boolean {
  if (p.totalPoints != null && Number.isFinite(p.totalPoints)) return true;
  if (p.totalOverride != null && Number.isFinite(p.totalOverride)) return true;
  if (
    p.bySubArea &&
    Object.values(p.bySubArea).some((v) => v != null && Number.isFinite(v))
  ) {
    return true;
  }
  if (
    p.byQuestion &&
    Object.values(p.byQuestion).some((v) => v != null && Number.isFinite(v))
  ) {
    return true;
  }
  if (p.gradeOverride != null && Number.isFinite(p.gradeOverride)) return true;
  if (p.notAttended) return true;
  return false;
}

/**
 * Findet bereits gespeicherte Prüfungen, die zur importierten passen.
 * 1) gleiche id · 2) Name + Semester + examType (+ examNumber wenn beide gesetzt)
 */
export function findExistingExamMatches(
  imported: ExamProject,
  existing: ExamProject[]
): ExamMatchResult {
  const byId = existing.filter((e) => e.id === imported.id);
  if (byId.length > 0) {
    return { matches: byId, byId: true };
  }

  const name = normalizeName(imported.name);
  const semester = (imported.semester || "").trim();
  const examType = imported.examType;
  const examNumber = (imported.examNumber || "").trim();

  const matches = existing
    .filter((e) => {
      if (normalizeName(e.name) !== name) return false;
      if ((e.semester || "").trim() !== semester) return false;
      if (e.examType !== examType) return false;
      const en = (e.examNumber || "").trim();
      if (examNumber && en && examNumber !== en) return false;
      return true;
    })
    .sort((a, b) => ts(b.updatedAt) - ts(a.updatedAt));

  return { matches, byId: false };
}

export function summarizeProjectForCompare(
  p: ExamProject
): ProjectImportSummary {
  const points = p.points ?? [];
  return {
    name: (p.name || "").trim() || "—",
    semester: (p.semester || "").trim() || "—",
    examType: p.examType,
    examTypeLabel: EXAM_TYPE_LABELS[p.examType] ?? p.examType,
    examNumber: (p.examNumber || "").trim() || "—",
    updatedAt: p.updatedAt || "",
    createdAt: p.createdAt || "",
    lastBackupAt: p.lastBackupAt,
    hisCount: p.hisRows?.length ?? 0,
    attendanceCount: p.attendance?.length ?? 0,
    pointsRecords: points.length,
    peopleWithPoints: points.filter(hasPointData).length,
    gradeOverrideCount: points.filter(
      (r) => r.gradeOverride != null && Number.isFinite(r.gradeOverride)
    ).length,
    notAttendedCount: points.filter((r) => r.notAttended).length,
    lecturersCount: p.lecturers?.length ?? 0,
    groupsCount: p.studentGroups?.length ?? 0,
  };
}

export function formatImportDateTime(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function row(
  key: string,
  label: string,
  local: string,
  imported: string,
  extra?: Partial<ProjectImportDiffRow>
): ProjectImportDiffRow {
  return {
    key,
    label,
    local,
    imported,
    differs: local !== imported,
    ...extra,
  };
}

/**
 * Vergleichszeilen für den Konflikt-Dialog.
 * Meta-Felder nur bei Unterschied; Zähler immer.
 */
export function buildProjectImportDiffRows(
  local: ExamProject,
  imported: ExamProject
): ProjectImportDiffRow[] {
  const L = summarizeProjectForCompare(local);
  const I = summarizeProjectForCompare(imported);
  const localTs = ts(L.updatedAt);
  const importTs = ts(I.updatedAt);
  let newerSide: "local" | "imported" | "equal" = "equal";
  if (localTs > importTs) newerSide = "local";
  else if (importTs > localTs) newerSide = "imported";

  const rows: ProjectImportDiffRow[] = [
    row(
      "updatedAt",
      "Zuletzt geändert",
      formatImportDateTime(L.updatedAt),
      formatImportDateTime(I.updatedAt),
      { newerSide, differs: localTs !== importTs }
    ),
  ];

  if (L.lastBackupAt || I.lastBackupAt) {
    rows.push(
      row(
        "lastBackupAt",
        "Letzte Sicherung (im Projekt)",
        formatImportDateTime(L.lastBackupAt),
        formatImportDateTime(I.lastBackupAt)
      )
    );
  }

  if (L.name !== I.name) {
    rows.push(row("name", "Name", L.name, I.name));
  }
  if (L.semester !== I.semester) {
    rows.push(row("semester", "Semester", L.semester, I.semester));
  }
  if (L.examType !== I.examType) {
    rows.push(
      row("examType", "Prüfungsform", L.examTypeLabel, I.examTypeLabel)
    );
  }
  if (L.examNumber !== I.examNumber) {
    rows.push(row("examNumber", "Prüfungsnr.", L.examNumber, I.examNumber));
  }

  rows.push(
    row("his", "HIS-Zeilen", String(L.hisCount), String(I.hisCount)),
    row(
      "attendance",
      "Antritte",
      String(L.attendanceCount),
      String(I.attendanceCount)
    ),
    row(
      "points",
      "Punkte-Datensätze",
      String(L.pointsRecords),
      String(I.pointsRecords)
    ),
    row(
      "withPoints",
      "Mit Punkten/Bewertung",
      String(L.peopleWithPoints),
      String(I.peopleWithPoints)
    ),
    row(
      "overrides",
      "Manuelle Noten",
      String(L.gradeOverrideCount),
      String(I.gradeOverrideCount)
    ),
    row(
      "noShow",
      "No-Show",
      String(L.notAttendedCount),
      String(I.notAttendedCount)
    ),
    row(
      "lecturers",
      "Dozent:innen",
      String(L.lecturersCount),
      String(I.lecturersCount)
    ),
    row(
      "groups",
      "Gruppen",
      String(L.groupsCount),
      String(I.groupsCount)
    )
  );

  return rows;
}

export function countContentDiffs(rows: ProjectImportDiffRow[]): number {
  return rows.filter((r) => r.key !== "updatedAt" && r.differs).length;
}

/**
 * Sichtbare Unterscheidung einer Import-Kopie (Name-Suffix + Metadaten).
 */
export function labelImportedCopy(
  project: ExamProject,
  ofName: string,
  ofId: string,
  at: Date = new Date()
): ExamProject {
  const stamp = at.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const base = (project.name || "").trim() || "Prüfung";
  // Kein doppeltes Import-Suffix, wenn Name schon eines trägt
  const withoutOldSuffix = base.replace(
    /\s*\(Import \d{2}\.\d{2}\.\d{4}[, ]+\d{2}:\d{2}\)\s*$/u,
    ""
  );
  return {
    ...project,
    name: `${withoutOldSuffix} (Import ${stamp})`,
    importedAsCopyAt: at.toISOString(),
    importedAsCopyOfName: ofName,
    importedAsCopyOfId: ofId,
  };
}

/** Metadaten einer früheren Import-Kopie entfernen (z. B. beim Ersetzen). */
export function clearImportedCopyMeta(project: ExamProject): ExamProject {
  const next = { ...project };
  delete next.importedAsCopyAt;
  delete next.importedAsCopyOfName;
  delete next.importedAsCopyOfId;
  return next;
}
