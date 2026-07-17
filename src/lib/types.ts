/** ExamGrade – Kerndatenmodell (Excel-Workflow HIS → Antritt → Punkte → Note) */

export type MatriculationKey = string;

export type ExamType = "the" | "written" | "other";

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
  comment?: string;
  source: PointsSource;
  /** Punkte pro Aufgabe (questionId) */
  byQuestion?: Record<string, number | null>;
  /** Offene manuelle Bewertungen */
  needsGrading?: string[];
}

export interface HISTemplateRow {
  matriculationNumber: string;
  lastName: string;
  firstName: string;
  orderIndex: number;
  /** Verweis auf HisSource.id (Multi-Studiengang) */
  sourceId?: string;
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
  headerRowIndex?: number;
  dataStartRowIndex?: number;
  format?: HisFileFormat;
  /** Original-Header für Re-Export */
  headerColumns?: string[];
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

  importLogs: ImportLogEntry[];
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
  passRate: number | null;
  averagePoints: number | null;
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
  the: "Take-Home-Exam",
  written: "Klausur",
  other: "Sonstige",
};

export const GERMAN_GRADES = [
  1.0, 1.3, 1.7, 2.0, 2.3, 2.7, 3.0, 3.3, 3.7, 4.0, 5.0,
] as const;
