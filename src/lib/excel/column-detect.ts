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
  | "attendance";

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
    "id-nummer",
    "id nummer",
    "matriculation",
    "student id",
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
    "punkte",
    "score",
    "points",
  ],
  grade: ["note", "grade", "bewertung (note)"],
  attempt: ["versuch", "versuche", "attempt"],
  attendance: ["antritt", "teilnahme", "anwesend", "attended"],
};

function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[_]+/g, " ")
    .trim();
}

export function detectField(header: string): LogicalField | null {
  const n = normalizeHeader(header);
  if (!n) return null;

  // Moodle: exakte Spalte "Name" = Nachname (nicht "Vorname", nicht "Vollständiger Name")
  if (n === "name") return "lastName";

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
    const field = detectField(h);
    if (field && map[field] == null) {
      map[field] = idx;
    }
  });
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
  return String(value).trim();
}

export function cellToNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const s = String(value)
    .trim()
    .replace(",", ".")
    .replace(/\s/g, "")
    .replace("%", "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
