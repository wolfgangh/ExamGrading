import type {
  EnrichedStudentRow,
  ExamProject,
  ExamStatistics,
} from "@/lib/types";
import {
  buildNotenspiegelData,
  type NotenspiegelData,
  type NotenspiegelOptions,
} from "@/lib/grades/notenspiegel";
import {
  buildHeaderHtml,
  darken,
  loadLetterhead,
  resolveLogoDataUrl,
  type Letterhead,
} from "@/lib/letterhead";
import { downloadBlob } from "@/lib/download";
import { datedExportFilename } from "@/lib/utils";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** JSON sicher in <script type="application/json"> einbetten */
export function embedJson(value: unknown): string {
  // Backslash per Zeichencode, damit kein Werkzeug die Escapes umdeutet
  const bs = String.fromCharCode(92);
  return JSON.stringify(value)
    .replace(/</g, bs + "u003c")
    .replace(/>/g, bs + "u003e")
    .replace(new RegExp(String.fromCharCode(0x2028), "g"), bs + "u2028")
    .replace(new RegExp(String.fromCharCode(0x2029), "g"), bs + "u2029");
}

/** Daten für HTML und Quarto (daten.json) – keine personenbezogenen Daten */
export function notenspiegelJson(data: NotenspiegelData) {
  return {
    format: "examgrade-notenspiegel",
    version: 1,
    pruefung: {
      name: data.examName,
      nummer: data.examNumber,
      semester: data.semester,
      pruefer: data.lecturers,
      szenario: data.scenarioName,
      bestehensgrenze: data.passThreshold,
      maxPunkte: data.maxPoints,
      erstellt: data.generatedAt,
    },
    kennzahlen: data.metrics,
    noten: data.gradeRows.map((g) => ({
      note: g.grade,
      label: g.label,
      anzahl: g.count,
      anteil: g.share,
      stufe: g.bucket,
      farbe: g.color,
    })),
    stufen: data.bucketRows.map((b) => ({
      stufe: b.label,
      anzahl: b.count,
      anteil: b.share,
      farbe: b.color,
    })),
    notenLage: data.gradeStats,
    punkteLage: data.pointStats,
    punkteHistogramm: data.pointsHistogram,
    aufgaben: data.tasks,
    hinweis: data.note,
  };
}

export type NotenspiegelJson = ReturnType<typeof notenspiegelJson>;

