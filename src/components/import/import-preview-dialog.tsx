"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function ImportPreviewDialog({
  open,
  onOpenChange,
  title,
  description,
  preview,
  warnings,
  errors,
  rowCount,
  onConfirm,
  confirming,
  extra,
  confirmLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  preview: Record<string, string>[];
  warnings: string[];
  errors: string[];
  rowCount: number;
  onConfirm: () => void;
  confirming?: boolean;
  /** z. B. Merge-Optionen beim Punkte-Reimport */
  extra?: React.ReactNode;
  confirmLabel?: string;
}) {
  const cols =
    preview.length > 0 ? Object.keys(preview[0]) : ["Keine Vorschau"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description ?? `${rowCount} Zeilen erkannt. Bitte prüfen und bestätigen.`}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-64 overflow-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                {cols.map((c) => (
                  <TableHead key={c}>{c}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={cols.length} className="text-center text-muted-foreground">
                    Keine Datensätze
                  </TableCell>
                </TableRow>
              ) : (
                preview.map((row, i) => (
                  <TableRow key={i}>
                    {cols.map((c) => (
                      <TableCell key={c} className="text-sm">
                        {row[c]}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {errors.length > 0 && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive">
            <p className="font-medium">Fehler</p>
            <ul className="mt-1 list-inside list-disc">
              {errors.slice(0, 8).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        {warnings.length > 0 && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
            <p className="font-medium">
              Warnungen ({warnings.length})
            </p>
            <ul className="mt-1 list-inside list-disc">
              {warnings.slice(0, 8).map((w, i) => (
                <li key={i}>{w}</li>
              ))}
              {warnings.length > 8 && (
                <li>… und {warnings.length - 8} weitere</li>
              )}
            </ul>
          </div>
        )}

        {extra}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button
            onClick={onConfirm}
            disabled={confirming || rowCount === 0 || errors.length > 0}
          >
            {confirming
              ? "Importiere…"
              : confirmLabel ?? `${rowCount} Zeilen importieren`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
