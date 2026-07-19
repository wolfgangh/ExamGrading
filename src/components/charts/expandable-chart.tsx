"use client";

import { useRef, useState, type ReactNode } from "react";
import { Download, Expand, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { exportSvgContainerAsPng } from "@/lib/charts/export-chart-png";
import { cn } from "@/lib/utils";

export function ExpandableChart({
  title,
  filenameBase,
  description,
  children,
  className,
  chartClassName,
}: {
  title: string;
  /** Basis für datedExportFilename(..., "png") */
  filenameBase: string;
  description?: string;
  children: ReactNode;
  className?: string;
  /** Höhe des Charts im Dialog */
  chartClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const dialogChartRef = useRef<HTMLDivElement>(null);

  const savePng = async (from: "preview" | "dialog") => {
    setErr(null);
    setBusy(true);
    try {
      const el =
        from === "dialog" ? dialogChartRef.current : previewRef.current;
      await exportSvgContainerAsPng(el, filenameBase, {
        title,
        description,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Export fehlgeschlagen");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={cn("space-y-1", className)}>
      <div
        ref={previewRef}
        role="button"
        tabIndex={0}
        className="group relative cursor-zoom-in rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
        title="Klicken zum Vergrößern"
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        {children}
        <span className="pointer-events-none absolute top-2 right-2 inline-flex items-center gap-1 rounded-md border bg-background/90 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
          <Expand className="size-3" />
          Vergrößern
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 gap-1 text-xs"
          disabled={busy}
          onClick={(e) => {
            e.stopPropagation();
            void savePng("preview");
          }}
        >
          <Download className="size-3.5" />
          PNG
        </Button>
        <span className="text-[11px] text-muted-foreground">
          Klick zum Vergrößern · PNG inkl. Titel
        </span>
        {err && !open && (
          <span className="text-[11px] text-destructive">{err}</span>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="flex max-h-[min(92vh,900px)] w-[min(96vw,1100px)] max-w-none flex-col gap-3 sm:max-w-none"
          showCloseButton
        >
          <DialogHeader className="sr-only">
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>

          {/* Sichtbare Beschriftungen – werden im PNG mitgeschrieben */}
          <div className="shrink-0 space-y-0.5 border-b pb-2 pr-8">
            <p className="text-base font-semibold tracking-tight text-foreground">
              {title}
            </p>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
            <p className="text-[11px] text-muted-foreground">
              Achsen und Balkenbeschriftungen gehören zur Grafik · Export
              enthält Titel und Untertitel.
            </p>
          </div>

          <div
            ref={dialogChartRef}
            className={cn(
              "min-h-0 flex-1 overflow-auto rounded-lg border bg-background p-2",
              chartClassName ?? "h-[min(58vh,500px)]"
            )}
          >
            <div className="h-full min-h-[280px] w-full">{children}</div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t pt-2">
            {err && (
              <span className="mr-auto text-xs text-destructive">{err}</span>
            )}
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              className="gap-1.5"
              onClick={() => void savePng("dialog")}
            >
              <Download className="size-4" />
              Als PNG speichern
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              <X className="size-4" />
              Schließen
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