const CHART_SCRIPT = String.raw`
(function () {
  var D = JSON.parse(document.getElementById("eg-data").textContent);
  var C = getComputedStyle(document.documentElement).getPropertyValue("--eg-c").trim() || "#447099";
  var tip = document.getElementById("eg-tip");
  function de(n, d) { if (n == null || isNaN(n)) return "–"; return Number(n).toFixed(d == null ? 1 : d).replace(".", ","); }
  function pct(s) { return de(s * 100, 1) + " %"; }
  function showTip(e, html) { tip.innerHTML = html; tip.style.display = "block"; var x = e.clientX + 14, y = e.clientY + 14; if (x + tip.offsetWidth > innerWidth - 8) x = e.clientX - tip.offsetWidth - 14; tip.style.left = x + "px"; tip.style.top = y + "px"; }
  function hideTip() { tip.style.display = "none"; }
  function el(tag, attrs, parent) { var n = document.createElementNS("http://www.w3.org/2000/svg", tag); for (var k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; }
  function txt(parent, x, y, s, attrs) { var t = el("text", Object.assign({ x: x, y: y }, attrs || {}), parent); t.textContent = s; return t; }
  function svgIn(id, w, h) { var host = document.getElementById(id); host.innerHTML = ""; return el("svg", { viewBox: "0 0 " + w + " " + h, width: "100%", role: "img" }, host); }
  function bind(node, html) { node.addEventListener("mousemove", function (e) { showTip(e, html); }); node.addEventListener("mouseleave", hideTip); node.setAttribute("tabindex", "0"); node.addEventListener("focus", function () { var r = node.getBoundingClientRect(); showTip({ clientX: r.right, clientY: r.top }, html); }); node.addEventListener("blur", hideTip); }

  // ---- Notenverteilung ----
  var gMode = "count", gView = "grades";
  function drawGrades() {
    var items = gView === "grades"
      ? D.noten.map(function (g) { return { label: g.label, n: g.anzahl, s: g.anteil, c: g.farbe }; })
      : D.stufen.map(function (b) { return { label: b.stufe, n: b.anzahl, s: b.anteil, c: b.farbe }; });
    var W = 720, H = 300, L = 44, B = 40, T = 16, R = 10;
    var svg = svgIn("eg-grades", W, H);
    var vals = items.map(function (i) { return gMode === "count" ? i.n : i.s * 100; });
    var rawMax = Math.max.apply(null, vals.concat([gMode === "count" ? 1 : 5]));
    var max = gMode === "count" ? Math.max(1, Math.ceil(rawMax / 4)) * 4 : Math.ceil(rawMax / 20) * 20;
    var step = (W - L - R) / items.length;
    for (var k = 0; k <= 4; k++) {
      var v = max * k / 4, y = H - B - (H - B - T) * k / 4;
      el("line", { x1: L, x2: W - R, y1: y, y2: y, stroke: "#e5e7eb" }, svg);
      txt(svg, L - 6, y + 4, gMode === "count" ? de(v, 0) : de(v, 0) + " %", { "text-anchor": "end", class: "eg-ax" });
    }
    items.forEach(function (it, i) {
      var v = vals[i], h = (H - B - T) * (max > 0 ? v / max : 0);
      var x = L + i * step + step * 0.15, w = step * 0.7, y = H - B - h;
      var r = el("rect", { x: x, y: y, width: w, height: Math.max(0, h), rx: 3, fill: it.c, class: "eg-bar" }, svg);
      bind(r, "<b>" + it.label + "</b><br>Anzahl: " + it.n + "<br>Anteil: " + pct(it.s));
      if (v > 0) txt(svg, x + w / 2, y - 4, gMode === "count" ? String(it.n) : de(it.s * 100, 0) + " %", { "text-anchor": "middle", class: "eg-val" });
      txt(svg, x + w / 2, H - B + 16, it.label, { "text-anchor": "middle", class: "eg-ax" });
    });
  }

  // ---- Punkteverteilung ----
  function drawPoints() {
    var host = document.getElementById("eg-points");
    if (!host || !D.punkteLage || !D.punkteHistogramm.length) return;
    var bins = D.punkteHistogramm, P = D.punkteLage, max = D.pruefung.maxPunkte || bins[bins.length - 1].to;
    var W = 720, H = 330, L = 44, B = 84, T = 16, R = 12;
    var svg = svgIn("eg-points", W, H);
    var cstep = Math.max(1, Math.ceil(Math.max.apply(null, bins.map(function (b) { return b.count; }).concat([1])) / 4));
    var cmax = cstep * 4;
    function X(p) { return L + (W - L - R) * p / max; }
    var baseY = H - B;
    for (var k = 0; k <= 4; k++) {
      var v = cstep * k, y = baseY - (baseY - T) * k / 4;
      el("line", { x1: L, x2: W - R, y1: y, y2: y, stroke: "#e5e7eb" }, svg);
      txt(svg, L - 6, y + 4, String(v), { "text-anchor": "end", class: "eg-ax" });
    }
    bins.forEach(function (b) {
      var h = (baseY - T) * b.count / cmax, x = X(b.from) + 1, w = X(b.to) - X(b.from) - 2;
      var r = el("rect", { x: x, y: baseY - h, width: Math.max(0, w), height: Math.max(0, h), rx: 2, fill: C, opacity: b.from + 1e-9 >= D.pruefung.bestehensgrenze ? 0.85 : 0.4, class: "eg-bar" }, svg);
      bind(r, "<b>" + de(b.from, 1) + "–" + de(b.to, 1) + " Punkte</b><br>Anzahl: " + b.count);
    });
    for (var t = 0; t <= 5; t++) { var p = max * t / 5; txt(svg, X(p), baseY + 16, de(p, 0), { "text-anchor": "middle", class: "eg-ax" }); }
    function vline(p, color, label, dash) {
      if (p == null) return;
      var g = el("g", {}, svg);
      el("line", { x1: X(p), x2: X(p), y1: T, y2: baseY, stroke: color, "stroke-width": 2, "stroke-dasharray": dash || "" }, g);
      bind(g, "<b>" + label + "</b><br>" + de(p, 1) + " Punkte");
      el("rect", { x: X(p) - 5, y: T, width: 10, height: baseY - T, fill: "transparent" }, g);
    }
    vline(D.pruefung.bestehensgrenze, "#e11d48", "Bestehensgrenze", "6 4");
    vline(P.median, "#111827", "Median");
    vline(P.mean, "#059669", "Mittelwert", "2 3");
    // Boxplot (Q25–Q75, Median, Mittelwert)
    var by = baseY + 38, bh = 18;
    if (P.q25 != null && P.q75 != null) {
      var box = el("g", {}, svg);
      el("rect", { x: X(P.q25), y: by, width: Math.max(1, X(P.q75) - X(P.q25)), height: bh, fill: C, opacity: 0.25, stroke: C, rx: 3 }, box);
      el("line", { x1: X(P.median), x2: X(P.median), y1: by, y2: by + bh, stroke: "#111827", "stroke-width": 2.5 }, box);
      el("circle", { cx: X(P.mean), cy: by + bh / 2, r: 4, fill: "#059669" }, box);
      bind(box, "<b>Punkte (n=" + P.n + ")</b><br>25 %-Quantil: " + de(P.q25, 1) + "<br>Median: " + de(P.median, 1) + "<br>Mittelwert: " + de(P.mean, 1) + "<br>75 %-Quantil: " + de(P.q75, 1) + "<br>Std.-Abw.: " + de(P.sd, 2));
      txt(svg, L, by + bh + 16, "Box: 25 %–75 %-Quantil · Strich: Median · Punkt: Mittelwert", { class: "eg-ax" });
    }
  }

  // ---- Aufgaben ----
  function drawTasks() {
    var host = document.getElementById("eg-tasks");
    if (!host || !D.aufgaben || !D.aufgaben.length) return;
    var A = D.aufgaben, rowH = 30, L = 170, R = 60, T = 24, W = 720, H = T + A.length * rowH + 30;
    var svg = svgIn("eg-tasks", W, H);
    function X(p) { return L + (W - L - R) * p / 100; }
    for (var k = 0; k <= 4; k++) { var p = k * 25; el("line", { x1: X(p), x2: X(p), y1: T - 6, y2: H - 24, stroke: "#e5e7eb" }, svg); txt(svg, X(p), H - 8, p + " %", { "text-anchor": "middle", class: "eg-ax" }); }
    A.forEach(function (a, i) {
      var y = T + i * rowH, m = a.maxPoints || 1;
      function rel(v) { return v == null ? null : Math.max(0, Math.min(100, v / m * 100)); }
      txt(svg, L - 8, y + rowH / 2 + 4, a.label.length > 26 ? a.label.slice(0, 25) + "…" : a.label, { "text-anchor": "end", class: "eg-lab" });
      var g = el("g", {}, svg);
      el("rect", { x: L, y: y + 4, width: W - L - R, height: rowH - 8, fill: "transparent" }, g);
      if (a.q25 != null && a.q75 != null) el("rect", { x: X(rel(a.q25)), y: y + 8, width: Math.max(1, X(rel(a.q75)) - X(rel(a.q25))), height: rowH - 16, fill: C, opacity: 0.25, stroke: C, rx: 3 }, g);
      if (a.median != null) el("line", { x1: X(rel(a.median)), x2: X(rel(a.median)), y1: y + 7, y2: y + rowH - 7, stroke: "#111827", "stroke-width": 2.5 }, g);
      if (a.mean != null) el("circle", { cx: X(rel(a.mean)), cy: y + rowH / 2, r: 4, fill: "#059669" }, g);
      txt(svg, W - R + 8, y + rowH / 2 + 4, a.solveRate != null ? de(a.solveRate * 100, 0) + " %" : "–", { class: "eg-val" });
      bind(g, "<b>" + a.label + "</b> (max. " + de(a.maxPoints, 1) + ", n=" + a.n + ")<br>Mittelwert: " + de(a.mean, 2) + "<br>Median: " + de(a.median, 2) + "<br>25 %- / 75 %-Quantil: " + de(a.q25, 2) + " / " + de(a.q75, 2) + "<br>Lösungsquote: " + (a.solveRate != null ? pct(a.solveRate) : "–"));
    });
    txt(svg, W - R + 8, T - 8, "Quote", { class: "eg-ax" });
  }

  document.querySelectorAll("[data-gmode]").forEach(function (b) { b.addEventListener("click", function () { gMode = b.getAttribute("data-gmode"); document.querySelectorAll("[data-gmode]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); }); drawGrades(); }); });
  document.querySelectorAll("[data-gview]").forEach(function (b) { b.addEventListener("click", function () { gView = b.getAttribute("data-gview"); document.querySelectorAll("[data-gview]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); }); drawGrades(); }); });
  drawGrades(); drawPoints(); drawTasks();
})();
`;

