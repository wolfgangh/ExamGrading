"use client";

import { useMemo, useState } from "react";
import { useExamContext } from "@/components/exam/exam-context";
import {
  findMergeCandidates,
  orphanCount,
} from "@/lib/matching/merge-candidates";
import { applyIdentityMerge } from "@/lib/matching/apply-identity-merge";
import { flattenHisRows } from "@/lib/his-sources";
import { normalizeMatriculation } from "@/lib/matching/matriculation";
import { formatGrade, formatPoints } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { GitMerge, ShieldAlert } from "lucide-react";

export default function MatchingPage() {
  const { project, setProject, rows } = useExamContext();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sourceMat, setSourceMat] = useState("");
  const [targetMat, setTargetMat] = useState("");
  const [reason, setReason] = useState("");
  const [confirmedNote, setConfirmedNote] = useState(
    "Daten und HIS-Dokument gesichtet"
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

  if (!project) return null;

  const isThe = project.examType === "the";

  const openCandidate = (source: string, target: string) => {
    setSourceMat(source);
    setTargetMat(target);
    setReason("");
    setConfirmedNote("Daten und HIS-Dokument gesichtet");
    setReviewed(false);
    setError(null);
    setDialogOpen(true);
  };

  const doMerge = () => {
    if (!reviewed) {
      setError(
        "Bitte bestätigen Sie, dass Sie die Daten und das HIS-Dokument gesichtet haben."
      );
      return;
    }
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
    setDialogOpen(false);
    setMessage(
      `Zusammengeführt: ${result.merge.sourceMatriculation} → ${result.merge.targetMatriculation}`
    );
    setError(null);
  };

  const orphanRow = rows.find((r) => r.key === sourceMat);
  const hisRow = rows.find((r) => r.key === targetMat && r.inHis);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">
          Matrikel-Zuordnung
        </h1>
        <p className="text-muted-foreground">
          THE: manuelle Zusammenführung bei Tippfehlern in der selbst
          eingetragenen Matrikelnummer (Antritt). Nie automatisch – nur nach
          Sichtung von Antrittsdaten und HIS-Dokument.
        </p>
      </div>

      {!isThe && (
        <div
          role="status"
          className="flex gap-3 rounded-xl border border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-600 dark:bg-amber-950/50 dark:text-amber-50"
        >
          <ShieldAlert className="mt-0.5 size-5 shrink-0" />
          <p>
            Diese Funktion ist für Take-Home-Exams gedacht. Bei Klausuren tritt
            das beschriebene Matrikel-Tippfehler-Problem in der Regel nicht
            auf.
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

      <Card className="surface-panel">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Vorschläge</CardTitle>
          <CardDescription>
            Orphans (Antritt/Punkte ohne HIS) vs. HIS-No-Shows mit ähnlichem
            Namen oder 1-Ziffer-Differenz in der Matrikelnummer.{" "}
            {orphanCount(project) === 0
              ? "Keine Orphans vorhanden."
              : `${orphans.length} Orphan(s), ${candidates.length} Vorschlag/Vorschläge.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Keine automatischen Vorschläge. Unten manuell zuordnen, falls
              nötig.
            </p>
          ) : (
            <div className="overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Score</TableHead>
                    <TableHead>Orphan (Antritt)</TableHead>
                    <TableHead>HIS-Ziel</TableHead>
                    <TableHead>Gründe</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {candidates.map((c) => (
                    <TableRow key={`${c.orphanKey}-${c.hisKey}`}>
                      <TableCell className="tabular-nums font-medium">
                        {c.score}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="font-medium">
                          {c.orphan.student.lastName},{" "}
                          {c.orphan.student.firstName}
                        </div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {c.orphanKey}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {c.orphan.hasPoints
                            ? `${formatPoints(c.orphan.totalPoints)} Pkt. · Note ${formatGrade(c.orphan.finalGrade)}`
                            : "ohne Punkte"}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="font-medium">
                          {c.his.student.lastName}, {c.his.student.firstName}
                        </div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {c.hisKey}
                        </div>
                        <Badge variant="secondary" className="mt-0.5 text-xs">
                          {c.his.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[14rem] text-xs text-muted-foreground">
                        {c.reasons.join(" · ")}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!isThe}
                          onClick={() =>
                            openCandidate(c.orphanKey, c.hisKey)
                          }
                        >
                          <GitMerge className="size-3.5" />
                          Prüfen
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="surface-panel">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Manuelle Zuordnung</CardTitle>
          <CardDescription>
            Orphan und HIS-Matrikel selbst wählen (wenn kein Vorschlag passt).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1">
            <Label className="text-xs">Orphan (falsche Matr.)</Label>
            <Select
              value={manualOrphan}
              onValueChange={(v) => v && setManualOrphan(v)}
            >
              <SelectTrigger className="w-56">
                <SelectValue placeholder="wählen…">
                  {manualOrphan
                    ? orphans.find((o) => o.key === manualOrphan)
                      ? `${orphans.find((o) => o.key === manualOrphan)!.student.lastName} (${manualOrphan})`
                      : manualOrphan
                    : "wählen…"}
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
            <Label className="text-xs">HIS-Ziel (korrekte Matr.)</Label>
            <Select
              value={manualHis}
              onValueChange={(v) => v && setManualHis(v)}
            >
              <SelectTrigger className="w-56">
                <SelectValue placeholder="wählen…">
                  {manualHis
                    ? hisOptions.find((h) => h.mat === manualHis)
                      ? `${hisOptions.find((h) => h.mat === manualHis)!.lastName} (${manualHis})`
                      : manualHis
                    : "wählen…"}
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
            disabled={!isThe || !manualOrphan || !manualHis}
            onClick={() => openCandidate(manualOrphan, manualHis)}
          >
            <GitMerge className="size-3.5" />
            Prüfen &amp; zusammenführen
          </Button>
        </CardContent>
      </Card>

      <Card className="surface-panel">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Dokumentation (Audit)</CardTitle>
          <CardDescription>
            Alle durchgeführten Zusammenführungen – enthalten in der
            JSON-Projektsicherung.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {merges.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Noch keine Zusammenführungen.
            </p>
          ) : (
            <div className="overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead>Von → Nach</TableHead>
                    <TableHead>Begründung</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...merges].reverse().map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {new Date(m.at).toLocaleString("de-DE")}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {m.sourceMatriculation} → {m.targetMatriculation}
                        <div className="font-sans text-muted-foreground">
                          {m.sourceSnapshot.lastName},{" "}
                          {m.sourceSnapshot.firstName}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs text-sm">
                        {m.reason}
                        <div className="text-xs text-muted-foreground">
                          {m.confirmedByNote}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={m.active ? "default" : "secondary"}
                        >
                          {m.active ? "aktiv" : "inaktiv"}
                        </Badge>
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
            <DialogTitle>Zusammenführung bestätigen</DialogTitle>
            <DialogDescription>
              Nur nach klarer Prüfung der Eingabe- und HIS-Daten. Die
              HIS-Matrikel bleibt die Identität für Notenmeldung und Export.
            </DialogDescription>
          </DialogHeader>

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
              {orphanRow?.student.email && (
                <p className="truncate text-xs text-muted-foreground">
                  {orphanRow.student.email}
                </p>
              )}
              <p className="mt-1 text-xs">
                Punkte: {formatPoints(orphanRow?.totalPoints)} · Note:{" "}
                {formatGrade(orphanRow?.finalGrade)}
              </p>
            </div>
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                HIS (Ziel)
              </p>
              <p className="font-medium">
                {hisRow
                  ? `${hisRow.student.lastName}, ${hisRow.student.firstName}`
                  : "–"}
              </p>
              <p className="font-mono text-xs">{targetMat}</p>
              <p className="mt-1 text-xs">
                Status: {hisRow?.status ?? "–"} · Note:{" "}
                {formatGrade(hisRow?.finalGrade)}
              </p>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="merge-reason">Begründung (Pflicht)</Label>
            <Textarea
              id="merge-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="z. B. Tippfehler in Antrittsliste, Name und Anmeldename stimmen mit HIS überein…"
            />
          </div>
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
              Ich habe Antrittsdaten, Punkte und HIS-Dokument verglichen und
              bestätige die Zusammenführung.
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
            <Button type="button" onClick={doMerge} disabled={!isThe}>
              <GitMerge className="size-4" />
              Zusammenführen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
