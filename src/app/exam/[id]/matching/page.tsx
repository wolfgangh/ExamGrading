"use client";

import { useMemo, useState } from "react";
import { useExamContext } from "@/components/exam/exam-context";
import {
  findMergeCandidates,
  orphanCount,
} from "@/lib/matching/merge-candidates";
import { applyIdentityMerge } from "@/lib/matching/apply-identity-merge";
import { applyIdentityDismissal } from "@/lib/matching/apply-identity-dismissal";
import { revertIdentityMerge } from "@/lib/matching/revert-identity-merge";
import {
  listUnresolvedOrphans,
  unresolvedOrphanSummary,
} from "@/lib/matching/orphan-resolution";
import {
  DISMISS_REASON_TEMPLATES,
  MERGE_REASON_TEMPLATES,
  UNDO_REASON_TEMPLATES,
} from "@/lib/matching/reason-templates";
import { ReasonField } from "@/components/matching/reason-field";
import { flattenHisRows } from "@/lib/his-sources";
import { normalizeMatriculation } from "@/lib/matching/matriculation";
import { HISINONE_LABEL, isOnlineStyleExam } from "@/lib/types";
import { formatGrade, formatPoints } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Ban, GitMerge, ShieldAlert, Undo2 } from "lucide-react";

type DialogMode = "merge" | "dismiss" | "undo";

