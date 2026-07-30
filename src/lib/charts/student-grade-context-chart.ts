import { formatGrade } from "@/lib/utils";

const GRADE_KEYS = [1, 1.3, 1.7, 2, 2.3, 2.7, 3, 3.3, 3.7, 4, 5] as const;

/** Farben analog Notenspiegel-Stufen */
function colorForGrade(g: number): string {
  if (g <= 1.5) return "#15803d";
  if (g <= 2.5) return "#3b82f6";
  if (g <= 3.5) return "#eab308";
  if (g <= 4.05) return "#f97316";
  return "#dc2626";
}

export type StudentGradeRankInfo = {
  /** 1 = beste Note in der Kohorte */
  rank: number;
  total: number;
  /**
   * „unter den besten X %“ (1…100).
   * Rang 1 von 50 → 2 % (aufgerundet mind. 1).
   */
  topPercent: number;
  studentGrade: number;
};

/**
 * Rang und Top-% in der Kohorte (deutsche Noten: kleinere Zahl = besser).
 */
export function computeStudentGradeRank(
  studentGrade: number | null | undefined,
  cohortGrades: number[]
): StudentGradeRankInfo | null {
  if (studentGrade == null || !Number.isFinite(studentGrade)) return null;
  const grades = cohortGrades.filter((g) => Number.isFinite(g));
  if (grades.length === 0) return null;
  const better = grades.filter((g) => g < studentGrade - 0.04).length;
  const rank = better + 1;
  const topPercent = Math.min(
    100,
    Math.max(1, Math.ceil((rank / grades.length) * 100))
  );
  return {
    rank,
    total: grades.length,
    topPercent,
    studentGrade,
  };
}

export function cohortGradesFromRows(
  rows: { finalGrade: number | null; status: string; attended: boolean | null }[]
): number[] {
  return rows
    .filter(
      (r) =>
        r.finalGrade != null &&
        Number.isFinite(r.finalGrade) &&
        r.status !== "no_show" &&
        r.attended !== false
    )
    .map((r) => r.finalGrade as number);
}

/**
 * Notenverteilung der Kohorte mit Markierung der Studierenden-Note.
 * PNG data-URL für PDF-Einbettung.
 */
export function renderStudentGradeContextChartPng(opts: {
  distribution: { grade: number; count: number }[];
  studentGrade: number | null;
  rankInfo: StudentGradeRankInfo | null;
  averageGrade?: number | null;
  width?: number;
  height?: number;
  scale?: number;
}): string {
  const width = opts.width ?? 1100;
  const height = opts.height ?? 420;
  const scale = Math.max(1, opts.scale ?? 2);

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas nicht verfügbar für Notenverteilungs-Diagramm.");
  }
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const pad = { top: 48, right: 24, bottom: 72, left: 48 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const distMap = new Map(
    opts.distribution.map((d) => [d.grade, d.count] as const)
  );
  const rows = GRADE_KEYS.map((grade) => ({
    grade,
    count: distMap.get(grade) ?? 0,
    label: formatGrade(grade),
  }));
  const n = rows.length;
  const maxCount = Math.max(1, ...rows.map((r) => r.count));
  const yMax = Math.max(1, Math.ceil(maxCount * 1.2));

  // Titel
  ctx.fillStyle = "#0f172a";
  ctx.font = "600 16px system-ui, -apple-system, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Notenverteilung der Kohorte", pad.left, 22);

  if (opts.rankInfo) {
    const sub = `Ihre Note ${formatGrade(opts.rankInfo.studentGrade)} · unter den besten ${opts.rankInfo.topPercent} % · Rang ${opts.rankInfo.rank} von ${opts.rankInfo.total}`;
    ctx.fillStyle = "#1d4ed8";
    ctx.font = "600 13px system-ui, -apple-system, sans-serif";
    ctx.fillText(sub, pad.left, 40);
  }

  // Rahmen
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1;
  ctx.strokeRect(pad.left + 0.5, pad.top + 0.5, plotW - 1, plotH - 1);

  // Gitter
  const gridLines = 4;
  for (let i = 0; i <= gridLines; i++) {
    const val = (yMax * i) / gridLines;
    const y = pad.top + plotH - (plotH * i) / gridLines;
    ctx.strokeStyle = i === 0 ? "#94a3b8" : "#e2e8f0";
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + plotW, y);
    ctx.stroke();
    ctx.fillStyle = "#64748b";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(String(Math.round(val)), pad.left - 6, y + 3);
  }

  const gap = 0.22;
  const slot = plotW / n;
  const barW = slot * (1 - gap);
  const studentG = opts.studentGrade;

  rows.forEach((r, i) => {
    const h = (r.count / yMax) * plotH;
    const x = pad.left + i * slot + (slot - barW) / 2;
    const y = pad.top + plotH - h;
    const isStudent =
      studentG != null &&
      Number.isFinite(studentG) &&
      Math.abs(r.grade - studentG) < 0.05;

    ctx.fillStyle = isStudent ? "#1d4ed8" : colorForGrade(r.grade);
    if (isStudent) {
      // Rahmen hervorheben
      ctx.fillRect(x, y, barW, Math.max(h, r.count > 0 ? 3 : 0));
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, barW, Math.max(h, r.count > 0 ? 3 : 0));
    } else {
      ctx.globalAlpha = 0.85;
      ctx.fillRect(x, y, barW, Math.max(h, r.count > 0 ? 2 : 0));
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = "#334155";
    ctx.font = isStudent
      ? "700 11px system-ui, sans-serif"
      : "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(r.label, x + barW / 2, pad.top + plotH + 16);

    if (r.count > 0) {
      ctx.fillStyle = isStudent ? "#1d4ed8" : "#0f172a";
      ctx.font = "600 11px system-ui, sans-serif";
      ctx.fillText(String(r.count), x + barW / 2, y - 5);
    }

    if (isStudent) {
      ctx.fillStyle = "#1d4ed8";
      ctx.font = "700 10px system-ui, sans-serif";
      ctx.fillText("Sie", x + barW / 2, pad.top + plotH + 30);
    }
  });

  // Y-Label
  ctx.save();
  ctx.fillStyle = "#64748b";
  ctx.font = "11px system-ui, sans-serif";
  ctx.translate(14, pad.top + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.fillText("Anzahl", 0, 0);
  ctx.restore();

  // Legende
  ctx.textAlign = "left";
  ctx.font = "11px system-ui, sans-serif";
  let lx = pad.left;
  const ly = height - 22;
  ctx.fillStyle = "#1d4ed8";
  ctx.fillRect(lx, ly - 8, 12, 12);
  ctx.fillStyle = "#334155";
  ctx.fillText("Ihre Note", lx + 16, ly + 2);
  lx += 90;
  if (opts.averageGrade != null && Number.isFinite(opts.averageGrade)) {
    ctx.fillStyle = "#64748b";
    ctx.fillText(
      `Ø Kohorte ${formatGrade(opts.averageGrade)}`,
      lx,
      ly + 2
    );
  }

  return canvas.toDataURL("image/png");
}
