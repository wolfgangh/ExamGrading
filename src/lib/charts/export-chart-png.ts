import { downloadBlob } from "@/lib/download";
import { datedExportFilename } from "@/lib/utils";

/**
 * Exportiert das erste SVG in einem Container als PNG-Download.
 * Heller Hintergrund für Druck/Austausch.
 */
export async function exportSvgContainerAsPng(
  container: HTMLElement | null,
  filenameBase: string,
  opts?: { scale?: number }
): Promise<void> {
  if (!container) throw new Error("Diagramm-Container nicht gefunden.");
  const svg = container.querySelector("svg");
  if (!svg) throw new Error("Kein SVG-Diagramm zum Export gefunden.");

  const scale = Math.max(1, opts?.scale ?? 2);
  const bbox = svg.getBoundingClientRect();
  const width = Math.max(1, Math.ceil(bbox.width || Number(svg.getAttribute("width")) || 800));
  const height = Math.max(
    1,
    Math.ceil(bbox.height || Number(svg.getAttribute("height")) || 400)
  );

  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  // Export: dunkle Theme-Farben → lesbare Fallback-Farben wo nötig
  if (!clone.getAttribute("viewBox")) {
    clone.setAttribute("viewBox", `0 0 ${width} ${height}`);
  }

  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(clone);
  const svgBlob = new Blob([svgStr], {
    type: "image/svg+xml;charset=utf-8",
  });
  const url = URL.createObjectURL(svgBlob);

  try {
    const img = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas nicht verfügbar.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("PNG-Erzeugung fehlgeschlagen"))),
        "image/png"
      );
    });
    await downloadBlob(datedExportFilename(filenameBase, "png"), blob);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("SVG konnte nicht geladen werden."));
    img.src = url;
  });
}
