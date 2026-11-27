/**
 * „Mein Briefkopf“: austauschbarer Kopf für alle PDF-Dokumente und den
 * HTML-/Quarto-Notenspiegel. Gespeichert im Browser (localStorage), als Datei
 * exportier-/importierbar (Weitergabe an Kollegen).
 */

export const LETTERHEAD_STORAGE_KEY = "examgrade-letterhead";
export const LETTERHEAD_FILE_FORMAT = "examgrade-letterhead";
export const DEFAULT_LOGO_URL = "/briefkopf/oth-logo.png";

export type Letterhead = {
  /** Kleine Zeile oben, z. B. „OTH Regensburg · Fakultät Business and Management“ */
  institutionLine: string;
  /** Name, wenn in der Prüfung keine Dozenten eingetragen sind */
  name: string;
  /** Optionaler Link auf den Namen (HTML) */
  link: string;
  /** Fachzeile, wenn kein Prüfungsname übergeben wird */
  subjectLine: string;
  /** Hausfarbe (Hex) */
  color: string;
  /** Eigenes Logo als Data-URL; leer = Standard-Logo */
  logoDataUrl?: string;
  /** Eigener Quarto-HTML-Kopf (include-before-body); leer = aus den Feldern erzeugt */
  customHeaderHtml?: string;
  /** Eigener LaTeX-Kopf (include-in-header) für Quarto-PDF */
  customHeaderTex?: string;
  /** Eigene Quarto-Vorlage für den Notenspiegel */
  customQmd?: string;
};

export const DEFAULT_LETTERHEAD: Letterhead = {
  institutionLine: "OTH Regensburg · Fakultät Business and Management",
  name: "Prof. Dr. Wolfgang Hößl",
  link: "https://elearning.oth-regensburg.de/course/view.php?id=1342",
  subjectLine: "Internationale Finanzmärkte und Asset Management",
  color: "#447099",
};

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function sanitize(raw: unknown): Letterhead {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const str = (k: keyof Letterhead, fallback: string) =>
    typeof o[k] === "string" ? (o[k] as string) : fallback;
  const opt = (k: keyof Letterhead) =>
    typeof o[k] === "string" && (o[k] as string).trim() ? (o[k] as string) : undefined;
  const color = str("color", DEFAULT_LETTERHEAD.color);
  return {
    institutionLine: str("institutionLine", DEFAULT_LETTERHEAD.institutionLine),
    name: str("name", DEFAULT_LETTERHEAD.name),
    link: str("link", DEFAULT_LETTERHEAD.link),
    subjectLine: str("subjectLine", DEFAULT_LETTERHEAD.subjectLine),
    color: /^#[0-9a-f]{6}$/i.test(color) ? color : DEFAULT_LETTERHEAD.color,
    logoDataUrl: opt("logoDataUrl"),
    customHeaderHtml: opt("customHeaderHtml"),
    customHeaderTex: opt("customHeaderTex"),
    customQmd: opt("customQmd"),
  };
}

export function loadLetterhead(): Letterhead {
  if (!isBrowser()) return { ...DEFAULT_LETTERHEAD };
  try {
    const raw = localStorage.getItem(LETTERHEAD_STORAGE_KEY);
    return raw ? sanitize(JSON.parse(raw)) : { ...DEFAULT_LETTERHEAD };
  } catch {
    return { ...DEFAULT_LETTERHEAD };
  }
}

export function saveLetterhead(lh: Letterhead): void {
  if (!isBrowser()) return;
  localStorage.setItem(LETTERHEAD_STORAGE_KEY, JSON.stringify(sanitize(lh)));
  cachedLogo = null;
  void ensureLetterheadAssets();
}

export function resetLetterhead(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(LETTERHEAD_STORAGE_KEY);
  cachedLogo = null;
  void ensureLetterheadAssets();
}

/** Datei zur Weitergabe */
export function letterheadToFile(lh: Letterhead): string {
  return JSON.stringify(
    { format: LETTERHEAD_FILE_FORMAT, version: 1, letterhead: sanitize(lh) },
    null,
    2
  );
}