export default function MatchingPage() {
  const { project, setProject, rows } = useExamContext();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>("merge");
  const [sourceMat, setSourceMat] = useState("");
  const [targetMat, setTargetMat] = useState("");
  const [mergeId, setMergeId] = useState("");
  const [reason, setReason] = useState("");
  const [confirmedNote, setConfirmedNote] = useState(
    `Daten und ${HISINONE_LABEL}-Dokument gesichtet`
  );
  const [reviewed, setReviewed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [manualOrphan, setManualOrphan] = useState<string>("");
  const [manualHis, setManualHis] = useState<string>("");

  const candidates = useMemo(
    () => (project ? findMergeCandidates(project, rows) : []),
    [project, rows]
  );

  const orphans = useMemo(
    () =>
      rows.filter(
        (r) =>
          (!r.inHis || r.attendanceWithoutHis) &&
          (r.attended === true || r.hasPoints)
      ),
    [rows]
  );

  const unresolved = useMemo(
    () => (project ? listUnresolvedOrphans(project, rows) : []),
    [project, rows]
  );

  const hisOptions = useMemo(() => {
    if (!project) return [];
    return flattenHisRows(project)
      .map((h) => ({
        mat: normalizeMatriculation(h.matriculationNumber) ?? "",
        lastName: h.lastName,
        firstName: h.firstName,
      }))
      .filter((h) => h.mat)
      .sort((a, b) => a.lastName.localeCompare(b.lastName, "de"));
  }, [project]);

  const merges = project?.identityMerges ?? [];
  const dismissals = project?.identityDismissals ?? [];
  const activeMerges = merges.filter((m) => m.active);

  if (!project) return null;

  const onlineStyle = isOnlineStyleExam(project.examType);

  const resetDialogMeta = () => {
    setReason("");
    setConfirmedNote(`Daten und ${HISINONE_LABEL}-Dokument gesichtet`);
    setReviewed(false);
    setError(null);
  };

  const openMerge = (source: string, target: string) => {
    setDialogMode("merge");
    setSourceMat(source);
    setTargetMat(target);
    setMergeId("");
    resetDialogMeta();
    setDialogOpen(true);
  };

  const openDismiss = (source: string) => {
    setDialogMode("dismiss");
    setSourceMat(source);
    setTargetMat("");
    setMergeId("");
    resetDialogMeta();
    setDialogOpen(true);
  };

  const openUndo = (id: string, source: string, target: string) => {
    setDialogMode("undo");
    setMergeId(id);
    setSourceMat(source);
    setTargetMat(target);
    resetDialogMeta();
    setDialogOpen(true);
  };

  const doConfirm = () => {
    if (!reviewed) {
      setError(
        "Bitte bestätigen Sie, dass Sie die Daten und das HISinOne-Dokument gesichtet haben."
      );
      return;
    }
    if (dialogMode === "merge") {
      const result = applyIdentityMerge(project, {
        sourceMatriculation: sourceMat,
        targetMatriculation: targetMat,
        reason,
        confirmedByNote: confirmedNote,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setProject(() => result.project);
      setMessage(
        `Zusammengeführt: ${result.merge.sourceMatriculation} → ${result.merge.targetMatriculation}`
      );
    } else if (dialogMode === "dismiss") {
      const result = applyIdentityDismissal(project, {
        sourceMatriculation: sourceMat,
        reason,
        confirmedByNote: confirmedNote,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setProject(() => result.project);
      setMessage(
        `Abgelehnt (kein Merge): ${result.dismissal.sourceMatriculation}`
      );
    } else {
      const result = revertIdentityMerge(project, mergeId, {
        reason,
        confirmedByNote: confirmedNote,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setProject(() => result.project);
      setMessage(
        `Zusammenführung aufgehoben: ${result.merge.sourceMatriculation} ↩︎ (war → ${result.merge.targetMatriculation})`
      );
    }
    setDialogOpen(false);
    setError(null);
  };

  const orphanRow = rows.find((r) => r.key === sourceMat);
  const hisRow = rows.find((r) => r.key === targetMat && r.inHis);

  const reasonTemplates =
    dialogMode === "merge"
      ? MERGE_REASON_TEMPLATES
      : dialogMode === "dismiss"
        ? DISMISS_REASON_TEMPLATES
        : UNDO_REASON_TEMPLATES;

  const auditRows = [
    ...merges.map((m) => ({
      id: m.id,
      at: m.at,
      kind: "merge" as const,
      detail: `${m.sourceMatriculation} → ${m.targetMatriculation}`,
      name: `${m.sourceSnapshot.lastName}, ${m.sourceSnapshot.firstName}`,
      reason: m.reason,
      note: m.confirmedByNote,
      active: m.active,
      undoReason: m.undoReason,
      source: m.sourceMatriculation,
      target: m.targetMatriculation,
      canUndo: m.active,
    })),
    ...dismissals.map((d) => ({
      id: d.id,
      at: d.at,
      kind: "dismiss" as const,
      detail: d.sourceMatriculation,
      name: `${d.sourceSnapshot.lastName}, ${d.sourceSnapshot.firstName}`,
      reason: d.reason,
      note: d.confirmedByNote,
      active: d.active,
      undoReason: undefined as string | undefined,
      source: d.sourceMatriculation,
      target: "",
      canUndo: false,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">
          Matrikel-Zuordnung
        </h1>
        <p className="text-muted-foreground">
          THE / elektronische Prüfung: manuelle Zusammenführung bei Tippfehlern
          in der selbst eingetragenen Matrikelnummer. Nie automatisch – nur nach
          Sichtung. Offene Fälle blockieren Notenliste und {HISINONE_LABEL}
          -Export. Merges können dokumentiert aufgehoben werden.
        </p>
      </div>

      {!onlineStyle && (
        <div
          role="status"
          className="flex gap-3 rounded-xl border border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-600 dark:bg-amber-950/50 dark:text-amber-50"
        >
          <ShieldAlert className="mt-0.5 size-5 shrink-0" />
          <p>
            Diese Funktion ist für Take-Home-Exams und elektronische Prüfungen
            gedacht.
          </p>
        </div>
      )}

      {onlineStyle && unresolved.length > 0 && (
        <div
          role="alert"
          className="rounded-xl border border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-600 dark:bg-amber-950/50 dark:text-amber-50"
        >
          <p className="font-semibold">
            {unresolvedOrphanSummary(project, rows)}
          </p>
          <p className="mt-1 opacity-95">
            Notenliste-PDF und {HISINONE_LABEL}-Excel sind gesperrt, bis alle
            Fälle zusammengeführt oder abgelehnt sind.
          </p>
        </div>
      )}

      {(message || error) && !dialogOpen && (
        <p
          className={
            error
              ? "text-sm text-destructive"
              : "text-sm text-emerald-700 dark:text-emerald-300"
          }
        >
          {error ?? message}
        </p>
      )}

      {/* Vorschläge – Karten, Buttons nie überlagert */}
      <Card className="surface-panel">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Vorschläge</CardTitle>
          <CardDescription>
            Orphans (Antritt/Punkte ohne {HISINONE_LABEL}) vs. No-Shows.{" "}
            {orphanCount(project) === 0
              ? "Keine Orphans vorhanden."
              : `${orphans.length} Orphan(s), ${unresolved.length} ungeprüft, ${candidates.length} Vorschlag/Vorschläge.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Keine automatischen Vorschläge. Unten manuell zuordnen oder
              ablehnen.
            </p>
          ) : (
            candidates.map((c) => (
              <div
                key={`${c.orphanKey}-${c.hisKey}`}
                className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:items-stretch sm:justify-between"
              >
                <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-[auto_1fr_1fr]">
                  <div className="flex items-center sm:flex-col sm:items-start sm:justify-center">
                    <Badge variant="secondary" className="tabular-nums">
                      Score {c.score}
                    </Badge>
                  </div>
                  <div className="min-w-0 rounded-lg border bg-muted/20 px-3 py-2 text-sm">
                    <p className="text-xs font-medium text-muted-foreground">
                      Orphan (Antritt)
                    </p>
                    <p className="font-medium">
                      {c.orphan.student.lastName}, {c.orphan.student.firstName}
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {c.orphanKey}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {c.orphan.hasPoints
                        ? `${formatPoints(c.orphan.totalPoints)} Pkt. · Note ${formatGrade(c.orphan.finalGrade)}`
                        : "ohne Punkte"}
                    </p>
                  </div>
                  <div className="min-w-0 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
                    <p className="text-xs font-medium text-muted-foreground">
                      {HISINONE_LABEL}-Ziel
                    </p>
                    <p className="font-medium">
                      {c.his.student.lastName}, {c.his.student.firstName}
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {c.hisKey}
                    </p>
                    <Badge variant="outline" className="mt-0.5 text-xs">
                      {c.his.status}
                    </Badge>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col justify-center gap-2 border-t pt-3 sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0">
                  <p className="text-xs text-muted-foreground sm:max-w-[12rem]">
                    {c.reasons.join(" · ")}
                  </p>
                  <div className="flex flex-wrap gap-2 sm:flex-col">
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full sm:w-auto"
                      disabled={!onlineStyle}
                      onClick={() => openMerge(c.orphanKey, c.hisKey)}
                    >
                      <GitMerge className="size-3.5" />
                      Zusammenführen
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="w-full sm:w-auto"
                      disabled={!onlineStyle}
                      onClick={() => openDismiss(c.orphanKey)}
                    >
                      <Ban className="size-3.5" />
                      Ablehnen
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="surface-panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Manuell zusammenführen</CardTitle>
            <CardDescription>
              Orphan und korrekte {HISINONE_LABEL}-Matrikel selbst wählen.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="grid gap-1">
              <Label className="text-xs">Orphan (falsche Matr.)</Label>
              <Select
                value={manualOrphan}
                onValueChange={(v) => v && setManualOrphan(v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="wählen…">
                    {manualOrphan || "wählen…"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {orphans.map((o) => (
                    <SelectItem key={o.key} value={o.key}>
                      {o.student.lastName}, {o.student.firstName} · {o.key}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <Label className="text-xs">
                {HISINONE_LABEL}-Ziel (korrekte Matr.)
              </Label>
              <Select
                value={manualHis}
                onValueChange={(v) => v && setManualHis(v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="wählen…">
                    {manualHis || "wählen…"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {hisOptions.map((h) => (
                    <SelectItem key={h.mat} value={h.mat}>
                      {h.lastName}, {h.firstName} · {h.mat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              variant="secondary"
              disabled={!onlineStyle || !manualOrphan || !manualHis}
              onClick={() => openMerge(manualOrphan, manualHis)}
            >
              <GitMerge className="size-3.5" />
              Prüfen &amp; zusammenführen
            </Button>
          </CardContent>
        </Card>

        <Card className="surface-panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Ungeprüfte Orphans ablehnen
            </CardTitle>
            <CardDescription>
              Wenn kein Tippfehler vorliegt: Fall dokumentiert schließen.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {unresolved.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Keine ungeprüften Orphans.
              </p>
            ) : (
              unresolved.map((o) => (
                <div
                  key={o.key}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <span className="font-medium">
                      {o.student.lastName}, {o.student.firstName}
                    </span>
                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                      {o.key}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    disabled={!onlineStyle}
                    onClick={() => openDismiss(o.key)}
                  >
                    <Ban className="size-3.5" />
                    Ablehnen
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {activeMerges.length > 0 && (
        <Card className="surface-panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Aktive Zusammenführungen aufheben
            </CardTitle>
            <CardDescription>
              Bei fälschlichem Merge: dokumentiert rückgängig machen (Orphan
              wird wiederhergestellt).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {activeMerges.map((m) => (
              <div
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <span className="font-mono text-xs">
                    {m.sourceMatriculation} → {m.targetMatriculation}
                  </span>
                  <div className="text-muted-foreground">
                    {m.sourceSnapshot.lastName}, {m.sourceSnapshot.firstName}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  disabled={!onlineStyle}
                  onClick={() =>
                    openUndo(
                      m.id,
                      m.sourceMatriculation,
                      m.targetMatriculation
                    )
                  }
                >
                  <Undo2 className="size-3.5" />
                  Aufheben
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="surface-panel">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Dokumentation (Audit)</CardTitle>
          <CardDescription>
            Zusammenführungen, Ablehnungen und Aufhebungen – in der
            JSON-Sicherung und der Notenliste-PDF.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {auditRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Noch keine Einträge.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Datum</TableHead>
                    <TableHead>Art</TableHead>
                    <TableHead>Matrikel</TableHead>
                    <TableHead className="min-w-[10rem]">Begründung</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="min-w-[7rem]">Aktion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditRows.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {new Date(m.at).toLocaleString("de-DE")}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            m.kind === "merge" ? "default" : "secondary"
                          }
                        >
                          {m.kind === "merge" ? "Merge" : "Abgelehnt"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {m.detail}
                        <div className="font-sans text-muted-foreground">
                          {m.name}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs text-sm">
                        {m.reason}
                        {m.undoReason && (
                          <div className="mt-1 text-xs text-amber-800 dark:text-amber-200">
                            Aufgehoben: {m.undoReason}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={m.active ? "outline" : "secondary"}>
                          {m.active
                            ? "aktiv"
                            : m.kind === "merge"
                              ? "aufgehoben"
                              : "inaktiv"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {m.canUndo && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={!onlineStyle}
                            onClick={() =>
                              openUndo(m.id, m.source, m.target)
                            }
                          >
                            <Undo2 className="size-3.5" />
                            Aufheben
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "merge"
                ? "Zusammenführung bestätigen"
                : dialogMode === "dismiss"
                  ? "Ablehnung bestätigen"
                  : "Zusammenführung aufheben"}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === "merge"
                ? `Nur nach klarer Prüfung. Die ${HISINONE_LABEL}-Matrikel bleibt die Identität für Notenmeldung und Export.`
                : dialogMode === "dismiss"
                  ? "Dokumentiert, dass kein Merge erfolgen soll."
                  : "Stellt Antritt/Punkte unter der ursprünglichen Matrikel wieder her. Export kann danach erneut gesperrt sein, bis der Fall geklärt ist."}
            </DialogDescription>
          </DialogHeader>

          {dialogMode === "merge" && (
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  Orphan (Quelle)
                </p>
                <p className="font-medium">
                  {orphanRow
                    ? `${orphanRow.student.lastName}, ${orphanRow.student.firstName}`
                    : "–"}
                </p>
                <p className="font-mono text-xs">{sourceMat}</p>
                <p className="mt-1 text-xs">
                  Punkte: {formatPoints(orphanRow?.totalPoints)} · Note:{" "}
                  {formatGrade(orphanRow?.finalGrade)}
                </p>
              </div>
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  {HISINONE_LABEL} (Ziel)
                </p>
                <p className="font-medium">
                  {hisRow
                    ? `${hisRow.student.lastName}, ${hisRow.student.firstName}`
                    : "–"}
                </p>
                <p className="font-mono text-xs">{targetMat}</p>
                <p className="mt-1 text-xs">
                  Status: {hisRow?.status ?? "–"}
                </p>
              </div>
            </div>
          )}

          {dialogMode === "dismiss" && (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <p className="font-medium">
                {orphanRow
                  ? `${orphanRow.student.lastName}, ${orphanRow.student.firstName}`
                  : "–"}
              </p>
              <p className="font-mono text-xs">{sourceMat}</p>
            </div>
          )}

          {dialogMode === "undo" && (
            <div className="rounded-lg border border-amber-300/50 bg-amber-50/50 p-3 text-sm dark:bg-amber-950/20">
              <p className="font-mono text-xs">
                {sourceMat} → {targetMat}
              </p>
              <p className="mt-1 text-muted-foreground">
                Nach dem Aufheben gilt die Antritts-Matrikel wieder als Orphan
                (bis neu zugeordnet).
              </p>
            </div>
          )}

          <ReasonField
            id="match-reason"
            templates={reasonTemplates}
            value={reason}
            onChange={setReason}
          />

          <div className="grid gap-2">
            <Label htmlFor="merge-confirm">Sichtungsvermerk</Label>
            <Input
              id="merge-confirm"
              value={confirmedNote}
              onChange={(e) => setConfirmedNote(e.target.value)}
            />
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1 size-4"
              checked={reviewed}
              onChange={(e) => setReviewed(e.target.checked)}
            />
            <span>
              Ich habe Antrittsdaten, Punkte und {HISINONE_LABEL}-Dokument
              verglichen und bestätige diese Entscheidung.
            </span>
          </label>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              Abbrechen
            </Button>
            <Button type="button" onClick={doConfirm} disabled={!onlineStyle}>
              {dialogMode === "merge" && (
                <>
                  <GitMerge className="size-4" />
                  Zusammenführen
                </>
              )}
              {dialogMode === "dismiss" && (
                <>
                  <Ban className="size-4" />
                  Ablehnung speichern
                </>
              )}
              {dialogMode === "undo" && (
                <>
                  <Undo2 className="size-4" />
                  Aufheben bestätigen
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
