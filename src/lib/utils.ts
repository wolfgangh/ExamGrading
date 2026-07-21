import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Dateiname mit Export-Datum (lokal), optional Uhrzeit:
 * - mit Zeit (Default): YYYY-MM-DD_HHmm_basis.ext
 * - ohne Zeit: YYYY-MM-DD_basis.ext (z. B. JSON-Sicherungen)
 */
export function datedExportFilename(
  base: string,
  ext = "json",
  options?: { withTime?: boolean }
): string {
  const withTime = options?.withTime !== false;
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
  ].join("-");
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}`;
  const safe = base
    .replace(/[^\w\- äöüÄÖÜß.]+/gi, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 100);
  const cleanExt = ext.replace(/^\./, "");
  return withTime
    ? `${stamp}_${time}_${safe}.${cleanExt}`
    : `${stamp}_${safe}.${cleanExt}`;
}

/** @deprecated Import aus `@/lib/download` – re-export für Kompatibilität */
export {
  downloadBlob,
  downloadJson,
  isLikelyTeamsOrIframeEmbed,
} from "@/lib/download";

/**
 * Zahl aus Eingabe mit Komma oder Punkt als Dezimaltrenner.
 * Akzeptiert z. B. „12,5“, „12.5“, „1.234,5“ (DE) bzw. „1,234.5“ (EN).
 */
export function parseLocaleNumber(raw: string): number | null {
  let s = raw.trim().replace(/\s/g, "").replace(/\u00a0/g, "");
  if (!s) return null;
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");
    if (lastComma > lastDot) {
      // 1.234,5 → Tausenderpunkt, Dezimalkomma
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      // 1,234.5 → Tausenderkomma, Dezimalpunkt
      s = s.replace(/,/g, "");
    }
  } else if (hasComma) {
    s = s.replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Anzeige mit Dezimaltrenner der Browser-Locale (Fallback: Komma). */
export function formatEditableNumber(
  value: number | null | undefined
): string {
  if (value == null || Number.isNaN(value)) return "";
  if (Number.isInteger(value)) return String(value);
  const sep =
    typeof Intl !== "undefined"
      ? (1.1).toLocaleString(undefined).replace(/\d/g, "").charAt(0) || ","
      : ",";
  return String(value).replace(".", sep);
}

export function formatGrade(grade: number | null | undefined): string {
  if (grade == null || Number.isNaN(grade)) return "–";
  return grade.toFixed(1).replace(".", ",");
}

/** Allgemeine Statistikzahl (z. B. Stabw.) mit deutschem Komma */
export function formatStat(
  value: number | null | undefined,
  digits = 2
): string {
  if (value == null || Number.isNaN(value)) return "–";
  return value.toFixed(digits).replace(".", ",");
}

/**
 * Punkte formatieren.
 * @param decimals Wenn gesetzt: immer so viele Nachkommastellen (z. B. 2 → „12,00“).
 *   Ohne Argument: ganze Zahlen ohne Dezimalen, sonst 1 Nachkommastelle.
 */
export function formatPoints(
  points: number | null | undefined,
  decimals?: number
): string {
  if (points == null || Number.isNaN(points)) return "–";
  if (decimals != null && decimals >= 0) {
    return points.toFixed(decimals).replace(".", ",");
  }
  if (Number.isInteger(points)) return String(points);
  return points.toFixed(1).replace(".", ",");
}

export function formatPercent(ratio: number | null | undefined): string {
  if (ratio == null || Number.isNaN(ratio)) return "–";
  return `${(ratio * 100).toFixed(1).replace(".", ",")}\u00a0%`;
}
