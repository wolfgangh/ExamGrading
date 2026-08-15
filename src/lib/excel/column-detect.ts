export type LogicalField =
  | "matriculation"
  | "lastName"
  | "firstName"
  | "fullName"
  | "email"
  | "login"
  | "date"
  | "totalPoints"
  | "grade"
  | "attempt"
  | "attendance"
  | "processingDuration";

/**
 * Moodle „Antritt“: … | E-Mail-Adresse | … | Name | Vorname | Matrikelnummer
 * Moodle THE-Bewertung: Nachname | Vorname | Anmeldename | E-Mail | … | Bewertung/90,00 | F 1 /…
 */
const SYNONYMS: Record<LogicalField, string[]> = {
  matriculation: [
    "matrikelnummer",
    "matr.-nr.",
    "matr.nr.",
    "matr nr",
    "matrikel",
    "matrikelnr",
    "matrikelnr.",
    "matr. nr.",
    "matr nr.",
    "mtknr",
    "matnr",
    "matriculation",
  ],
  lastName: [
    "nachname",
    "familienname",
    "lastname",
    "last name",
    "surname",
  ],
  firstName: ["vorname", "firstname", "first name", "given name"],
  fullName: [
    "vollständiger name",
    "vollstaendiger name",
    "full name",
    "display name",
  ],
  email: [
    "e-mail-adresse",
    "e-mail adresse",
    "email-adresse",
    "e-mail",
    "email",
  ],
  login: [
    "anmeldename",
    "benutzername",
    "username",
    "user name",
    "login",
  ],
  date: ["datum", "date", "begonnen", "zeitstempel", "timestamp"],
  totalPoints: [
    "gesamtpunkte",
    "bewertung/",
    "bewertung",
    "score",
    "points",
    // "punkte" absichtlich nicht allein – sonst greift „Punkte FRM“ als Gesamtpunkte
  ],
  grade: ["note", "grade", "bewertung (note)"],
  attempt: ["versuch", "versuche", "attempt"],
  attendance: ["antritt", "teilnahme", "anwesend", "attended"],
  processingDuration: [
    "bearbeitungsdauer",
    "bearbeitungszeit",
    "zeitaufwand",
    "time taken",
    "time spent",
    "duration",
    "dauer der bearbeitung",
    // Moodle-THE oft nur „Dauer“ (z. B. „1 Stunde 23 Minuten“)
    "dauer",
  ],
};

function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .replace(/[.\-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[_]+/g, " ")
    .trim();
}

function isWeakMatriculationHeader(h: string): boolean {
  const n = normalizeHeader(h);
  return (
    n === "id nummer" ||
    n === "id-nummer" ||
    n.startsWith("id nummer") ||
    n === "student id"
  );
}

function isStrongTotalPointsHeader(h: string): boolean {
  const n = normalizeHeader(h);
  return n.startsWith("bewertung/") || n.startsWith("gesamtpunkte");
}

export function detectField(header: string): LogicalField | null {
  const n = normalizeHeader(header);
  if (!n) return null;

  // Moodle: exakte Spalte "Name" = Nachname (nicht "Vorname", nicht "Vollständiger Name")
  if (n === "name") return "lastName";

  // Gesamtpunkte exakt / mit Präfix – vor generischen „Punkte …“-Teilgebieten
  if (n === "gesamtpunkte" || n.startsWith("gesamtpunkte")) {
    return "totalPoints";
  }

  // Moodle: Spalte oft exakt „Dauer“ (vor generischem date/timestamp)
  if (n === "dauer" || n.startsWith("dauer ") || n === "bearbeitungsdauer") {
    return "processingDuration";
  }

  for (const [field, synonyms] of Object.entries(SYNONYMS) as [
    LogicalField,
    string[],
  ][]) {
    for (const syn of synonyms) {
      if (n === syn || n.startsWith(syn + " ") || n.startsWith(syn + "/")) {
        return field;
      }
      // includes nur bei längeren Synonymen (≥5), um "name"∈"vorname" zu vermeiden
      if (syn.length >= 5 && n.includes(syn)) {
        if (field === "lastName" && n.includes("vorname")) continue;
        if (field === "lastName" && n.includes("vollständig")) continue;
        if (field === "totalPoints" && n.includes("note")) continue;
        if (
          field === "totalPoints" &&
          (n.includes("notwendig") || n.includes("nicht bewertet"))
        ) {
          continue;
        }
        // „Punkte FRM“ ist Teilgebiet, keine Gesamtpunkte
        if (
          field === "totalPoints" &&
          /^punkte\s+\S+/i.test(n) &&
          !n.includes("gesamt")
        ) {
          continue;
        }
        if (field === "date" && n.includes("update")) continue;
        if (field === "email" && n === "anmeldename") continue;
        return field;
      }
    }
  }
  return null;
}

export function autoMapColumns(
  headers: string[]
): Partial<Record<LogicalField, number>> {
  const map: Partial<Record<LogicalField, number>> = {};
  headers.forEach((h, idx) => {
    if (isWeakMatriculationHeader(h)) return;
    const field = detectField(h);
    if (field && map[field] == null) {
      map[field] = idx;
    }
  });
  if (map.matriculation == null) {
    headers.forEach((h, idx) => {
      if (!isWeakMatriculationHeader(h)) return;
      if (map.matriculation == null) map.matriculation = idx;
    });
  }
  if (map.totalPoints != null) {
    const cur = headers[map.totalPoints] ?? "";
    if (!isStrongTotalPointsHeader(cur)) {
      const better = headers.findIndex((h) => isStrongTotalPointsHeader(h));
      if (better >= 0) map.totalPoints = better;
    }
  }
  return map;
}

export function findHeaderRow(
  rows: unknown[][],
  maxScan = 15
): { headerRowIndex: number; headers: string[] } | null {
  let best: { headerRowIndex: number; headers: string[]; score: number } | null =
    null;

  for (let i = 0; i < Math.min(maxScan, rows.length); i++) {
    const row = rows[i] ?? [];
    const headers = row.map((c) => (c == null ? "" : String(c).trim()));
    const map = autoMapColumns(headers);
    let score = Object.keys(map).length;
    if (map.matriculation != null) score += 3;
    if (map.lastName != null) score += 1;
    if (score >= 2 && (!best || score > best.score)) {
      best = { headerRowIndex: i, headers, score };
    }
  }

  if (!best) return null;
  return { headerRowIndex: best.headerRowIndex, headers: best.headers };
}

export function cellToString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "number" && Number.isFinite(value)) {
    if (Number.isInteger(value)) return String(value);
    // Excel float matnr
    if (Math.abs(value - Math.round(value)) < 1e-6) {
      return String(Math.round(value));
    }
    return String(value);
  }
  if (typeof value === "object") {
    const o = value as {
      result?: unknown;
      text?: unknown;
      richText?: { text?: string }[];
      hyperlink?: unknown;
    };
    if ("result" in o && o.result != null) return cellToString(o.result);
    if (Array.isArray(o.richText)) {
      return o.richText.map((t) => t.text ?? "").join("").trim();
    }
    if (typeof o.text === "string") return o.text.trim();
    if (o.text != null) return cellToString(o.text);
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return value.trim();
  return "";
}

export function cellToNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const s = cellToString(value)
    .replace(",", ".")
    .replace(/\s/g, "")
    .replace("%", "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
