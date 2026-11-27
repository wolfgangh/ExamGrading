import { createId } from "@/lib/id";
import type {
  ExamProject,
  HISTemplateRow,
  HisSource,
  Student,
} from "@/lib/types";
import { isHisManualAssessmentExam } from "@/lib/types";
import { getHisSources, syncLegacyHisFields } from "@/lib/his-sources";
import { normalizeMatriculation } from "@/lib/matching/matriculation";
import { cellToString, detectField } from "@/lib/excel/column-detect";

/**
 * Manuelle Teilnehmerliste: Personen ohne HISinOne-Datei (z. B. berufsbegleitende
 * Studiengänge). Technisch eine HisSource mit kind "manual" ohne Originalvorlage –
 * gleichrangig zu HISinOne-Dateien (zählt als angemeldet, Antritt/Punkte/Export).
 */
export const MANUAL_SOURCE_LABEL = "Manuelle Teilnehmerliste";

export type ManualParticipantInput = {
  matriculationNumber: string;
  lastName: string;
  firstName: string;
  programCode?: string | null;
  email?: string | null;
  attempt?: number | null;
  groupId?: string | null;
};

export type ManualParticipantIssue = {
  /** 1-basierte Zeile der Eingabe (Einfügen/Datei) */
  line?: number;
  input: Partial<ManualParticipantInput>;
  reason: string;
};

export function isManualSource(source: Pick<HisSource, "kind">): boolean {
  return source.kind === "manual";
}

/** HISinOne-Dateien (ohne manuelle Liste) */
export function getHisinoneSources(project: ExamProject): HisSource[] {
  return getHisSources(project).filter((s) => !isManualSource(s));
}

export function getManualSource(project: ExamProject): HisSource | null {
  return getHisSources(project).find(isManualSource) ?? null;
}

export function listManualParticipants(project: ExamProject): HISTemplateRow[] {
  return getManualSource(project)?.rows ?? [];
}

function emptyManualSource(): HisSource {
  return {
    id: createId("man"),
    kind: "manual",
    programCode: "",
    examNumber: "",
    label: MANUAL_SOURCE_LABEL,
    meta: {},
    rows: [],
  };
}

/** Manuelle Quelle ersetzen/anlegen (immer als letzte Quelle). */
function withManualRows(
  project: ExamProject,
  rows: HISTemplateRow[]
): ExamProject {
  const his = getHisinoneSources(project);
  const current = getManualSource(project) ?? emptyManualSource();
  const manual: HisSource = {
    ...current,
    rows: rows.map((r, i) => ({ ...r, sourceId: current.id, orderIndex: i })),
  };
  const sources = manual.rows.length > 0 ? [...his, manual] : his;
  return syncLegacyHisFields({
    ...project,
    hisSources: sources,
    hisRows: sources.length ? project.hisRows : [],
  });
}

function keyOf(raw: string | null | undefined): string | null {
  return normalizeMatriculation(raw ?? "");
}

function existingKeys(project: ExamProject): Set<string> {
  const keys = new Set<string>();
  for (const s of getHisSources(project)) {
    for (const r of s.rows) {
      const k = keyOf(r.matriculationNumber);
      if (k) keys.add(k);
    }
  }
  return keys;
}

function validateInput(
  input: Partial<ManualParticipantInput>
): { ok: true; key: string } | { ok: false; reason: string } {
  const key = keyOf(input.matriculationNumber);
  if (!key) return { ok: false, reason: "Matrikelnummer fehlt oder ungültig" };
  if (!input.lastName?.trim()) return { ok: false, reason: "Nachname fehlt" };
  if (!input.firstName?.trim()) return { ok: false, reason: "Vorname fehlt" };
  if (
    input.attempt != null &&
    !(Number.isInteger(input.attempt) && input.attempt >= 1 && input.attempt <= 3)
  ) {
    return { ok: false, reason: "Versuch muss 1, 2 oder 3 sein" };
  }
  return { ok: true, key };
}

/**
 * Teilnehmer zur manuellen Liste hinzufügen.
 * Abgelehnt: Pflichtfeld fehlt, Matrikelnummer schon in HISinOne/manueller
 * Liste oder doppelt in der Eingabe.
 */
