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

export interface PointsRecord {
  matriculationNumber: string;
  bySubArea: Record<string, number | null>;
  totalPoints: number | null;
  totalOverride?: number | null;
  gradeOverride?: number | null;
  comment?: string;
  source: PointsSource;
}

export interface HISTemplateRow {
  matriculationNumber: string;
  lastName: string;
  firstName: string;
  orderIndex: number;
  extra?: Record<string, unknown>;
}

export interface HisTemplateMeta {
  titleCell?: string;
  lecturers?: string[];
  originalFileName?: string;
  headerRowIndex?: number;
  dataStartRowIndex?: number;
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
  schemaVersion: 1;

  name: string;
  examNumber: string;
  semester: string;
  lecturers: string[];
  examType: ExamType;
  subAreas: SubArea[];
  gradeSchema: GradeSchema;

  hisRows: HISTemplateRow[];
  hisTemplateMeta?: HisTemplateMeta;
  attendance: AttendanceRecord[];
  points: PointsRecord[];
  students: Record<MatriculationKey, Student>;

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
}

export interface ExamStatistics {
  registered: number;
  attended: number;
  noShow: number;
  noShowRate: number | null;
  withPoints: number;
  graded: number;
  exportReady: number;
  mismatches: number;
  averageGrade: number | null;
  medianGrade: number | null;
  passRate: number | null;
  averagePoints: number | null;
  gradeDistribution: { grade: number; count: number }[];
  pointsHistogram: { bin: string; from: number; to: number; count: number }[];
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
