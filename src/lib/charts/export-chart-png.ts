import { downloadBlob } from "@/lib/download";
import { datedExportFilename } from "@/lib/utils";

export type ExportChartPngOptions = {
  scale?: number;
  /** Diagrammtitel im PNG (oberhalb) */
  title?: string;
  /** Unterzeile / Beschreibung im PNG */
  description?: string;
};

/**
 * Exportiert das erste SVG in einem Container als PNG-Download.
 * Optional Titel/Beschreibung auf dem Canvas; SVG-Texte export-sicher einfärben.
 */
export async function exportSvgContainerAsPng(
  container: HTMLElement | null,
  filenameBase: string,
  opts?: ExportChartPngOptions
): Promise<void> {
  if (!container) throw new Error("Diagramm-Container nicht gefunden.");
  const svg = container.querySelector("svg");
  if (!svg) throw new Error("Kein SVG-Diagramm zum Export gefunden.");

  const scale = Math.max(1, opts?.scale ?? 2);
  const title = opts?.title?.trim() || "";
  const description = opts?.description?.trim() || "";
  const headerH =
    (title ? 28 : 0) + (description ? 18 : 0) + (title || description ? 12 : 0);

  const bbox = svg.getBoundingClientRect();
  const chartW = Math.max(
    1,
    Math.ceil(bbox.width || Number(svg.getAttribute("width")) || 800)
  );
  const chartH = Math.max(
    1,
    Math.ceil(bbox.height || Number(svg.getAttribute("height")) || 400)
  );

  const clone = svg.cloneNode(true) as SVGSVGElement;
  prepareSvgForExport(clone, chartW, chartH);

  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(clone);
  const svgBlob = new Blob([svgStr], {
    type: "image/svg+xml;charset=utf-8",
  });
  const url = URL.createObjectURL(svgBlob);

  try {
    const img = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(chartW * scale);
    canvas.height = Math.round((chartH + headerH) * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas nicht verfügbar.");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    let y = 8;
    if (title) {
      ctx.fillStyle = "#0f172a";
      ctx.font = "600 18px system-ui, -apple-system, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(title, 12, y + 16);
      y += 28;
    }
    if (description) {
      ctx.fillStyle = "#475569";
      ctx.font = "13px system-ui, -apple-system, sans-serif";
      ctx.fillText(description, 12, y + 12);
      y += 18;
    }
    if (title || description) y += 8;

    ctx.drawImage(img, 0, y, chartW, chartH);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) =>
          b
            ? resolve(b)
            : reject(new Error("PNG-Erzeugung fehlgeschlagen")),
        "image/png"
      );
    });
    await downloadBlob(datedExportFilename(filenameBase, "png"), blob);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** CSS-Klassen/Variablen → feste Attribute für Standalone-SVG */
function prepareSvgForExport(
  clone: SVGSVGElement,
  width: number,
  height: number
): void {
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  if (!clone.getAttribute("viewBox")) {
    clone.setAttribute("viewBox", `0 0 ${width} ${height}`);
  }

  // Hintergrund
  const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  bg.setAttribute("x", "0");
  bg.setAttribute("y", "0");
  bg.setAttribute("width", "100%");
  bg.setAttribute("height", "100%");
  bg.setAttribute("fill", "#ffffff");
  clone.insertBefore(bg, clone.firstChild);

  const all = clone.querySelectorAll("*");
  all.forEach((el) => {
    const node = el as SVGElement;
    const tag = node.tagName.toLowerCase();

    // Style-Attribute mit var() bereinigen
    const style = node.getAttribute("style");
    if (style?.includes("var(")) {
      node.setAttribute(
        "style",
        style
          .replace(/var\(--color-chart-\d+[^)]*\)/gi, "#447099")
          .replace(/var\([^)]+\)/g, "#64748b")
      );
    }

    const fill = node.getAttribute("fill");
    if (
      !fill ||
      fill === "currentColor" ||
      fill.startsWith("var(") ||
      fill === "none"
    ) {
      if (tag === "text" || tag === "tspan") {
        node.setAttribute("fill", "#0f172a");
      } else if (
        fill?.startsWith("var(--color-chart") ||
        node.classList.contains("recharts-bar-rectangle")
      ) {
        // keep none for some paths; chart colors often inline already
      }
    }
    if (fill?.startsWith("var(")) {
      if (tag === "text" || tag === "tspan") {
        node.setAttribute("fill", "#0f172a");
      } else {
        node.setAttribute("fill", "#447099");
      }
    }

    // Tailwind-Klassen ersetzen
    if (node.classList?.contains("fill-foreground") || node.getAttribute("class")?.includes("fill-foreground")) {
      node.setAttribute("fill", "#0f172a");
    }
    if (tag === "text" || tag === "tspan") {
      if (!node.getAttribute("fill") || node.getAttribute("fill") === "none") {
        node.setAttribute("fill", "#0f172a");
      }
      // Schriftgröße sichern
      if (!node.getAttribute("font-size")) {
        node.setAttribute("font-size", "11");
      }
      node.setAttribute("font-family", "system-ui, -apple-system, sans-serif");
    }

    const stroke = node.getAttribute("stroke");
    if (stroke?.startsWith("var(") || stroke === "currentColor") {
      node.setAttribute("stroke", "#94a3b8");
    }
  });
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("SVG konnte nicht geladen werden."));
    img.src = url;
  });
}