export function addManualParticipants(
  project: ExamProject,
  inputs: (Partial<ManualParticipantInput> & { line?: number })[]
): { project: ExamProject; added: number; issues: ManualParticipantIssue[] } {
  const taken = existingKeys(project);
  const hisKeys = new Set<string>();
  for (const s of getHisinoneSources(project)) {
    for (const r of s.rows) {
      const k = keyOf(r.matriculationNumber);
      if (k) hisKeys.add(k);
    }
  }
  const issues: ManualParticipantIssue[] = [];
  const newRows: HISTemplateRow[] = [];
  const students: Record<string, Student> = { ...project.students };

  for (const input of inputs) {
    const v = validateInput(input);
    if (!v.ok) {
      issues.push({ line: input.line, input, reason: v.reason });
      continue;
    }
    if (taken.has(v.key)) {
      issues.push({
        line: input.line,
        input,
        reason: hisKeys.has(v.key)
          ? "bereits in einer HISinOne-Datei"
          : "bereits in der Teilnehmerliste",
      });
      continue;
    }
    taken.add(v.key);
    const lastName = input.lastName!.trim();
    const firstName = input.firstName!.trim();
    newRows.push({
      matriculationNumber: v.key,
      lastName,
      firstName,
      orderIndex: 0,
      programCode: input.programCode?.trim() || undefined,
    });
    const prev = students[v.key];
    students[v.key] = {
      ...prev,
      matriculationNumber: v.key,
      lastName,
      firstName,
      email: input.email?.trim() || prev?.email,
      attempt: input.attempt ?? prev?.attempt ?? null,
      groupId: input.groupId ?? prev?.groupId ?? null,
    };
  }

  if (newRows.length === 0) return { project, added: 0, issues };
  const next = withManualRows(
    { ...project, students },
    [...listManualParticipants(project), ...newRows]
  );
  return { project: next, added: newRows.length, issues };
}

/** Bewertungen/Einträge zu einer Person vorhanden? (Rückfrage vor Löschen) */
export function participantHasAssessment(
  project: ExamProject,
  key: string
): boolean {
  const rec = project.points.find(
    (p) => normalizeMatriculation(p.matriculationNumber) === key
  );
  if (!rec) return false;
  const hasNum = (o?: Record<string, unknown> | null): boolean =>
    Object.values(o ?? {}).some(
      (v): boolean =>
        (typeof v === "number" && Number.isFinite(v)) ||
        (v != null && typeof v === "object" && hasNum(v as Record<string, unknown>))
    );
  return (
    rec.totalPoints != null ||
    rec.totalOverride != null ||
    rec.gradeOverride != null ||
    rec.notAttended === true ||
    hasNum(rec.byQuestion) ||
    hasNum(rec.bySubArea) ||
    hasNum(rec.criterionValues) ||
    hasNum(rec.portfolioGrades) ||
    hasNum(rec.portfolioGradesByLecturer) ||
    hasNum(rec.portfolioCriterionValues) ||
    hasNum(rec.portfolioCriterionValuesByLecturer)
  );
}

/**
 * Manuelle Person bearbeiten. Neue Matrikelnummer zieht Punkte/Bewertungen,
 * Antritt und Stammdaten mit um.
 */
export function updateManualParticipant(
  project: ExamProject,
  key: string,
  patch: Partial<ManualParticipantInput>
): { project: ExamProject; error?: string } {
  const rows = listManualParticipants(project);
  const idx = rows.findIndex((r) => keyOf(r.matriculationNumber) === key);
  if (idx < 0) return { project, error: "Person nicht in der manuellen Liste" };
  const cur = rows[idx];
  const prevStudent = project.students[key];
  const merged: ManualParticipantInput = {
    matriculationNumber: patch.matriculationNumber ?? cur.matriculationNumber,
    lastName: patch.lastName ?? cur.lastName,
    firstName: patch.firstName ?? cur.firstName,
    programCode:
      patch.programCode !== undefined ? patch.programCode : cur.programCode,
    email: patch.email !== undefined ? patch.email : prevStudent?.email,
    attempt: patch.attempt !== undefined ? patch.attempt : prevStudent?.attempt,
    groupId: patch.groupId !== undefined ? patch.groupId : prevStudent?.groupId,
  };
  const v = validateInput(merged);
  if (!v.ok) return { project, error: v.reason };
  const newKey = v.key;
  if (newKey !== key && existingKeys(project).has(newKey)) {
    return { project, error: "Matrikelnummer ist bereits vergeben" };
  }

  const nextRows = [...rows];
  nextRows[idx] = {
    ...cur,
    matriculationNumber: newKey,
    lastName: merged.lastName.trim(),
    firstName: merged.firstName.trim(),
    programCode: merged.programCode?.trim() || undefined,
  };

  const students = { ...project.students };
  delete students[key];
  students[newKey] = {
    ...prevStudent,
    matriculationNumber: newKey,
    lastName: merged.lastName.trim(),
    firstName: merged.firstName.trim(),
    email: merged.email?.trim() || undefined,
    attempt: merged.attempt ?? null,
    groupId: merged.groupId ?? null,
  };

  const rekey = <T extends { matriculationNumber: string }>(list: T[]): T[] =>
    newKey === key
      ? list
      : list.map((x) =>
          normalizeMatriculation(x.matriculationNumber) === key
            ? { ...x, matriculationNumber: newKey }
            : x
        );

  return {
    project: withManualRows(
      {
        ...project,
        students,
        points: rekey(project.points),
        attendance: rekey(project.attendance),
      },
      nextRows
    ),
  };
}

