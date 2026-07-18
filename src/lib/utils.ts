import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Dateiname mit Export-Datum und -Uhrzeit (lokal):
 * YYYY-MM-DD_HHmm_basis.ext
 */
export function datedExportFilename(base: string, ext = "json"): string {
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
  return `${stamp}_${time}_${safe}.${cleanExt}`;
}

/** @deprecated Import aus `@/lib/download` – re-export für Kompatibilität */
export {
  downloadBlob,
  downloadJson,
  isLikelyTeamsOrIframeEmbed,
} from "@/lib/download";

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

export function formatPoints(points: number | null | undefined): string {
  if (points == null || Number.isNaN(points)) return "–";
  if (Number.isInteger(points)) return String(points);
  return points.toFixed(1).replace(".", ",");
}

export function formatPercent(ratio: number | null | undefined): string {
  if (ratio == null || Number.isNaN(ratio)) return "–";
  return `${(ratio * 100).toFixed(1).replace(".", ",")}\u00a0%`;
}
