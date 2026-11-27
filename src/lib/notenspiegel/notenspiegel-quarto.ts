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
  buildHeaderTex,
  loadLetterhead,
  resolveLogoDataUrl,
} from "@/lib/letterhead";
import { notenspiegelJson } from "@/lib/notenspiegel/notenspiegel-html";
import {
  dataUrlToUint8Array,
  renderGradeDistributionChartPng,
} from "@/lib/charts/grade-distribution-export-chart";
import { downloadBlob } from "@/lib/download";
import { datedExportFilename } from "@/lib/utils";

export const DEFAULT_QMD_URL = "/briefkopf/notenspiegel.qmd";
export const DEFAULT_SCSS_URL = "/briefkopf/notenspiegel.scss";

function fmt(n: number | null | undefined, d = 1): string {
  if (n == null || !Number.isFinite(n)) return "–";
  return n.toFixed(d).replace(".", ",");
}

function cell(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function mdTable(head: string[], rows: string[][], right: number[] = []): string {
  const align = head.map((_, i) => (right.includes(i) ? "---:" : "---"));
  return [
    `| ${head.map(cell).join(" | ")} |`,
    `| ${align.join(" | ")} |`,
    ...rows.map((r) => `| ${r.map(cell).join(" | ")} |`),
  ].join("\n");
}

/** Platzhalter der Quarto-Vorlage → Werte (Markdown) */
export function notenspiegelPlaceholders(
  data: NotenspiegelData
): Record<string, string> {
  const yamlSafe = (s: string) => s.replace(/"/g, "'");
  const tasks = data.tasks ?? [];
  const taskKind = tasks[0]?.kind === "subArea" ? "Teilgebiet" : "Aufgabe";
  return {
    pruefung: yamlSafe(data.examName),
    nummer: cell(data.examNumber),
    semester: cell(data.semester),
    pruefer: cell(data.lecturers),
    szenario: cell(data.scenarioName),
    erstellt: new Date(data.generatedAt).toLocaleDateString("de-DE"),
    datum_iso: data.generatedAt.slice(0, 10),
    tabelle_kennzahlen: mdTable(
      ["Kennzahl", "Wert"],
      data.metrics.map((m) => [m.label, m.value]),
      [1]
    ),
    tabelle_noten: mdTable(
      ["Note", "Anzahl", "Anteil"],
      data.gradeRows.map((g) => [g.label, String(g.count), `${fmt(g.share * 100)} %`]),
      [1, 2]
    ),
    tabelle_stufen: mdTable(
      ["Notenstufe", "Anzahl", "Anteil"],
      data.bucketRows.map((b) => [b.label, String(b.count), `${fmt(b.share * 100)} %`]),
      [1, 2]
    ),
    tabelle_aufgaben: tasks.length
      ? mdTable(
          [taskKind, "Max.", "n", "Mittelwert", "Median", "Q25", "Q75", "Lösungsquote"],
          tasks.map((t) => [
            t.label,
            fmt(t.maxPoints),
            String(t.n),
            fmt(t.mean, 2),
            fmt(t.median, 2),
            fmt(t.q25, 2),
            fmt(t.q75, 2),
            t.solveRate != null ? `${fmt(t.solveRate * 100)} %` : "–",
          ]),
          [1, 2, 3, 4, 5, 6, 7]
        )
      : "",
    hinweis: data.note,
  };
}

/** {{platzhalter}} ersetzen; unbekannte bleiben stehen */
export function fillQmdTemplate(
  template: string,
  values: Record<string, string>
): string {
  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (m, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : m
  );
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Vorlage nicht gefunden: ${url}`);
  return await res.text();
}

const README = `ExamGrade – Quarto-Paket Notenspiegel
=====================================

Inhalt
  notenspiegel.qmd     Vorlage (anpassbar; eigene Vorlage unter „Mein Briefkopf“ hinterlegbar)
  daten.json           Daten (Format "examgrade-notenspiegel", keine Personendaten)
  header.html          Briefkopf für HTML (include-before-body)
  header.tex           Briefkopf für PDF (include-in-header, fancyhdr)
  logo.png             Logo aus dem Briefkopf
  notenspiegel.scss    Stil (HTML)
  notenverteilung.png  statisches Diagramm für das PDF

Rendern (Quarto ≥ 1.4, kein R/Python nötig)
  quarto render notenspiegel.qmd            -> notenspiegel.html (interaktiv)
  quarto render notenspiegel.qmd --to pdf   -> notenspiegel.pdf

Hinweis: Die interaktiven Diagramme (Observable JS) laden ihre Bibliothek beim
Öffnen aus dem Netz. Für eine Datei ohne Netzbezug den HTML-Notenspiegel direkt
aus ExamGrade verwenden.
`;

/** Quarto-Paket (ZIP) erzeugen und herunterladen */
export async function exportNotenspiegelQuarto(
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
  const [template, scss, logo] = await Promise.all([
    lh.customQmd ? Promise.resolve(lh.customQmd) : fetchText(DEFAULT_QMD_URL),
    fetchText(DEFAULT_SCSS_URL),
    resolveLogoDataUrl(lh),
  ]);

  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  zip.file("notenspiegel.qmd", fillQmdTemplate(template, notenspiegelPlaceholders(data)));
  zip.file("daten.json", JSON.stringify(notenspiegelJson(data), null, 2));
  zip.file(
    "header.html",
    lh.customHeaderHtml ??
      buildHeaderHtml(lh, {
        names: project.lecturers,
        subject: project.name,
        logoSrc: logo ? "logo.png" : null,
      })
  );
  zip.file(
    "header.tex",
    lh.customHeaderTex ??
      buildHeaderTex(lh, {
        names: project.lecturers,
        subject: project.name,
        logoFile: logo ? "logo.png" : null,
      })
  );
  if (logo) zip.file("logo.png", dataUrlToUint8Array(logo));
  zip.file("notenspiegel.scss", scss);
  zip.file(
    "notenverteilung.png",
    dataUrlToUint8Array(
      renderGradeDistributionChartPng(data, { width: 1400, height: 620, scale: 2 })
    )
  );
  zip.file("LIESMICH.txt", README);

  const blob = await zip.generateAsync({ type: "blob" });
  await downloadBlob(
    datedExportFilename(`Notenspiegel_Quarto_${project.name || "Pruefung"}`, "zip"),
    blob
  );
}
