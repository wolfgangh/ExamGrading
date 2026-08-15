import { createId } from "@/lib/id";
import type {
  ExamProject,
  HISTemplateRow,
  HisSource,
  HisTemplateMeta,
} from "@/lib/types";

/** Alle HIS-Zeilen (flach) aus Sources oder Legacy hisRows */
export function flattenHisRows(project: ExamProject): HISTemplateRow[] {
  if (project.hisSources && project.hisSources.length > 0) {
    return project.hisSources.flatMap((s) =>
      s.rows.map((r) => ({
        ...r,
        sourceId: r.sourceId ?? s.id,
      }))
    );
  }
  return project.hisRows ?? [];
}

export function getHisSources(project: ExamProject): HisSource[] {
  if (project.hisSources && project.hisSources.length > 0) {
    return project.hisSources;
  }
  if (project.hisRows?.length) {
    return [legacyToSource(project)];
  }
  return [];
}

function legacyToSource(project: ExamProject): HisSource {
  const id = createId("his");
  const examNumber =
    project.examNumber || project.hisTemplateMeta?.examNumber || "";
  const programCode = parseProgramCode(examNumber) ?? "ALL";
  return {
    id,
    programCode,
    examNumber,
    label: examNumber || "HIS",
    originalFileName: project.hisTemplateMeta?.originalFileName,
    meta: project.hisTemplateMeta ?? {},
    rows: (project.hisRows ?? []).map((r) => ({ ...r, sourceId: id })),
  };
}

/** MEB, MBW, BW, … aus Prüfungsnummer oder Dateiname */
export function parseProgramCode(
  text: string | undefined | null
): string | null {
  if (!text) return null;
  const m = text.trim().match(/^([A-Za-zÄÖÜäöü]{2,5})\b/);
  return m ? m[1].toUpperCase() : null;
}

/**
 * Dateiname: "MEB 20242 8010260 RMT-Risikomanagement-SoSe_2026-1.xlsx"
 */
export function parseHisFileName(fileName: string): {
  programCode: string | null;
  examNumber: string | null;
  label: string;
} {
  const base = fileName.replace(/\.(xlsx|xls|csv)$/i, "").trim();
  const m = base.match(
    /^([A-Za-z]{2,5})\s+(\d{4,5})\s+(\d{5,})\s+([A-Za-zÄÖÜäöü0-9]+)(?:[-_].*)?$/i
  );
  if (m) {
    const programCode = m[1].toUpperCase();
    const examNumber = `${programCode} ${m[2]} ${m[3]} ${m[4]}`.replace(
      /\s+/g,
      " "
    );
    return {
      programCode,
      examNumber,
      label: `${programCode} · ${m[4]}`,
    };
  }
  const code = parseProgramCode(base);
  return {
    programCode: code,
    examNumber: null,
    label: base.slice(0, 40),
  };
}

export function summarizeExamNumbers(sources: HisSource[]): string {
  const nums = sources.map((s) => s.examNumber).filter(Boolean);
  if (nums.length === 0) return "";
  if (nums.length === 1) return nums[0];
  return nums.join(", ");
}

export function buildHisSourceFromParse(input: {
  rows: HISTemplateRow[];
  meta: HisTemplateMeta;
  fileName: string;
  sourceId?: string;
  /** Original-.xlsx Base64 für formatgetreuen Export */
  originalXlsxBase64?: string;
  sheetName?: string;
}): HisSource {
  const id = input.sourceId ?? createId("his");
  const fromFile = parseHisFileName(input.fileName);
  const examNumber =
    input.meta.examNumber ||
    fromFile.examNumber ||
    input.rows.find((r) => r.examNumber)?.examNumber ||
    "";
  const programCode =
    parseProgramCode(examNumber) || fromFile.programCode || "ALL";

  const rows = input.rows.map((r, i) => ({
    ...r,
    sourceId: id,
    orderIndex: r.orderIndex ?? i,
    examNumber: r.examNumber || examNumber || undefined,
  }));

  return {
    id,
    programCode,
    examNumber,
    label: fromFile.label || `${programCode} · ${examNumber || "HIS"}`,
    originalFileName: input.fileName,
    originalXlsxBase64: input.originalXlsxBase64,
    sheetName: input.sheetName ?? input.meta.sheetName,
    meta: {
      ...input.meta,
      examNumber: examNumber || input.meta.examNumber,
      originalFileName: input.fileName,
      sheetName: input.sheetName ?? input.meta.sheetName,
    },
    rows,
  };
}

/** Quelle hat Originaldatei für HisinOne-Export */
export function hasOriginalHisTemplate(source: HisSource): boolean {
  return Boolean(source.originalXlsxBase64 && source.originalXlsxBase64.length > 0);
}

export function sourcesMissingOriginalTemplate(
  project: ExamProject
): HisSource[] {
  return getHisSources(project).filter((s) => !hasOriginalHisTemplate(s));
}

/** Sync legacy hisRows aus hisSources (Kompatibilität) */
export function syncLegacyHisFields(project: ExamProject): ExamProject {
  const sources =
    project.hisSources && project.hisSources.length > 0
      ? project.hisSources
      : getHisSources(project);
  const hisRows = flattenHisRows({ ...project, hisSources: sources });
  return {
    ...project,
    hisSources: sources,
    hisRows,
    hisTemplateMeta: sources[0]?.meta ?? project.hisTemplateMeta,
    examNumber: summarizeExamNumbers(sources) || project.examNumber,
    schemaVersion: (Math.max(project.schemaVersion ?? 1, 3) as 1 | 2 | 3),
  };
}

/**
 * Gleiche Prüfungsnr., aber andere Datei – nicht automatisch ersetzen.
 */
export function findHisSourceExamNumberConflict(
  project: ExamProject,
  source: Pick<HisSource, "id" | "examNumber" | "originalFileName">
): HisSource | null {
  const num = (source.examNumber || "").trim();
  if (!num) return null;
  const file = source.originalFileName || "";
  return (
    getHisSources(project).find((s) => {
      if (s.id === source.id) return false;
      if ((s.examNumber || "").trim() !== num) return false;
      return (s.originalFileName || "") !== file;
    }) ?? null
  );
}

export function upsertHisSource(
  project: ExamProject,
  source: HisSource,
  options?: { replaceSourceId?: string }
): ExamProject {
  const existing = getHisSources(project);
  const idx = existing.findIndex((s) => {
    if (options?.replaceSourceId && s.id === options.replaceSourceId) {
      return true;
    }
    if (s.id === source.id) return true;
    if (
      s.originalFileName &&
      source.originalFileName &&
      s.originalFileName === source.originalFileName
    ) {
      return true;
    }
    return false;
  });
  const next =
    idx >= 0
      ? existing.map((s, i) =>
          i === idx ? { ...source, id: s.id } : s
        )
      : [...existing, source];
  return syncLegacyHisFields({ ...project, hisSources: next });
}

export function removeHisSource(
  project: ExamProject,
  sourceId: string
): ExamProject {
  const next = getHisSources(project).filter((s) => s.id !== sourceId);
  return syncLegacyHisFields({
    ...project,
    hisSources: next,
    hisRows: next.length ? project.hisRows : [],
  });
}
