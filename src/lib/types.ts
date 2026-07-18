/** ExamGrade – Kerndatenmodell (Excel-Workflow HIS → Antritt → Punkte → Note) */

export type MatriculationKey = string;

/**
 * the / elektr_p: Antritt selbst ausgefüllt, Moodle-Punkte, Matrikel-Zuordnung
 * (elektrP = Ablauf wie THE, Prüfung vor Ort an der Hochschule)
 */
export type ExamType = "the" | "elektr_p" | "written" | "other";

export type StudentStatus =
  | "registered"
  | "attended"
  | "points"
  | "graded"
  | "export_ready"
  | "no_show"
  | "mismatch";

export type ImportType = "his" | "attendance" | "points";

export type PointsSource = "moodle" | "manual" | "import" | "mixed";

export interface SubArea {
  id: string;
  name: string;
  code: string;
  maxPoints: number;
  weight?: number;
}

export interface GradeThreshold {
  /** Deutsche Note z. B. 1.0, 1.3, …, 5.0 */
  grade: number;
  /** Mindestpunkte für diese Note */
  minPoints: number;
}

export interface GradeSchema {
  mode: "points";
  maxPoints: number;
  passThreshold: number;
  /** absteigend nach minPoints */
  thresholds: GradeThreshold[];
  /** wie Excel ROUNDUP vor Notenbildung */
  roundPointsUp: boolean;
}

/** Ein Notenszenario (Bestehensgrenze → Schwellen) */
export interface GradeScenario {
  id: string;
  name: string;
  passThreshold: number;
  /** true = Nutzer darf Bestehensgrenze ändern (Szenario 3) */
  editable: boolean;
  /**
   * Sichtbar/wählbar. Presets sind immer aktiv;
   * editierbares Szenario standardmäßig `false`.
   */
  enabled?: boolean;
  schema: GradeSchema;
}

export interface Student {
  matriculationNumber: string;
  lastName: string;
  firstName: string;
  email?: string;
  attempt?: number | null;
}

export interface AttendanceRecord {
  matriculationNumber: string;
  attended: boolean;
  sourceRow?: number;
}

/** Aufgabe aus THE-Import (F 1 /10,00 …) */
export interface QuestionDef {
  id: string;
  label: string;
  maxPoints: number;
  orderIndex: number;
  subAreaId?: string;
}

export interface PointsRecord {
  matriculationNumber: string;
  bySubArea: Record<string, number | null>;
  /** Berechnet aus byQuestion oder Import – nicht manuell setzen */
  totalPoints: number | null;
  /** @deprecated nicht mehr über UI */
  totalOverride?: number | null;
  gradeOverride?: number | null;
  /**
   * Note vor manueller Korrektur (Klausureinsicht).
   * Wird beim ersten Setzen von gradeOverride aus der berechneten Note übernommen.
   */
  previousGrade?: number | null;
  comment?: string;
  source: PointsSource;
  /** Punkte pro Aufgabe (questionId) */
  byQuestion?: Record<string, number | null>;
  /** Offene manuelle Bewertungen */
  needsGrading?: string[];
  /** Manueller Studiengang, wenn nicht aus HIS ableitbar */
  manualProgramCode?: string | null;
  /** Zweitkorrektur-Punkte (Durchfaller) */
  secondCorrectionPoints?: number | null;
  /** Anmerkungen zur Zweitkorrektur */
  secondCorrectionNotes?: string;
}

export interface HISTemplateRow {
  matriculationNumber: string;
  lastName: string;
  firstName: string;
  orderIndex: number;
  /** Verweis auf HisSource.id (Multi-Studiengang) */
  sourceId?: string;
  /** 1-basierte Excel-Zeile in der Originalvorlage */
  sourceExcelRow?: number;
  examPlanId?: string;
  examNumber?: string;
  title?: string;
  status?: string;
  leistung?: string | number | null;
  vermerk?: string;
  semester?: string;
  year?: string | number;
  extra?: Record<string, unknown>;
}

export type HisFileFormat = "legacy" | "hisinone_v2";

export interface HisTemplateMeta {
  titleCell?: string;
  /** aus HISinOne-Titelzeile / Spalte PrüfungsNr. */
  examNumber?: string;
  examCheckToken?: string;
  lecturers?: string[];
  semesterLabel?: string;
  examPeriod?: string;
  originalFileName?: string;
  /** 0-basiert (Matrix) – Header-Zeile */
  headerRowIndex?: number;
  dataStartRowIndex?: number;
  format?: HisFileFormat;
  /** Original-Header für Re-Export */
  headerColumns?: string[];
  /** 0-basierter Spaltenindex Matrikelnummer */
  matriculationColIndex?: number;
  /** 0-basierter Spaltenindex Note (Leistung/bewertung) */
  leistungColIndex?: number;
  /** Blattname der Originalvorlage */
  sheetName?: string;
}

