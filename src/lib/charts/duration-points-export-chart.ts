/**
 * Canvas-PNG: Scatterplot Dauer → Punkte inkl. Regressionsgerade (für PDF/Excel).
 */

import type { DurationPointsAnalysis } from "@/lib/grades/duration-points-analysis";
import { formatDurationMinutes } from "@/lib/excel/parse-duration";
import { formatPoints, formatStat } from "@/lib/utils";
import { formatPValue } from "@/lib/grades/linear-regression";

export function renderDurationPointsScatterPng(
  analysis: DurationPointsAnalysis,
  opts?: { width?: number; height?: number; scale?: number }
): string | null {
  if (!analysis.available || analysis.points.length === 0) return null;

  const width = opts?.width ?? 1200;
  const height = opts?.height ?? 560;
  const scale = Math.max(1, opts?.scale ?? 2.5);

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const pad = { top: 44, right: 28, bottom: 88, left: 64 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const xs = analysis.points.map((p) => p.x);
  const ys = analysis.points.map((p) => p.y);
  let minX = Math.min(...xs);
  let maxX = Math.max(...xs);
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);
  if (minX === maxX) {
    minX -= 5;
    maxX += 5;
  }
  if (minY === maxY) {
    minY = Math.max(0, minY - 5);
    maxY += 5;
  }
  // Padding der Achsen
  const dx = maxX - minX;
  const dy = maxY - minY;
  minX -= dx * 0.05;
  maxX += dx * 0.05;
  minY = Math.max(0, minY - dy * 0.08);
  maxY += dy * 0.08;
  if (analysis.yMode === "percent") {
    minY = 0;
    maxY = Math.max(100, maxY);
  }

  const xToPx = (x: number) =>
    pad.left + ((x - minX) / (maxX - minX || 1)) * plotW;
  const yToPx = (y: number) =>
    pad.top + plotH - ((y - minY) / (maxY - minY || 1)) * plotH;

  // Titel
  ctx.fillStyle = "#0f172a";
  ctx.font = "600 17px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(
    `Bearbeitungsdauer und ${analysis.yAxisLabel}`,
    pad.left,
    26
  );

  // Rahmen + Gitter
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1;
  ctx.strokeRect(pad.left + 0.5, pad.top + 0.5, plotW - 1, plotH - 1);

  const gridN = 5;
  ctx.font = "11px system-ui, -apple-system, sans-serif";
  for (let i = 0; i <= gridN; i++) {
    const yv = minY + ((maxY - minY) * i) / gridN;
    const y = yToPx(yv);
    ctx.strokeStyle = i === 0 ? "#94a3b8" : "#e2e8f0";
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + plotW, y);
    ctx.stroke();
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "right";
    const label =
      analysis.yMode === "percent"
        ? String(Math.round(yv * 10) / 10).replace(".", ",")
        : String(Math.round(yv * 10) / 10).replace(".", ",");
    ctx.fillText(label, pad.left - 8, y + 4);

    const xv = minX + ((maxX - minX) * i) / gridN;
    const x = xToPx(xv);
    ctx.strokeStyle = "#e2e8f0";
    ctx.beginPath();
    ctx.moveTo(x, pad.top);
    ctx.lineTo(x, pad.top + plotH);
    ctx.stroke();
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "center";
    ctx.fillText(String(Math.round(xv)), x, pad.top + plotH + 16);
  }

  // Achsenbeschriftungen
  ctx.fillStyle = "#64748b";
  ctx.font = "12px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Bearbeitungsdauer (min)", pad.left + plotW / 2, height - 52);

  ctx.save();
  ctx.translate(16, pad.top + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(analysis.yAxisLabel, 0, 0);
  ctx.restore();

  // Punkte
  for (const p of analysis.points) {
    const px = xToPx(p.x);
    const py = yToPx(p.y);
    ctx.beginPath();
    ctx.fillStyle = p.color;
    ctx.arc(px, py, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Regression
  if (analysis.lineData.length === 2) {
    const [a, b] = analysis.lineData;
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(xToPx(a.x), yToPx(a.yHat));
    ctx.lineTo(xToPx(b.x), yToPx(b.yHat));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Legende kurz
  ctx.font = "11px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "left";
  let lx = pad.left;
  const ly = height - 28;
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(lx, ly);
  ctx.lineTo(lx + 22, ly);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#334155";
  ctx.fillText("Regression", lx + 28, ly + 4);

  if (analysis.regression) {
    const r = analysis.regression;
    const summary = `n=${r.n}  R²=${formatStat(r.rSquared, 3)}  b=${formatStat(r.slope, 4)} ${analysis.slopeUnit}  p(b)=${formatPValue(r.pValue)}`;
    ctx.fillText(summary, lx + 110, ly + 4);
  }

  return canvas.toDataURL("image/png");
}

export function formatDurationRegressionSummary(
  analysis: DurationPointsAnalysis
): string {
  if (!analysis.regression) return "";
  const r = analysis.regression;
  const yHat =
    analysis.yMode === "percent" ? "% von max." : "Punkte";
  return (
    `ŷ = a + b·t (${yHat}): a=${formatStat(r.intercept, 3)}, ` +
    `b=${formatStat(r.slope, 4)} ${analysis.slopeUnit}, ` +
    `R²=${formatStat(r.rSquared, 3)}, p(b)=${formatPValue(r.pValue)}, n=${r.n}`
  );
}

/** Kurzinfo für Debug/Excel */
export function durationPointExportNote(analysis: DurationPointsAnalysis): string {
  if (!analysis.available) return "";
  const sample = analysis.points[0];
  return sample
    ? `Beispiel: ${formatDurationMinutes(sample.x)} → ${formatPoints(sample.totalPoints)} Pkt.`
    : "";
}
