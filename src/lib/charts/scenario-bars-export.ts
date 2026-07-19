import type { GradeMatrixRow, ScenarioColumn } from "@/lib/grades/scenario-comparison";
import { formatGrade } from "@/lib/utils";

const COLORS = ["#447099", "#0d9488", "#c2410c", "#7c3aed", "#be123c"];

/**
 * Gruppierte Balken (Anzahl je Note × Szenario) als PNG data URL für PDF.
 */
export function renderScenarioGradeBarsPng(
  columns: ScenarioColumn[],
  gradeMatrix: GradeMatrixRow[],
  opts?: { width?: number; height?: number; scale?: number; mode?: "count" | "share" }
): string {
  const width = opts?.width ?? 1200;
  const height = opts?.height ?? 480;
  const scale = Math.max(1, opts?.scale ?? 2);
  const mode = opts?.mode ?? "count";

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas nicht verfügbar.");
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const pad = { top: 44, right: 24, bottom: 88, left: 52 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  ctx.fillStyle = "#0f172a";
  ctx.font = "600 16px system-ui, sans-serif";
  ctx.fillText(
    mode === "share"
      ? "Notenverteilung (Anteil %) je Szenario"
      : "Notenverteilung (Anzahl) je Szenario",
    pad.left,
    26
  );

  const nGrades = gradeMatrix.length || 1;
  const nSc = Math.max(1, columns.length);
  const groupW = plotW / nGrades;
  const barW = Math.min(28, (groupW * 0.75) / nSc);
  const gap = 2;

  let maxVal = 1;
  for (const row of gradeMatrix) {
    for (const cell of row.cells) {
      const v = mode === "share" ? cell.share * 100 : cell.count;
      if (v > maxVal) maxVal = v;
    }
  }
  const yMax = Math.ceil(maxVal * 1.15) || 1;

  // Grid
  ctx.font = "11px system-ui, sans-serif";
  for (let i = 0; i <= 4; i++) {
    const val = (yMax * i) / 4;
    const y = pad.top + plotH - (plotH * i) / 4;
    ctx.strokeStyle = i === 0 ? "#94a3b8" : "#e2e8f0";
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + plotW, y);
    ctx.stroke();
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "right";
    ctx.fillText(
      mode === "share" ? `${Math.round(val)} %` : String(Math.round(val)),
      pad.left - 6,
      y + 4
    );
  }

  gradeMatrix.forEach((row, gi) => {
    const gx = pad.left + gi * groupW + groupW / 2;
    row.cells.forEach((cell, si) => {
      const v = mode === "share" ? cell.share * 100 : cell.count;
      const h = (v / yMax) * plotH;
      const x =
        gx -
        (nSc * barW + (nSc - 1) * gap) / 2 +
        si * (barW + gap);
      const y = pad.top + plotH - h;
      ctx.fillStyle = COLORS[si % COLORS.length];
      ctx.fillRect(x, y, barW, Math.max(h, 0));
    });
    ctx.fillStyle = "#334155";
    ctx.textAlign = "center";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText(formatGrade(row.grade), gx, pad.top + plotH + 16);
  });

  // Legend
  let lx = pad.left;
  const ly = height - 28;
  columns.forEach((c, i) => {
    ctx.fillStyle = COLORS[i % COLORS.length];
    ctx.fillRect(lx, ly - 8, 12, 12);
    ctx.fillStyle = "#0f172a";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(c.label, lx + 16, ly + 2);
    lx += 16 + ctx.measureText(c.label).width + 18;
  });

  return canvas.toDataURL("image/png");
}

export function renderScenarioBucketBarsPng(
  columns: ScenarioColumn[],
  opts?: { width?: number; height?: number; scale?: number }
): string {
  const buckets = columns[0]?.buckets ?? [];
  const gradeMatrixLike = buckets.map((b, bi) => ({
    grade: bi,
    gradeLabel: b.name,
    cells: columns.map((c) => {
      const cell = c.buckets[bi] ?? { count: 0, share: 0 };
      return { count: cell.count, share: cell.share };
    }),
  }));
  // reuse with labels as gradeLabel - need custom x labels
  const width = opts?.width ?? 1200;
  const height = opts?.height ?? 420;
  const scale = Math.max(1, opts?.scale ?? 2);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas nicht verfügbar.");
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const pad = { top: 44, right: 24, bottom: 100, left: 52 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  ctx.fillStyle = "#0f172a";
  ctx.font = "600 16px system-ui, sans-serif";
  ctx.fillText("Notenstufen (Anzahl) je Szenario", pad.left, 26);

  const n = gradeMatrixLike.length || 1;
  const nSc = Math.max(1, columns.length);
  const groupW = plotW / n;
  const barW = Math.min(32, (groupW * 0.75) / nSc);
  let maxVal = 1;
  for (const row of gradeMatrixLike) {
    for (const cell of row.cells) if (cell.count > maxVal) maxVal = cell.count;
  }
  const yMax = Math.ceil(maxVal * 1.15) || 1;

  for (let i = 0; i <= 4; i++) {
    const val = (yMax * i) / 4;
    const y = pad.top + plotH - (plotH * i) / 4;
    ctx.strokeStyle = i === 0 ? "#94a3b8" : "#e2e8f0";
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + plotW, y);
    ctx.stroke();
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "right";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText(String(Math.round(val)), pad.left - 6, y + 4);
  }

  gradeMatrixLike.forEach((row, gi) => {
    const gx = pad.left + gi * groupW + groupW / 2;
    row.cells.forEach((cell, si) => {
      const h = (cell.count / yMax) * plotH;
      const x =
        gx - (nSc * barW + (nSc - 1) * 2) / 2 + si * (barW + 2);
      const y = pad.top + plotH - h;
      ctx.fillStyle = COLORS[si % COLORS.length];
      ctx.fillRect(x, y, barW, Math.max(h, 0));
    });
    ctx.fillStyle = "#334155";
    ctx.textAlign = "center";
    ctx.font = "10px system-ui, sans-serif";
    const label = row.gradeLabel.length > 12
      ? row.gradeLabel.slice(0, 11) + "…"
      : row.gradeLabel;
    ctx.fillText(label, gx, pad.top + plotH + 14);
  });

  let lx = pad.left;
  columns.forEach((c, i) => {
    ctx.fillStyle = COLORS[i % COLORS.length];
    ctx.fillRect(lx, height - 28, 12, 12);
    ctx.fillStyle = "#0f172a";
    ctx.font = "12px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(c.label, lx + 16, height - 18);
    lx += 16 + ctx.measureText(c.label).width + 18;
  });

  return canvas.toDataURL("image/png");
}