/** Manuelle Person entfernen (inkl. Punkte/Bewertungen und Stammdaten). */
export function removeManualParticipant(
  project: ExamProject,
  key: string
): ExamProject {
  const rows = listManualParticipants(project).filter(
    (r) => keyOf(r.matriculationNumber) !== key
  );
  const students = { ...project.students };
  delete students[key];
  return withManualRows(
    {
      ...project,
      students,
      points: project.points.filter(
        (p) => normalizeMatriculation(p.matriculationNumber) !== key
      ),
    },
    rows
  );
}

export type HisTakeover = {
  key: string;
  previousName: string;
  newName: string;
};

/**
 * Nach einem HISinOne-Import: Personen der manuellen Liste, die jetzt in einer
 * HISinOne-Datei stehen, wechseln dorthin (HISinOne hat Vorrang). Bewertungen
 * bleiben (hängen an der Matrikelnummer); an der Person bleibt ein Hinweis.
 */
export function takeOverManualParticipantsByHis(project: ExamProject): {
  project: ExamProject;
  takeovers: HisTakeover[];
} {
  const manual = listManualParticipants(project);
  if (manual.length === 0) return { project, takeovers: [] };
  const hisByKey = new Map<string, HISTemplateRow>();
  for (const s of getHisinoneSources(project)) {
    for (const r of s.rows) {
      const k = keyOf(r.matriculationNumber);
      if (k && !hisByKey.has(k)) hisByKey.set(k, r);
    }
  }
  const takeovers: HisTakeover[] = [];
  const keep: HISTemplateRow[] = [];
  const students = { ...project.students };
  const at = new Date().toISOString();
  for (const r of manual) {
    const k = keyOf(r.matriculationNumber);
    const his = k ? hisByKey.get(k) : undefined;
    if (!k || !his) {
      keep.push(r);
      continue;
    }
    const previousName = `${r.lastName}, ${r.firstName}`;
    const newName = `${his.lastName}, ${his.firstName}`;
    takeovers.push({ key: k, previousName, newName });
    const prev = students[k];
    students[k] = {
      ...prev,
      matriculationNumber: prev?.matriculationNumber ?? k,
      // Name aus HISinOne
      lastName: his.lastName,
      firstName: his.firstName,
      takenOverFromManual: {
        at,
        previousName: previousName !== newName ? previousName : undefined,
      },
    };
  }
  if (takeovers.length === 0) return { project, takeovers };
  return {
    project: withManualRows({ ...project, students }, keep),
    takeovers,
  };
}

/** Hinweistext an der Person nach HISinOne-Übernahme */
export function takeoverNotice(student: Pick<Student, "takenOverFromManual">): string | null {
  const t = student.takenOverFromManual;
  if (!t) return null;
  return t.previousName
    ? `Aus manueller Teilnehmerliste in HISinOne übernommen (bisher: ${t.previousName})`
    : "Aus manueller Teilnehmerliste in HISinOne übernommen";
}

/**
 * Migration: bis v0.4.75 als „Extras“ manuell hinzugefügte Personen (StA /
 * Portfolio, ohne HISinOne-Zeile) in die manuelle Teilnehmerliste übernehmen.
 */
export function migrateManualExtrasToParticipantList(
  project: ExamProject
): ExamProject {
  if (project.manualExtrasMigrated) return project;
  if (!isHisManualAssessmentExam(project.examType)) {
    return { ...project, manualExtrasMigrated: true };
  }
  const taken = existingKeys(project);
  const add: ManualParticipantInput[] = [];
  for (const [rawKey, st] of Object.entries(project.students ?? {})) {
    const key = keyOf(rawKey);
    if (!key || taken.has(key)) continue;
    const rec = project.points.find(
      (p) => normalizeMatriculation(p.matriculationNumber) === key
    );
    add.push({
      matriculationNumber: key,
      lastName: st.lastName || "–",
      firstName: st.firstName || "–",
      programCode: rec?.manualProgramCode ?? null,
      email: st.email,
      attempt: st.attempt ?? null,
      groupId: st.groupId ?? null,
    });
    taken.add(key);
  }
  const next =
    add.length === 0 ? project : addManualParticipants(project, add).project;
  return { ...next, manualExtrasMigrated: true };
}

// ---------- Einlesen (Einfügen / Datei) ----------

type ParticipantField =
  | "matriculation"
  | "lastName"
  | "firstName"
  | "fullName"
  | "program"
  | "email"
  | "attempt";