export function letterheadFromFile(text: string): Letterhead {
  const data = JSON.parse(text) as { format?: string; letterhead?: unknown };
  if (data?.format !== LETTERHEAD_FILE_FORMAT || !data.letterhead) {
    throw new Error("Keine ExamGrade-Briefkopfdatei.");
  }
  return sanitize(data.letterhead);
}

export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) return [68, 112, 153];
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

/** Dunklere Variante der Hausfarbe (Akzent) */
export function darken(hex: string, factor = 0.65): string {
  const [r, g, b] = hexToRgb(hex);
  const f = (v: number) => Math.round(v * factor).toString(16).padStart(2, "0");
  return `#${f(r)}${f(g)}${f(b)}`;
}

// ---------- Logo (für PDF synchron verfügbar machen) ----------

let cachedLogo: { dataUrl: string; width: number; height: number } | null = null;

/** Zwischengespeichertes Logo (nach ensureLetterheadAssets) */
export function cachedLetterheadLogo(): typeof cachedLogo {
  return cachedLogo;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function imageSize(dataUrl: string): Promise<{ width: number; height: number }> {
  return await new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: 1, height: 1 });
    img.src = dataUrl;
  });
}

/** Logo als Data-URL (eigenes oder Standard-Logo) */
export async function resolveLogoDataUrl(lh: Letterhead = loadLetterhead()): Promise<string | null> {
  if (lh.logoDataUrl) return lh.logoDataUrl;
  if (!isBrowser()) return null;
  try {
    const res = await fetch(DEFAULT_LOGO_URL);
    if (!res.ok) return null;
    return await blobToDataUrl(await res.blob());
  } catch {
    return null;
  }
}

/** Logo laden und zwischenspeichern, damit PDF-Exporte es synchron nutzen können. */
export async function ensureLetterheadAssets(): Promise<void> {
  if (cachedLogo || !isBrowser()) return;
  const dataUrl = await resolveLogoDataUrl();
  if (!dataUrl) return;
  const { width, height } = await imageSize(dataUrl);
  cachedLogo = { dataUrl, width, height };
}

// ---------- HTML-/LaTeX-Kopf ----------

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type HeaderContext = {
  /** Namen im Kopf (Dozenten der Prüfung; leer = Briefkopf-Name) */
  names?: string[];
  /** Fachzeile (Prüfungsname; leer = Briefkopf-Fachzeile) */
  subject?: string;
  /** Logo-Quelle im erzeugten HTML (Data-URL oder relativer Pfad) */
  logoSrc?: string | null;
};

export function headerNames(lh: Letterhead, names?: string[] | null): string[] {
  const list = (names ?? []).map((n) => n.trim()).filter(Boolean);
  return list.length ? list : [lh.name].filter(Boolean);
}

