/** Katalog der OTH-Prüfungen und Dozenten für den Anlege-Dialog */

export interface CatalogSubArea {
  name: string;
  code: string;
  maxPoints: number;
}

export interface ExamCatalogEntry {
  code: string;
  name: string;
  /** Anzeige in Dropdown inkl. Kürzel */
  label: string;
  /** Nur bei FI und MAP vorbefüllt */
  subAreas?: CatalogSubArea[];
  defaultMaxPoints: number;
}

export const EXAM_CATALOG: ExamCatalogEntry[] = [
  {
    code: "FI",
    name: "Finanzierung und Investition",
    label: "Finanzierung und Investition (FI)",
    defaultMaxPoints: 90,
    subAreas: [
      { name: "Finanzierung", code: "F", maxPoints: 45 },
      { name: "Investition", code: "I", maxPoints: 45 },
    ],
  },
  {
    code: "FAM",
    name: "Finanzmärkte und Asset Management",
    label: "Finanzmärkte und Asset Management (FAM)",
    defaultMaxPoints: 90,
  },
  {
    code: "DFI",
    name: "Digital Finance",
    label: "Digital Finance (DFI)",
    defaultMaxPoints: 90,
  },
  {
    code: "RMT",
    name: "Risikomanagement",
    label: "Risikomanagement (RMT)",
    defaultMaxPoints: 90,
  },
  {
    code: "MAP",
    name: "Mergers & Acquisitions und Performance-Messung",
    label: "Mergers & Acquisitions und Performance-Messung (MAP)",
    defaultMaxPoints: 90,
    subAreas: [
      { name: "MAC", code: "MAC", maxPoints: 45 },
      { name: "PEM", code: "PEM", maxPoints: 45 },
    ],
  },
  {
    code: "DSR",
    name: "Data Science with R",
    label: "Data Science with R (DSR)",
    defaultMaxPoints: 90,
  },
  {
    code: "DIL",
    name: "Digital Lab",
    label: "Digital Lab (DIL)",
    defaultMaxPoints: 90,
  },
  {
    code: "WDK",
    name: "Workflow-basierte Datenanalyse mit KNIME",
    label: "Workflow-basierte Datenanalyse mit KNIME (WDK)",
    defaultMaxPoints: 90,
  },
  {
    code: "FMP",
    name: "Financial Modeling and Prediction",
    label: "Financial Modeling and Prediction (FMP)",
    defaultMaxPoints: 90,
  },
];

export const EXAM_NAME_OPTIONS = EXAM_CATALOG.map((e) => e.label);

export const LECTURER_OPTIONS = [
  "Prof. Dr. Wolfgang Hößl",
  "Prof. Dr. Jürgen Schöntag",
  "Prof. Dr. Süzeroglu-Melchiors",
  "Prof. Dr. Olga Bergmeier",
] as const;

export const DEFAULT_LECTURER = "Prof. Dr. Wolfgang Hößl";
export const CO_LECTURER_SCHOENTAG = "Prof. Dr. Jürgen Schöntag";

/**
 * Standard-Dozenten je Prüfung:
 * FI und MAP → Hößl + Schöntag, sonst nur Hößl.
 */
export function defaultLecturersForExam(
  examNameOrLabel: string
): string[] {
  const entry = findCatalogEntry(examNameOrLabel);
  if (entry?.code === "FI" || entry?.code === "MAP") {
    return [DEFAULT_LECTURER, CO_LECTURER_SCHOENTAG];
  }
  return [DEFAULT_LECTURER];
}

/** Match Label, Name oder „Name (CODE)“ */
export function findCatalogEntry(
  input: string
): ExamCatalogEntry | undefined {
  const t = input.trim();
  if (!t) return undefined;
  return EXAM_CATALOG.find(
    (e) =>
      e.label === t ||
      e.name === t ||
      e.code.toLowerCase() === t.toLowerCase() ||
      t.toLowerCase() === `${e.name.toLowerCase()} (${e.code.toLowerCase()})`
  );
}

/** Teilgebiete für Anlege-Dialog aus Katalog oder Fallback „Gesamt“ */
export function resolveSubAreasForExamName(
  examNameOrLabel: string
): CatalogSubArea[] {
  const entry = findCatalogEntry(examNameOrLabel);
  if (entry?.subAreas?.length) {
    return entry.subAreas.map((sa) => ({ ...sa }));
  }
  const max = entry?.defaultMaxPoints ?? 90;
  const code = entry?.code ?? "G";
  return [{ name: "Gesamt", code, maxPoints: max }];
}

/** Anzeigename ohne „(CODE)“-Suffix speichern, wenn Katalog-Treffer */
export function resolveExamDisplayName(examNameOrLabel: string): string {
  const entry = findCatalogEntry(examNameOrLabel);
  return entry?.name ?? examNameOrLabel.trim();
}