/** Eine HISinOne-Quelle = ein Studiengang / eine Prüfungsnummer */
export interface HisSource {
  id: string;
  /** z. B. MEB, MBW */
  programCode: string;
  /** z. B. "MEB 20242 8010260 RMT" */
  examNumber: string;
  label: string;
  originalFileName?: string;
  /** Original-.xlsx (Base64) für formatgetreuen HisinOne-Export */
  originalXlsxBase64?: string;
  /** Arbeitsblatt der Vorlage beim Import */
  sheetName?: string;
  meta: HisTemplateMeta;
  rows: HISTemplateRow[];
}

export interface ImportLogEntry {
  at: string;
  type: ImportType;
  fileName: string;
  rowCount: number;
  matched: number;
  unmatched: number;
  warnings: string[];
  errors: string[];
}

/**
 * Manuelle Zusammenführung einer fehlerhaften Antritts-/Punkte-Matrikel
 * mit der korrekten HISinOne-Matrikel (THE/elektrP: Tippfehler in der Antrittsliste).
 * Nie automatisch – nur nach Prüfer-Freigabe.
 */
export interface IdentityMerge {
  id: string;
  at: string;
  examType: ExamType;
  /** Falsche Matr. (Antritt/Punkte) */
  sourceMatriculation: string;
  /** Korrekte HISinOne-Matr. */
  targetMatriculation: string;
  sourceSnapshot: {
    lastName: string;
    firstName: string;
    email?: string;
    totalPoints?: number | null;
    finalGrade?: number | null;
  };
  targetSnapshot: {
    lastName: string;
    firstName: string;
    statusBefore: string;
  };
  /** Für Undo: vollständige Datensätze vor dem Merge */
  sourcePointsRecord?: PointsRecord | null;
  sourceStudent?: Student | null;
  sourceAttended?: boolean;
  targetPointsBefore?: PointsRecord | null;
  targetAttendedBefore?: boolean | null;
  /** Pflicht: Prüfer-Begründung */
  reason: string;
  /** z. B. „nach Abgleich HISinOne-Dokument und Antrittsdaten“ */
  confirmedByNote: string;
  active: boolean;
  /** Undo-Dokumentation */
  undoneAt?: string;
  undoReason?: string;
  undoConfirmedByNote?: string;
}

/**
 * Orphan geprüft und bewusst nicht zusammengeführt
 * (kein Tippfehler / andere Person / …).
 */
export interface IdentityDismissal {
  id: string;
  at: string;
  examType: ExamType;
  sourceMatriculation: string;
  sourceSnapshot: {
    lastName: string;
    firstName: string;
    email?: string;
    totalPoints?: number | null;
    finalGrade?: number | null;
  };
  reason: string;
  confirmedByNote: string;
  active: boolean;
  /** true bei Sammelablehnung „ohne Vorschlag“ */
  bulk?: boolean;
  /** Undo-Dokumentation */
  undoneAt?: string;
  undoReason?: string;
  undoConfirmedByNote?: string;
}

export interface ExamProject {
  id: string;
  createdAt: string;
  updatedAt: string;
  /** 1 = gradeSchema; 2 = scenarios; 3 = multi HIS sources */
  schemaVersion: 1 | 2 | 3;

  name: string;
  /** Anzeige: eine oder mehrere Prüfungsnummern (kommagetrennt) */
  examNumber: string;
  semester: string;
  lecturers: string[];
  examType: ExamType;
  subAreas: SubArea[];
  /** Spiegel des aktiven Szenarios (Export / Matching) */
  gradeSchema: GradeSchema;
  /** Drei Szenarien: 45, 40, editierbar */
  gradeScenarios?: GradeScenario[];
  activeScenarioId?: string;

  /** Mehrere HIS-Quellen (Studiengänge) */
  hisSources?: HisSource[];
  /** Ab v3 aus hisSources abgeleitet (Kompatibilität) */
  hisRows: HISTemplateRow[];
  hisTemplateMeta?: HisTemplateMeta;
  attendance: AttendanceRecord[];
  points: PointsRecord[];
  students: Record<MatriculationKey, Student>;
  /** Aufgaben aus THE-Import */
  questionDefs?: QuestionDef[];

  /**
   * Dokumentierte manuelle Matrikel-Zusammenführungen (THE/elektrP).
   * Wirksam bereits durch physisches Verschieben von Antritt/Punkten;
   * Einträge dienen Audit und Hinweisen.
   */
  identityMerges?: IdentityMerge[];
  /** Orphans geprüft und abgelehnt (nicht zusammengeführt) */
  identityDismissals?: IdentityDismissal[];

