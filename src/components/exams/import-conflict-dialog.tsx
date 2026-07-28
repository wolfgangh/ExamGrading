"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildProjectImportDiffRows,
  countContentDiffs,
  formatImportDateTime,
} from "@/lib/project-import-conflict";
import type { ExamProject } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type ImportConflictResolution =
  | { action: "copy"; matchId: string }
  | { action: "replace"; matchId: string }
  | { action: "skip" }
  | { action: "abort_remaining" };

type Props = {
  open: boolean;
  fileLabel: string;
  imported: ExamProject;
  matches: ExamProject[];
  byId: boolean;
  /** 1-basiert */
  queueIndex: number;
  queueTotal: number;
  onResolve: (resolution: ImportConflictResolution) => void;
};

export function ImportConflictDialog({
  open,
  fileLabel,
  imported,
  matches,
  byId,
  queueIndex,
  queueTotal,
  onResolve,
}: Props) {
  const [selectedId, setSelectedId] = useState(matches[0]?.id ?? "");
  const [replaceStep, setReplaceStep] = useState(false);
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedId(matches[0]?.id ?? "");
    setReplaceStep(false);
    setReplaceConfirmed(false);
  }, [open, matches, fileLabel, queueIndex]);

  const local = useMemo(
    () => matches.find((m) => m.id === selectedId) ?? matches[0],
    [matches, selectedId]
  );

  const rows = useMemo(() => {
    if (!local) return [];
    return buildProjectImportDiffRows(local, imported);
  }, [local, imported]);

  const contentDiffs = useMemo(() => countContentDiffs(rows), [rows]);
  const titleName = (imported.name || local?.name || "Prüfung").trim();

  if (!local) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onResolve({ action: "skip" });
      }}
    >
      <DialogContent
        className="max-h-[min(90vh,40rem)] overflow-y-auto sm:max-w-lg"
        showCloseButton
      >
        <DialogHeader>
          <DialogTitle>
            Konflikt: {titleName}
            {queueTotal > 1 ? (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                · {queueIndex} von {queueTotal}
              </span>
            ) : null}
          </DialogTitle>
          <DialogDescription>
            Diese Sicherung entspricht einer Prüfung, die bereits in diesem
            Browser gespeichert ist
            {byId ? " (gleiche Projekt-ID)" : " (Name, Semester, Form)"}.
            Wählen Sie, wie fortgefahren werden soll.
          </DialogDescription>
        </DialogHeader>

        <p className="truncate text-xs text-muted-foreground" title={fileLabel}>
          Datei: {fileLabel}
        </p>

        {matches.length > 1 && (
          <div className="grid gap-1.5">
            <Label htmlFor="import-conflict-match" className="text-xs">
              Bestehende Prüfung (mehrere Treffer)
            </Label>
            <Select
              value={selectedId}
              onValueChange={(v) => {
                if (v) {
                  setSelectedId(v);
                  setReplaceStep(false);
                  setReplaceConfirmed(false);
                }
              }}
            >
              <SelectTrigger id="import-conflict-match" className="w-full">
                <SelectValue>
                  {local.name}
                  {" · "}
                  {formatImportDateTime(local.updatedAt)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {matches.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name} · {formatImportDateTime(m.updatedAt)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[20rem] text-left text-xs">
            <thead className="bg-muted/60">
              <tr>
                <th className="px-2 py-1.5 font-medium">Feld</th>
                <th className="px-2 py-1.5 font-medium">Im Browser</th>
                <th className="px-2 py-1.5 font-medium">Aus Sicherung</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.key}
                  className={cn(
                    "border-t",
                    r.differs && "bg-amber-50/80 dark:bg-amber-950/25"
                  )}
                >
                  <td className="px-2 py-1.5 text-muted-foreground">
                    {r.label}
                  </td>
                  <td className="px-2 py-1.5 font-medium tabular-nums">
                    {r.local}
                    {r.newerSide === "local" && (
                      <span className="ml-1 rounded bg-emerald-100 px-1 py-0.5 text-[0.65rem] font-semibold text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100">
                        aktueller
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 font-medium tabular-nums">
                    {r.imported}
                    {r.newerSide === "imported" && (
                      <span className="ml-1 rounded bg-emerald-100 px-1 py-0.5 text-[0.65rem] font-semibold text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100">
                        aktueller
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {contentDiffs === 0 && (
          <p className="text-xs text-muted-foreground">
            Keine Zähler-Unterschiede in der Übersicht – der Inhalt kann
            trotzdem abweichen (z. B. einzelne Punkte oder Noten).
          </p>
        )}

        {!replaceStep ? (
          <div className="flex flex-col gap-2 border-t pt-3">
            <Button
              type="button"
              className="w-full"
              autoFocus
              onClick={() => onResolve({ action: "copy", matchId: local.id })}
            >
              Als neue Version importieren
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full border-destructive/40 text-destructive hover:bg-destructive/10"
              onClick={() => {
                setReplaceStep(true);
                setReplaceConfirmed(false);
              }}
            >
              Bestehende ersetzen …
            </Button>
            <div className="flex w-full flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => onResolve({ action: "skip" })}
              >
                Diesen Import überspringen
              </Button>
              {queueTotal > 1 && queueIndex < queueTotal && (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-muted-foreground"
                  onClick={() => onResolve({ action: "abort_remaining" })}
                >
                  Alle verbleibenden abbrechen
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
            <p className="text-sm font-medium text-destructive">
              Die im Browser gespeicherte Version wird unwiderruflich
              überschrieben. Lokale Änderungen an dieser Prüfung gehen verloren.
            </p>
            <p className="text-xs text-muted-foreground">
              Betroffen: „{local.name}“ (geändert{" "}
              {formatImportDateTime(local.updatedAt)}).
            </p>
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <Checkbox
                checked={replaceConfirmed}
                onCheckedChange={(v) => setReplaceConfirmed(v === true)}
                className="mt-0.5"
              />
              <span>
                Ich verstehe, dass die bestehende Version ersetzt wird.
              </span>
            </label>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setReplaceStep(false);
                  setReplaceConfirmed(false);
                }}
              >
                Zurück
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={!replaceConfirmed}
                onClick={() =>
                  onResolve({ action: "replace", matchId: local.id })
                }
              >
                Endgültig ersetzen
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