/** HTML-Kopf im Stil von oth_hoessl_header.html (aus den Briefkopf-Feldern) */
export function buildHeaderHtml(lh: Letterhead, ctx: HeaderContext = {}): string {
  const names = headerNames(lh, ctx.names);
  const subject = ctx.subject?.trim() || lh.subjectLine;
  const nameHtml = names.map(esc).join(" · ");
  const nameBlock =
    lh.link && names.length === 1 && names[0] === lh.name
      ? `<a href="${esc(lh.link)}">${nameHtml}</a>`
      : nameHtml;
  const c = lh.color;
  const dark = darken(c);
  return `<style>
  .eg-header{--eg-c:${c};--eg-d:${dark};font-family:'Lato',-apple-system,"Segoe UI",Arial,sans-serif;display:flex;align-items:center;gap:1.5rem;padding:1.1rem 1.6rem;margin:0 0 1.75rem 0;background:linear-gradient(135deg,#fff 0%,#eef3f8 140%);border:1px solid #dde3ea;border-radius:12px;box-shadow:0 1px 2px rgba(20,30,45,.04),0 8px 24px -12px rgba(20,30,45,.18);position:relative;overflow:hidden}
  .eg-header::before{content:"";position:absolute;left:0;top:0;bottom:0;width:5px;background:linear-gradient(180deg,var(--eg-c),var(--eg-d))}
  .eg-header__logo{height:62px;width:auto;flex:none;display:block}
  .eg-header__divider{width:1px;align-self:stretch;background:#dde3ea;flex:none}
  .eg-header__eyebrow{margin:0 0 .3rem;font-size:.72rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--eg-c)}
  .eg-header__name{margin:0;font-size:1.35rem;font-weight:700;line-height:1.2;color:#22282f;border:0;padding:0}
  .eg-header__name a{color:#22282f;text-decoration:none}
  .eg-header__name a:hover{color:var(--eg-d)}
  .eg-header__subject{margin:.15rem 0 0;font-size:1rem;color:#5b6470}
  @media (max-width:620px){.eg-header{flex-wrap:wrap}.eg-header__divider{display:none}}
  @media print{.eg-header{box-shadow:none;background:#fff;border:1px solid #ccc}}
</style>
<div class="eg-header">
  ${ctx.logoSrc ? `<img class="eg-header__logo" src="${esc(ctx.logoSrc)}" alt="Logo">\n  <div class="eg-header__divider"></div>` : ""}
  <div class="eg-header__text">
    <p class="eg-header__eyebrow">${esc(lh.institutionLine)}</p>
    <h2 class="eg-header__name">${nameBlock}</h2>
    <p class="eg-header__subject">${esc(subject)}</p>
  </div>
</div>`;
}

function texEsc(s: string): string {
  return s
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/([&%$#_{}])/g, "\\$1")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}")
    .replace(/·/g, "\\textbullet\\ ");
}

/** LaTeX-Kopf (fancyhdr) im Stil von oth_hoessl_header.tex */
export function buildHeaderTex(
  lh: Letterhead,
  ctx: { names?: string[]; subject?: string; logoFile?: string | null } = {}
): string {
  const names = headerNames(lh, ctx.names);
  const subject = ctx.subject?.trim() || lh.subjectLine;
  const hex = lh.color.replace("#", "").toUpperCase();
  const nameTex = texEsc(names.join(" · "));
  return `% ExamGrade-Briefkopf (fancyhdr), erzeugt aus „Mein Briefkopf“
\\usepackage{graphicx}
\\usepackage{fancyhdr}
\\usepackage{xcolor}
\\definecolor{egcolor}{HTML}{${hex}}
\\definecolor{egmuted}{HTML}{5B6470}
\\setlength{\\headheight}{2.2cm}
\\setlength{\\headsep}{1.1cm}
\\fancypagestyle{egheader}{
  \\fancyhf{}
  \\renewcommand{\\headrulewidth}{0pt}
  \\fancyhead[L]{
    ${ctx.logoFile ? `\\begin{minipage}[c]{0.16\\textwidth}\\includegraphics[height=1.6cm]{${ctx.logoFile}}\\end{minipage}%` : ""}
    \\begin{minipage}[c]{${ctx.logoFile ? "0.80" : "0.98"}\\textwidth}
      \\raggedright
      {\\fontsize{7}{8}\\selectfont\\bfseries\\color{egcolor}\\MakeUppercase{${texEsc(lh.institutionLine)}}}\\\\[0.35em]
      {\\large\\bfseries ${nameTex}}\\\\[0.2em]
      \\textcolor{egmuted}{\\normalsize ${texEsc(subject)}}
      \\vspace{0.45em}\\\\
      \\textcolor{egcolor}{\\rule{\\textwidth}{1.2pt}}
    \\end{minipage}
  }
  \\fancyfoot[C]{\\color{egmuted}\\thepage}
}
\\makeatletter
\\let\\ps@plain=\\ps@egheader
\\makeatother
\\pagestyle{egheader}
`;
}