  importLogs: ImportLogEntry[];

  /**
   * Letzte JSON-Projektsicherung (Download).
   * Daten liegen nur im Browser – ohne Sicherung droht Datenverlust.
   */
  lastBackupAt?: string;
  /**
   * `updatedAt` des Projekts zum Zeitpunkt der letzten Sicherung.
   * Backup ist veraltet, wenn `updatedAt !== lastBackupSyncedUpdatedAt`.
   */
  lastBackupSyncedUpdatedAt?: string;
}

/** Abgeleitetes Zeilenmodell für Tabellen/Export (nicht persistiert) */
export interface EnrichedStudentRow {
  key: MatriculationKey;
  student: Student;
  inHis: boolean;
  attended: boolean | null;
  hasPoints: boolean;
  totalPoints: number | null;
  percent: number | null;
  calculatedGrade: number | null;
  finalGrade: number | null;
  status: StudentStatus;
  warnings: string[];
  subAreaPoints: Record<string, number | null>;
  gradeOverride: number | null;
  comment?: string;
  attempt?: number | null;
  orderIndex: number;
  /** Punkte bis zur nächstbesseren Note (aktives Szenario) */
  pointsToNext: number | null;
  nextGrade: number | null;
  /** Note > 4,0 und mit Bewertung */
  isFailed: boolean;
  /** Abstand zur Bestehensgrenze (positiv = darunter) */
  pointsBelowPass: number | null;
  /** Noten in allen Szenarien (Vergleich) */
  scenarioGrades: { scenarioId: string; name: string; grade: number | null }[];
  /** Studiengang / HIS-Quelle */
  hisSourceId?: string;
  programCode?: string;
  examNumber?: string;
  /** Matnr. kommt in mehreren HIS-Quellen vor */
  multiProgram?: boolean;
  /** In Antrittsliste, aber nicht in HIS */
  attendanceWithoutHis?: boolean;
  /** Offene Aufgabenbewertungen */
  needsGradingCount?: number;
  /** Aktive Zusammenführung: falsche Quell-Matr. */
  mergedFromMatriculation?: string;
}

export interface ExamStatistics {
  registered: number;
  /** Gematchte Antritte (HIS ∩ Moodle) */
  attended: number;
  /** Rohanzahl importierter Antrittszeilen */
  attendanceImported: number;
  /** Antritt ohne HIS-Match */
  attendedOrphan: number;
  noShow: number;
  /** null = keine Antrittsliste importiert */
  noShowRate: number | null;
  hasAttendanceList: boolean;
  withPoints: number;
  graded: number;
  exportReady: number;
  mismatches: number;
  averageGrade: number | null;
  medianGrade: number | null;
  /** Stichproben-Standardabweichung der Noten (n-1), null wenn n < 2 */
  stdDevGrade: number | null;
  passRate: number | null;
  averagePoints: number | null;
  medianPoints: number | null;
  stdDevPoints: number | null;
  failCount: number;
  borderlineCount: number;
  gradeDistribution: { grade: number; count: number }[];
  pointsHistogram: { bin: string; from: number; to: number; count: number }[];
}

export interface FailerAnalysis {
  count: number;
  averagePoints: number | null;
  medianPoints: number | null;
  nearPass: { within: number; count: number }[];
  rows: EnrichedStudentRow[];
}

export const STUDENT_STATUS_LABELS: Record<StudentStatus, string> = {
  registered: "Angemeldet",
  attended: "Angetreten",
  points: "Punkte vorhanden",
  graded: "Note berechnet",
  export_ready: "Exportbereit",
  no_show: "No-Show",
  mismatch: "Unstimmigkeit",
};

export const EXAM_TYPE_LABELS: Record<ExamType, string> = {
  the: "Take-Home-Exam (THE)",
  elektr_p: "Elektronische Prüfung (elektrP)",
  written: "Klausur",
  other: "Sonstige",
};

/** Anzeigename des Campus-Systems (UI; Code-Interna bleiben his*) */
export const HISINONE_LABEL = "HISinOne";

/**
 * THE und elektrP: selbst ausgefüllter Antritt, Moodle-Punkte, Matrikel-Zuordnung.
 * (elektrP: Prüfung vor Ort, Ablauf sonst wie THE)
 */
export function isOnlineStyleExam(examType: ExamType): boolean {
  return examType === "the" || examType === "elektr_p";
}

export const GERMAN_GRADES = [
  1.0, 1.3, 1.7, 2.0, 2.3, 2.7, 3.0, 3.3, 3.7, 4.0, 5.0,
] as const;
