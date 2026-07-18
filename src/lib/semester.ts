/**
 * Aktuelles deutsches Hochschulsemester (vereinfachte Kalenderregel).
 * - Apr–Sep: Sommersemester
 * - Okt–Mär: Wintersemester
 */
export function currentSemesterLabel(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1; // 1–12
  if (m >= 4 && m <= 9) {
    return `Sommer ${y}`;
  }
  if (m >= 10) {
    const next = String(y + 1).slice(-2);
    return `Winter ${y}/${next}`;
  }
  // Jan–Mär
  const prev = y - 1;
  const yy = String(y).slice(-2);
  return `Winter ${prev}/${yy}`;
}

/** Nächstes Semester nach `currentSemesterLabel`-Logik */
export function nextSemesterLabel(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  if (m >= 4 && m <= 9) {
    // Sommer → nächstes Winter y/y+1
    return `Winter ${y}/${String(y + 1).slice(-2)}`;
  }
  if (m >= 10) {
    // Winter start → nächstes Sommer y+1
    return `Sommer ${y + 1}`;
  }
  // Jan–Mär (noch Winter) → nächstes Sommer y
  return `Sommer ${y}`;
}

/** Optionen für Dropdown: aktuell + folgend (ohne Duplikate) */
export function semesterSelectOptions(date: Date = new Date()): string[] {
  const cur = currentSemesterLabel(date);
  const next = nextSemesterLabel(date);
  return cur === next ? [cur] : [cur, next];
}

/** Dateiname-sichere Kurzform des Semesters */
export function semesterSlug(label: string): string {
  return label
    .replace(/\s+/g, "-")
    .replace(/[^\w\-äöüÄÖÜß/]+/gi, "")
    .replace(/\//g, "-");
}
