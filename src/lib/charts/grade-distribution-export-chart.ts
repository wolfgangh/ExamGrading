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
 * HiDPI (scale) für scharfe Darstellung in PDF.
 * Balken nach Notenstufe gefärbt; Mittelwert und Median als Linien.
 */
export function renderGradeDistributionChartPng(
  data: NotenspiegelData,
  opts?: { width?: number; height?: number; scale?: number }
): string {
  // Logische Größe (CSS-Pixel / PDF-Layout)
  const width = opts?.width ?? 1100;
  const height = opts?.height ?? 500;
  // Physische Auflösung: 2–3× für scharfen Druck
  const scale = Math.max(1, opts?.scale ?? 2.5);

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas nicht verfügbar für Notenspiegel-Diagramm.");
  }

  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // Hintergrund
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const pad = { top: 40, right: 28, bottom: 96, left: 56 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const rows = data.gradeRows;
  const n = rows.length || 1;
  const maxCount = Math.max(1, ...rows.map((r) => r.count));
  const yMax = Math.max(1, Math.ceil(maxCount * 1.15));

  // Titel
  ctx.fillStyle = "#0f172a";
  ctx.font = "600 17px system-ui, -apple-system, sans-serif";
  ctx.fillText("Notenverteilung (Häufigkeit)", pad.left, 24);

  // Plot-Rahmen
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1;
  ctx.strokeRect(pad.left + 0.5, pad.top + 0.5, plotW - 1, plotH - 1);

  // Horizontale Gitterlinien
  const gridLines = 5;
  ctx.font = "12px system-ui, -apple-system, sans-serif";
  for (let i = 0; i <= gridLines; i++) {
    const val = (yMax * i) / gridLines;
    const y = pad.top + plotH - (plotH * i) / gridLines;
    ctx.strokeStyle = i === 0 ? "#94a3b8" : "#e2e8f0";
    ctx.lineWidth = 1;
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
    ctx.fillRect(x, y, barW, Math.max(h, r.count > 0 ? 2 : 0));

    ctx.fillStyle = "#334155";
    ctx.font = "12px system-ui, -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(r.label, x + barW / 2, pad.top + plotH + 18);

    if (r.count > 0) {
      ctx.fillStyle = "#0f172a";
      ctx.font = "600 12px system-ui, -apple-system, sans-serif";
      ctx.fillText(String(r.count), x + barW / 2, y - 6);
    }
  });

  const gradeToX = (grade: number): number => {
    if (rows.length === 0) return pad.left;
    const first = rows[0].grade;
    const last = rows[rows.length - 1].grade;
    if (last === first) return pad.left + plotW / 2;
    const t = (grade - first) / (last - first);
    const clamped = Math.min(1, Math.max(0, t));
    return pad.left + clamped * (plotW - slot) + slot / 2;
  };

  const drawMarker = (
    grade: number | null,
    color: string,
    dash: number[]
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
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, pad.top - 2);
    ctx.lineTo(x - 5, pad.top - 10);
    ctx.lineTo(x + 5, pad.top - 10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  drawMarker(data.averageGrade, "#334155", [6, 4]);
  drawMarker(data.medianGrade, "#1d4ed8", [2, 3]);

  // Y-Achsen-Beschriftung
  ctx.save();
  ctx.fillStyle = "#64748b";
  ctx.font = "12px system-ui, -apple-system, sans-serif";
  ctx.translate(16, pad.top + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.fillText("Anzahl", 0, 0);
  ctx.restore();

  // Legende Notenstufen
  let lx = pad.left;
  const ly = height - 56;
  ctx.font = "12px system-ui, -apple-system, sans-serif";
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
  const ly2 = height - 30;
  ctx.strokeStyle = "#334155";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(pad.left, ly2);
  ctx.lineTo(pad.left + 22, ly2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#334155";
  ctx.font = "12px system-ui, -apple-system, sans-serif";
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

  // PNG ohne zusätzliche Kompression-Artefakte (Browser default)
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
