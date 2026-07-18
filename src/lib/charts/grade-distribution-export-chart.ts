import {
  GRADE_BUCKET_COLORS,
  type GradeBucketKey,
  type NotenspiegelData,
} from "@/lib/grades/notenspiegel";
import { formatGrade } from "@/lib/utils";

const BUCKET_ORDER: GradeBucketKey[] = [
  "sehr gut",
  "gut",
  "befriedigend",
  "ausreichend",
  "nicht ausreichend",
];

/**
 * Rendert die Notenverteilung als PNG (data URL) für PDF/Excel-Export.
 * Balken nach Notenstufe gefärbt; Mittelwert und Median als Linien.
 */
export function renderGradeDistributionChartPng(
  data: NotenspiegelData,
  opts?: { width?: number; height?: number }
): string {
  const width = opts?.width ?? 900;
  const height = opts?.height ?? 420;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas nicht verfügbar für Notenspiegel-Diagramm.");
  }

  // Hintergrund
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const pad = { top: 36, right: 24, bottom: 88, left: 52 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const rows = data.gradeRows;
  const n = rows.length || 1;
  const maxCount = Math.max(1, ...rows.map((r) => r.count));
  // Y-Achse etwas über Max, mindestens 1
  const yMax = Math.max(1, Math.ceil(maxCount * 1.15));

  // Titel
  ctx.fillStyle = "#0f172a";
  ctx.font = "600 16px system-ui, sans-serif";
  ctx.fillText("Notenverteilung (Häufigkeit)", pad.left, 22);

  // Plot-Rahmen
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1;
  ctx.strokeRect(pad.left, pad.top, plotW, plotH);

  // Horizontale Gitterlinien
  const gridLines = 5;
  ctx.font = "11px system-ui, sans-serif";
  for (let i = 0; i <= gridLines; i++) {
    const val = (yMax * i) / gridLines;
    const y = pad.top + plotH - (plotH * i) / gridLines;
    ctx.strokeStyle = i === 0 ? "#94a3b8" : "#e2e8f0";
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + plotW, y);
    ctx.stroke();
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "right";
    ctx.fillText(String(Math.round(val)), pad.left - 8, y + 4);
  }

  // Balken
  const gap = 0.28;
  const slot = plotW / n;
  const barW = slot * (1 - gap);

  rows.forEach((r, i) => {
    const h = (r.count / yMax) * plotH;
    const x = pad.left + i * slot + (slot - barW) / 2;
    const y = pad.top + plotH - h;
    ctx.fillStyle = r.color;
    // abgerundete Optik: einfache Rechtecke
    ctx.fillRect(x, y, barW, Math.max(h, r.count > 0 ? 2 : 0));

    // X-Label
    ctx.fillStyle = "#334155";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(r.label, x + barW / 2, pad.top + plotH + 16);

    // Anzahl über Balken
    if (r.count > 0) {
      ctx.fillStyle = "#0f172a";
      ctx.font = "600 11px system-ui, sans-serif";
      ctx.fillText(String(r.count), x + barW / 2, y - 6);
    }
  });

  // Note → X-Position (Mitte des jeweiligen Balkens, interpoliert)
  const gradeToX = (grade: number): number => {
    if (rows.length === 0) return pad.left;
    const first = rows[0].grade;
    const last = rows[rows.length - 1].grade;
    if (last === first) return pad.left + plotW / 2;
    const t = (grade - first) / (last - first);
    const clamped = Math.min(1, Math.max(0, t));
    // Mitte des Slots
    return pad.left + clamped * (plotW - slot) + slot / 2;
  };

  const drawMarker = (
    grade: number | null,
    color: string,
    dash: number[],
    label: string
  ) => {
    if (grade == null || !Number.isFinite(grade)) return;
    const x = gradeToX(grade);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(x, pad.top);
    ctx.lineTo(x, pad.top + plotH);
    ctx.stroke();
    ctx.setLineDash([]);
    // Dreieck oben
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, pad.top - 2);
    ctx.lineTo(x - 5, pad.top - 10);
    ctx.lineTo(x + 5, pad.top - 10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    void label;
  };

  drawMarker(data.averageGrade, "#334155", [6, 4], "Mittelwert");
  drawMarker(data.medianGrade, "#1d4ed8", [2, 3], "Median");

  // Y-Achsen-Beschriftung
  ctx.save();
  ctx.fillStyle = "#64748b";
  ctx.font = "11px system-ui, sans-serif";
  ctx.translate(14, pad.top + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.fillText("Anzahl", 0, 0);
  ctx.restore();

  // Legende Notenstufen
  let lx = pad.left;
  const ly = height - 52;
  ctx.font = "11px system-ui, sans-serif";
  ctx.textAlign = "left";
  for (const key of BUCKET_ORDER) {
    const c = GRADE_BUCKET_COLORS[key];
    ctx.fillStyle = c;
    ctx.fillRect(lx, ly, 12, 12);
    ctx.fillStyle = "#334155";
    ctx.fillText(key, lx + 16, ly + 10);
    lx += ctx.measureText(key).width + 36;
  }

  // Legende Mittelwert / Median
  const ly2 = height - 28;
  // Mittelwert
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(pad.left, ly2);
  ctx.lineTo(pad.left + 22, ly2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#334155";
  ctx.font = "11px system-ui, sans-serif";
  const meanLabel = `Mittelwert ${formatGrade(data.averageGrade)}`;
  ctx.fillText(meanLabel, pad.left + 28, ly2 + 4);

  const mx = pad.left + 28 + ctx.measureText(meanLabel).width + 24;
  ctx.strokeStyle = "#1d4ed8";
  ctx.setLineDash([2, 3]);
  ctx.beginPath();
  ctx.moveTo(mx, ly2);
  ctx.lineTo(mx + 22, ly2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#1d4ed8";
  ctx.fillText(`Median ${formatGrade(data.medianGrade)}`, mx + 28, ly2 + 4);

  return canvas.toDataURL("image/png");
}

/** dataURL → Uint8Array für ExcelJS */
export function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1] ?? "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
