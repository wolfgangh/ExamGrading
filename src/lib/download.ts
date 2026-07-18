/**
 * Robuste clientseitige Datei-Downloads – inkl. MS-Teams-Website-Tab (iframe),
 * wo programmatische a[download]-Klicks oft blockiert werden.
 */

export type DownloadResult =
  | { method: "anchor" | "file-picker" | "window-open" | "manual-link" }
  | { method: "failed"; error: string };

/** Teams Desktop/Web-Tab oder generisches iframe-Embedding */
export function isLikelyTeamsOrIframeEmbed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const ua = navigator.userAgent || "";
    if (/Teams\//i.test(ua) || /TeamProducts/i.test(ua)) return true;
    if (/\bMSTeams\b/i.test(ua)) return true;
    // Website-Tab läuft typischerweise im iframe
    if (window.parent != null && window.parent !== window) return true;
    if (window.top != null && window.top !== window) return true;
  } catch {
    // cross-origin parent access → embedded
    return true;
  }
  return false;
}

function extensionOf(filename: string): string {
  const m = filename.match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toLowerCase() : "";
}

function mimeForFilename(filename: string, blobType: string): string {
  if (blobType && blobType !== "application/octet-stream") return blobType;
  const ext = extensionOf(filename);
  const map: Record<string, string> = {
    json: "application/json",
    pdf: "application/pdf",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    xls: "application/vnd.ms-excel",
    csv: "text/csv",
    zip: "application/zip",
  };
  return map[ext] ?? "application/octet-stream";
}

type SaveFilePickerOptions = {
  suggestedName?: string;
  types?: {
    description: string;
    accept: Record<string, string[]>;
  }[];
};

type WindowWithPicker = Window & {
  showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<{
    createWritable: () => Promise<{
      write: (data: Blob) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;
};

async function tryFilePicker(
  filename: string,
  blob: Blob
): Promise<boolean> {
  const w = window as WindowWithPicker;
  if (typeof w.showSaveFilePicker !== "function") return false;
  try {
    const ext = extensionOf(filename);
    const mime = mimeForFilename(filename, blob.type);
    const handle = await w.showSaveFilePicker({
      suggestedName: filename,
      types: ext
        ? [
            {
              description: "Export",
              accept: { [mime]: [`.${ext}`] },
            },
          ]
        : undefined,
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return true;
  } catch (e) {
    // User abort oder nicht unterstützt
    if (e instanceof DOMException && e.name === "AbortError") {
      throw e; // absichtlich abgebrochen – nicht als Fehler der App
    }
    return false;
  }
}

function tryAnchorDownload(filename: string, blob: Blob): boolean {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    // verzögert freigeben – manche WebViews brauchen das
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 60_000);
    return true;
  } catch {
    return false;
  }
}

function tryWindowOpen(blob: Blob): boolean {
  try {
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank", "noopener,noreferrer");
    if (!win) {
      URL.revokeObjectURL(url);
      return false;
    }
    setTimeout(() => URL.revokeObjectURL(url), 120_000);
    return true;
  } catch {
    return false;
  }
}

const FALLBACK_ID = "examgrade-download-fallback";

/** Sichtbarer Link, wenn automatische Downloads blockiert sind (Teams etc.) */
export function showManualDownloadBar(filename: string, blob: Blob): void {
  if (typeof document === "undefined") return;
  const prev = document.getElementById(FALLBACK_ID);
  if (prev) prev.remove();

  const url = URL.createObjectURL(blob);
  const bar = document.createElement("div");
  bar.id = FALLBACK_ID;
  bar.setAttribute("role", "status");
  bar.style.cssText = [
    "position:fixed",
    "left:0",
    "right:0",
    "bottom:0",
    "z-index:99999",
    "padding:12px 16px",
    "background:#1e293b",
    "color:#f8fafc",
    "font:14px/1.4 system-ui,sans-serif",
    "box-shadow:0 -4px 20px rgba(0,0,0,.25)",
    "display:flex",
    "flex-wrap:wrap",
    "align-items:center",
    "gap:12px",
  ].join(";");

  const text = document.createElement("span");
  text.style.flex = "1 1 200px";
  text.textContent =
    "Automatischer Download blockiert (z. B. MS Teams). Datei manuell speichern:";

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.textContent = filename;
  link.style.cssText =
    "color:#93c5fd;font-weight:600;word-break:break-all;text-decoration:underline";

  const openBrowser = document.createElement("a");
  openBrowser.href = window.location.href;
  openBrowser.target = "_blank";
  openBrowser.rel = "noopener noreferrer";
  openBrowser.textContent = "Im Browser öffnen";
  openBrowser.style.cssText =
    "color:#e2e8f0;text-decoration:underline;white-space:nowrap";

  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "Schließen";
  close.style.cssText =
    "border:1px solid #64748b;background:transparent;color:#f8fafc;padding:6px 10px;border-radius:6px;cursor:pointer";
  close.onclick = () => {
    URL.revokeObjectURL(url);
    bar.remove();
  };

  bar.append(text, link, openBrowser, close);
  document.body.appendChild(bar);
}

/**
 * Speichert/exportiert eine Datei möglichst zuverlässig.
 * In normalen Browsern: Anchor-Download.
 * In Teams/iframe: File-Picker, dann Anchor, dann manueller Link.
 */
export async function downloadBlob(
  filename: string,
  blob: Blob
): Promise<DownloadResult> {
  if (typeof window === "undefined") {
    return { method: "failed", error: "Kein Browser-Kontext" };
  }

  const restricted = isLikelyTeamsOrIframeEmbed();
  const safeName = filename.replace(/[\\/:*?"<>|]+/g, "_");

  // In Embeddings zuerst nativen Speichern-Dialog (User-Geste erhalten)
  if (restricted) {
    try {
      if (await tryFilePicker(safeName, blob)) {
        return { method: "file-picker" };
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        return { method: "failed", error: "Speichern abgebrochen" };
      }
    }
  }

  if (tryAnchorDownload(safeName, blob)) {
    // In Teams oft „erfolgreich“ ohne sichtbare Datei → Fallback-Bar anbieten
    if (restricted) {
      // kurze Verzögerung, dann manuellen Link anbieten falls User nichts sieht
      setTimeout(() => {
        // nur anzeigen wenn noch keine Bar von anderem Export
        if (!document.getElementById(FALLBACK_ID)) {
          showManualDownloadBar(safeName, blob);
        }
      }, 800);
    }
    return { method: restricted ? "manual-link" : "anchor" };
  }

  if (!restricted) {
    try {
      if (await tryFilePicker(safeName, blob)) {
        return { method: "file-picker" };
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        return { method: "failed", error: "Speichern abgebrochen" };
      }
    }
  }

  if (tryWindowOpen(blob)) {
    return { method: "window-open" };
  }

  showManualDownloadBar(safeName, blob);
  return { method: "manual-link" };
}

export async function downloadJson(
  filename: string,
  data: string
): Promise<DownloadResult> {
  return downloadBlob(
    filename,
    new Blob([data], { type: "application/json;charset=utf-8" })
  );
}