function detectParticipantField(header: string): ParticipantField | null {
  const n = header.toLowerCase().replace(/[._-]+/g, " ").trim();
  if (!n) return null;
  if (/^(studiengang|stg|studienrichtung|program(me)?|course)\b/.test(n)) {
    return "program";
  }
  const f = detectField(header);
  if (
    f === "matriculation" ||
    f === "lastName" ||
    f === "firstName" ||
    f === "fullName" ||
    f === "email" ||
    f === "attempt"
  ) {
    return f;
  }
  return null;
}

function splitFullName(full: string): { lastName: string; firstName: string } {
  const s = full.trim();
  if (s.includes(",")) {
    const [ln, ...rest] = s.split(",");
    return { lastName: ln.trim(), firstName: rest.join(",").trim() };
  }
  const parts = s.split(/\s+/);
  if (parts.length < 2) return { lastName: s, firstName: "" };
  return { lastName: parts[parts.length - 1], firstName: parts.slice(0, -1).join(" ") };
}

function parseAttempt(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t.replace(/\D/g, ""));
  return Number.isFinite(n) && n > 0 ? n : NaN;
}

export type ParsedParticipants = {
  rows: (Partial<ManualParticipantInput> & { line: number })[];
  /** erkannte Spalten (für Vorschau) */
  columns: ParticipantField[];
  hasHeader: boolean;
};

/**
 * Tabelle (Zeilen × Zellen) → Teilnehmer. Mit Kopfzeile: Spalten nach Namen;
 * ohne: Reihenfolge Matrikelnummer, Nachname, Vorname, Studiengang, E-Mail, Versuch.
 */
export function parseParticipantMatrix(matrix: unknown[][]): ParsedParticipants {
  const rows = matrix
    .map((r) => (r ?? []).map((c) => cellToString(c)))
    .filter((r) => r.some((c) => c !== ""));
  if (rows.length === 0) return { rows: [], columns: [], hasHeader: false };

  let headerIdx = -1;
  let map: Partial<Record<ParticipantField, number>> = {};
  for (let i = 0; i < Math.min(10, rows.length); i++) {
    const m: Partial<Record<ParticipantField, number>> = {};
    rows[i].forEach((h, idx) => {
      const f = detectParticipantField(h);
      if (f && m[f] == null) m[f] = idx;
    });
    const hasName = m.lastName != null || m.fullName != null;
    if (m.matriculation != null && hasName) {
      headerIdx = i;
      map = m;
      break;
    }
  }
  const hasHeader = headerIdx >= 0;
  if (!hasHeader) {
    map = {
      matriculation: 0,
      lastName: 1,
      firstName: 2,
      program: 3,
      email: 4,
      attempt: 5,
    };
  }
  const get = (r: string[], f: ParticipantField) =>
    map[f] != null ? (r[map[f]!] ?? "").trim() : "";

  const out: ParsedParticipants["rows"] = [];
  rows.forEach((r, i) => {
    if (i <= headerIdx) return;
    let lastName = get(r, "lastName");
    let firstName = get(r, "firstName");
    if (!lastName && map.fullName != null) {
      const sp = splitFullName(get(r, "fullName"));
      lastName = sp.lastName;
      firstName = firstName || sp.firstName;
    }
    const attemptRaw = get(r, "attempt");
    const attempt = attemptRaw ? parseAttempt(attemptRaw) : null;
    out.push({
      line: i + 1,
      matriculationNumber: get(r, "matriculation"),
      lastName,
      firstName,
      programCode: get(r, "program") || null,
      email: get(r, "email") || null,
      attempt: attempt != null && Number.isNaN(attempt) ? -1 : attempt,
    });
  });
  return {
    rows: out,
    columns: (Object.keys(map) as ParticipantField[]).filter(
      (f) => map[f] != null
    ),
    hasHeader,
  };
}

/** Eingefügter Text (aus Excel: Tab; sonst Semikolon/Komma) → Matrix */
export function textToMatrix(text: string): string[][] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").filter((l) => l.trim());
  if (lines.length === 0) return [];
  const sample = lines.slice(0, 5).join("\n");
  const delim = sample.includes("\t") ? "\t" : sample.includes(";") ? ";" : ",";
  return lines.map((l) => splitDelimited(l, delim));
}

/** Eine Zeile trennen; Felder in Anführungszeichen dürfen das Trennzeichen enthalten. */
function splitDelimited(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"' && cur.trim() === "") {
      quoted = true;
      cur = "";
    } else if (ch === delim) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

/** Vorschau: Einlese-Ergebnis gegen das Projekt prüfen, ohne zu speichern. */
export function previewManualParticipants(
  project: ExamProject,
  parsed: ParsedParticipants
): { valid: number; issues: ManualParticipantIssue[] } {
  const r = addManualParticipants(project, parsed.rows);
  return { valid: r.added, issues: r.issues };
}
