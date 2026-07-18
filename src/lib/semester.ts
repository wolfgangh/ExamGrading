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

/** Dateiname-sichere Kurzform des Semesters */
export function semesterSlug(label: string): string {
  return label
    .replace(/\s+/g, "-")
    .replace(/[^\w\-äöüÄÖÜß/]+/gi, "")
    .replace(/\//g, "-");
}