function fmt(n: number | null | undefined, d = 1): string {
  if (n == null || !Number.isFinite(n)) return "–";
  return n.toFixed(d).replace(".", ",");
}

/**
 * Eigenständige HTML-Datei (Quarto-Look, interaktive SVG-Diagramme, keine
 * externen Abhängigkeiten außer optionaler Webfont).
 */
export function buildNotenspiegelHtml(
  data: NotenspiegelData,
  input: { headerHtml: string; color: string }
): string {
  const json = notenspiegelJson(data);
  const kpis = data.metrics
    .map(
      (m) =>
        `<div class="eg-kpi"><div class="eg-kpi__v">${esc(m.value)}</div><div class="eg-kpi__l">${esc(m.label)}</div></div>`
    )
    .join("");
  const gradeTable = data.gradeRows
    .map(
      (g) =>
        `<tr><td><span class="eg-dot" style="background:${g.color}"></span>${esc(g.label)}</td><td class="r">${g.count}</td><td class="r">${fmt(g.share * 100)} %</td></tr>`
    )
    .join("");
  const bucketTable = data.bucketRows
    .map(
      (b) =>
        `<tr><td><span class="eg-dot" style="background:${b.color}"></span>${esc(b.label)}</td><td class="r">${b.count}</td><td class="r">${fmt(b.share * 100)} %</td></tr>`
    )
    .join("");
  const taskRows = (data.tasks ?? [])
    .map(
      (t) =>
        `<tr><td>${esc(t.label)}</td><td class="r">${fmt(t.maxPoints)}</td><td class="r">${t.n}</td><td class="r">${fmt(t.mean, 2)}</td><td class="r">${fmt(t.median, 2)}</td><td class="r">${fmt(t.q25, 2)}</td><td class="r">${fmt(t.q75, 2)}</td><td class="r">${t.solveRate != null ? fmt(t.solveRate * 100) + " %" : "–"}</td></tr>`
    )
    .join("");
  const taskKind = data.tasks?.[0]?.kind === "subArea" ? "Teilgebiet" : "Aufgabe";
  const created = new Date(data.generatedAt).toLocaleDateString("de-DE");
  const c = input.color;

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="ExamGrade">
<title>Notenspiegel – ${esc(data.examName)}</title>
<style>
:root{--eg-c:${c};--eg-d:${darken(c)}}
*{box-sizing:border-box}
body{margin:0;background:#fff;color:#22282f;font-family:'Lato',-apple-system,"Segoe UI",Arial,sans-serif;line-height:1.5}
main{max-width:960px;margin:0 auto;padding:2rem 1.25rem 3rem}
h1{font-size:1.9rem;margin:.2rem 0 .2rem;font-weight:700}
h2.eg-sec{font-size:1.25rem;margin:2.2rem 0 .8rem;padding-bottom:.3rem;border-bottom:1px solid #dde3ea}
.eg-meta{display:grid;grid-template-columns:max-content 1fr;gap:.15rem 1rem;color:#5b6470;font-size:.95rem;margin:.6rem 0 0}
.eg-meta dt{font-weight:700;color:#22282f}.eg-meta dd{margin:0}
.eg-kpis{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:.6rem}
.eg-kpi{border:1px solid #dde3ea;border-left:4px solid var(--eg-c);border-radius:8px;padding:.55rem .75rem;background:#fafbfc}
.eg-kpi__v{font-size:1.25rem;font-weight:700;font-variant-numeric:tabular-nums}
.eg-kpi__l{font-size:.8rem;color:#5b6470}
.eg-card{border:1px solid #dde3ea;border-radius:12px;padding:1rem;background:#fff}
.eg-tools{display:flex;flex-wrap:wrap;gap:.4rem;margin-bottom:.6rem}
.eg-tools button{font:inherit;font-size:.85rem;border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:.2rem .8rem;cursor:pointer}
.eg-tools button[aria-pressed="true"]{background:var(--eg-c);border-color:var(--eg-c);color:#fff}
.eg-tools .sep{width:1px;background:#dde3ea;margin:0 .3rem}
table{border-collapse:collapse;width:100%;font-size:.92rem;font-variant-numeric:tabular-nums}
th,td{padding:.35rem .55rem;border-bottom:1px solid #eef1f4;text-align:left}
th{background:#f3f6f9;font-weight:700}
td.r,th.r{text-align:right}
.eg-dot{display:inline-block;width:.7rem;height:.7rem;border-radius:2px;margin-right:.45rem;vertical-align:-1px}
.eg-two{display:grid;grid-template-columns:1fr 1fr;gap:1rem;align-items:start}
@media (max-width:720px){.eg-two{grid-template-columns:1fr}}
.eg-ax{font-size:11px;fill:#5b6470}.eg-val{font-size:11px;fill:#22282f;font-weight:700}.eg-lab{font-size:12px;fill:#22282f}
.eg-bar{cursor:pointer;transition:opacity .15s}.eg-bar:hover{opacity:.75}
#eg-tip{position:fixed;display:none;pointer-events:none;background:#111827;color:#fff;font-size:.82rem;padding:.4rem .6rem;border-radius:6px;box-shadow:0 6px 16px rgba(0,0,0,.2);z-index:10;max-width:280px}
.eg-note{color:#5b6470;font-size:.85rem;margin-top:2rem}
footer{color:#8b93a0;font-size:.8rem;margin-top:1rem}
@media print{.eg-tools{display:none}#eg-tip{display:none!important}.eg-card{break-inside:avoid}}
</style>
</head>
<body>
<main>
${input.headerHtml}
<h1>Notenspiegel</h1>
<dl class="eg-meta">
<dt>Prüfung</dt><dd>${esc(data.examName)}</dd>
<dt>Prüfungsnummer</dt><dd>${esc(data.examNumber)}</dd>
<dt>Semester</dt><dd>${esc(data.semester)}</dd>
<dt>Prüfer</dt><dd>${esc(data.lecturers)}</dd>
<dt>Notenschlüssel</dt><dd>${esc(data.scenarioName)}</dd>
</dl>

<h2 class="eg-sec">Kennzahlen</h2>
<div class="eg-kpis">${kpis}</div>

<h2 class="eg-sec">Notenverteilung</h2>
<div class="eg-card">
<div class="eg-tools" role="group" aria-label="Darstellung">
<button type="button" data-gmode="count" aria-pressed="true">Anzahl</button>
<button type="button" data-gmode="share" aria-pressed="false">Prozent</button>
<span class="sep"></span>
<button type="button" data-gview="grades" aria-pressed="true">Einzelnoten</button>
<button type="button" data-gview="buckets" aria-pressed="false">Notenstufen</button>
</div>
<div id="eg-grades"></div>
</div>
<div class="eg-two" style="margin-top:1rem">
<table><thead><tr><th>Note</th><th class="r">Anzahl</th><th class="r">Anteil</th></tr></thead><tbody>${gradeTable}</tbody></table>
<table><thead><tr><th>Notenstufe</th><th class="r">Anzahl</th><th class="r">Anteil</th></tr></thead><tbody>${bucketTable}</tbody></table>
</div>
${
  data.pointStats && data.pointsHistogram.length
    ? `<h2 class="eg-sec">Punkteverteilung</h2>
<div class="eg-card"><div id="eg-points"></div>
<p class="eg-ax" style="margin:.3rem 0 0;font-size:.82rem">Rot gestrichelt: Bestehensgrenze (${fmt(data.passThreshold)} Punkte) · Schwarz: Median · Grün: Mittelwert</p></div>`
    : ""
}
${
  data.tasks && data.tasks.length
    ? `<h2 class="eg-sec">Auswertung je ${taskKind}</h2>
<div class="eg-card"><div id="eg-tasks"></div>
<p class="eg-ax" style="margin:.3rem 0 0;font-size:.82rem">In % der Maximalpunkte · Box: 25 %–75 %-Quantil · Strich: Median · Punkt: Mittelwert</p></div>
<table style="margin-top:1rem"><thead><tr><th>${taskKind}</th><th class="r">Max.</th><th class="r">n</th><th class="r">Mittelwert</th><th class="r">Median</th><th class="r">Q25</th><th class="r">Q75</th><th class="r">Lösungsquote</th></tr></thead><tbody>${taskRows}</tbody></table>`
    : ""
}
<p class="eg-note">${esc(data.note)}</p>
<footer>Erstellt am ${esc(created)} mit ExamGrade</footer>
</main>
<div id="eg-tip" role="tooltip"></div>
<script type="application/json" id="eg-data">${embedJson(json)}</script>
<script>${CHART_SCRIPT}</script>
</body>
</html>
`;
}

export function headerHtmlFor(
  lh: Letterhead,
  project: Pick<ExamProject, "lecturers" | "name">,
  logoSrc: string | null
): string {
  return (
    lh.customHeaderHtml ??
    buildHeaderHtml(lh, {
      names: project.lecturers,
      subject: project.name,
      logoSrc,
    })
  );
}

/** HTML-Notenspiegel erzeugen und herunterladen */
export async function exportNotenspiegelHtml(
  project: ExamProject,
  rows: EnrichedStudentRow[],
  stats: ExamStatistics,
  options: NotenspiegelOptions = {}
): Promise<void> {
  if (stats.graded <= 0) {
    throw new Error("Keine bewerteten Teilnehmer – Notenspiegel nicht sinnvoll.");
  }
  const data = buildNotenspiegelData(project, rows, stats, options);
  const lh = loadLetterhead();
  const logo = lh.customHeaderHtml ? null : await resolveLogoDataUrl(lh);
  const html = buildNotenspiegelHtml(data, {
    headerHtml: headerHtmlFor(lh, project, logo),
    color: lh.color,
  });
  await downloadBlob(
    datedExportFilename(`Notenspiegel_${project.name || "Pruefung"}`, "html"),
    new Blob([html], { type: "text/html;charset=utf-8" })
  );
}
