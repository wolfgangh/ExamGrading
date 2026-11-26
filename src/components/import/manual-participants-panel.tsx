"use client";

import { useMemo, useRef, useState } from "react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddStudentForm } from "@/components/exam/add-student-form";
import type { ExamProject } from "@/lib/types";
import { HISINONE_LABEL } from "@/lib/types";
import {
  addManualParticipants,
  listManualParticipants,
  parseParticipantMatrix,
  participantHasAssessment,
  previewManualParticipants,
  removeManualParticipant,
  textToMatrix,
  updateManualParticipant,
  type ManualParticipantIssue,
  type ParsedParticipants,
} from "@/lib/manual-participants";
import { loadWorkbookFromFile, worksheetToMatrix } from "@/lib/excel/workbook";
import { normalizeMatriculation } from "@/lib/matching/matriculation";
import { clearStructuralBackupMilestones } from "@/lib/workflow-milestones";
import { Check, Pencil, Trash2, Upload, X } from "lucide-react";

type Updater = (updater: (prev: ExamProject) => ExamProject) => void;

const FIELD_LABELS: Record<string, string> = {
  matriculation: "Matrikel",
  lastName: "Nachname",
  firstName: "Vorname",
  fullName: "Name",
  program: "Studiengang",
  email: "E-Mail",
  attempt: "Versuch",
};

/** Einfügen/Datei: Vorschau mit gültigen Zeilen und Problemen, dann übernehmen. */
function BulkImport({
  project,
  setProject,
}: {
  project: ExamProject;
  setProject: Updater;
}) {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ParsedParticipants | null>(null);
  const [source, setSource] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const preview = useMemo(
    () => (parsed ? previewManualParticipants(project, parsed) : null),
    [project, parsed]
  );

  const analyzeText = () => {
    setDone(null);
    setError(null);
    const p = parseParticipantMatrix(textToMatrix(text));
    if (p.rows.length === 0) {
      setError("Keine Zeilen erkannt.");
      setParsed(null);
      return;
    }
    setSource("Eingefügter Text");
    setParsed(p);
  };

  const onFile = async (file: File) => {
    setDone(null);
    setError(null);
    try {
      let matrix: unknown[][];
      if (/\.(csv|txt)$/i.test(file.name)) {
        matrix = textToMatrix(await file.text());
      } else {
        const wb = await loadWorkbookFromFile(file);
        matrix = worksheetToMatrix(wb.worksheets[0]);
      }
      const p = parseParticipantMatrix(matrix);
      if (p.rows.length === 0) {
        setError("Keine Zeilen in der Datei erkannt.");
        setParsed(null);
        return;
      }
      setSource(file.name);
      setParsed(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Datei konnte nicht gelesen werden.");
    }
  };

  const apply = () => {
    if (!parsed) return;
    let added = 0;
    setProject((prev) => {
      const r = addManualParticipants(prev, parsed.rows);
      added = r.added;
      return clearStructuralBackupMilestones(r.project);
    });
    setDone(`${preview?.valid ?? added} Person(en) übernommen.`);
    setParsed(null);
    setText("");
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-1.5">
        <Label htmlFor="manual-paste">Liste einfügen</Label>
        <Textarea
          id="manual-paste"
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            "Aus Excel kopieren (mit oder ohne Kopfzeile), z. B.\nMatrikelnummer\tNachname\tVorname\tStudiengang\n1234567\tMuster\tErika\tMBW"
          }
          className="font-mono text-xs"
        />
        <p className="text-xs text-muted-foreground">
          Ohne Kopfzeile gilt die Reihenfolge: Matrikelnummer, Nachname,
          Vorname, Studiengang, E-Mail, Versuch. Trennzeichen Tab, Semikolon
          oder Komma.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!text.trim()}
          onClick={analyzeText}
        >
          Prüfen
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="size-4" />
          Excel/CSV-Datei
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.csv,.txt"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
            e.target.value = "";
          }}
        />
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {done && (
        <p className="text-sm text-emerald-700 dark:text-emerald-300">{done}</p>
      )}
      {parsed && preview && (
        <div className="space-y-2 rounded-lg border p-3">
          <p className="text-sm">
            <span className="font-medium">{source}</span> ·{" "}
            {parsed.rows.length} Zeile(n) ·{" "}
            {parsed.hasHeader ? "Kopfzeile erkannt" : "ohne Kopfzeile"}
          </p>
          <div className="flex flex-wrap gap-1">
            {parsed.columns.map((c) => (
              <Badge key={c} variant="outline">
                {FIELD_LABELS[c] ?? c}
              </Badge>
            ))}
          </div>
          <p className="text-sm">
            <span className="font-semibold text-emerald-700 dark:text-emerald-300">
              {preview.valid} gültig
            </span>
            {preview.issues.length > 0 && (
              <span className="ml-2 font-semibold text-destructive">
                {preview.issues.length} werden übersprungen
              </span>
            )}
          </p>
          {preview.issues.length > 0 && (
            <IssueList issues={preview.issues} />
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={preview.valid === 0}
              onClick={apply}
            >
              {preview.valid} übernehmen
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setParsed(null)}
            >
              Verwerfen
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function IssueList({ issues }: { issues: ManualParticipantIssue[] }) {
  return (
    <ul className="max-h-32 space-y-0.5 overflow-auto text-xs text-muted-foreground">
      {issues.map((i, idx) => (
        <li key={idx}>
          {i.line != null && <span className="tabular-nums">Zeile {i.line}: </span>}
          {[i.input.matriculationNumber, i.input.lastName, i.input.firstName]
            .filter(Boolean)
            .join(" · ") || "–"}{" "}
          – <span className="text-destructive">{i.reason}</span>
        </li>
      ))}
    </ul>
  );
}

type EditDraft = {
  matriculationNumber: string;
  lastName: string;
  firstName: string;
  programCode: string;
  attempt: string;
};

/** Tabelle der manuellen Teilnehmenden mit Bearbeiten/Löschen. */
function ParticipantTable({
  project,
  setProject,
}: {
  project: ExamProject;
  setProject: Updater;
}) {
  const rows = listManualParticipants(project);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Noch keine manuell erfassten Teilnehmenden.
      </p>
    );
  }

  const startEdit = (key: string) => {
    const r = rows.find((x) => normalizeMatriculation(x.matriculationNumber) === key);
    if (!r) return;
    setError(null);
    setConfirmKey(null);
    setEditKey(key);
    setDraft({
      matriculationNumber: r.matriculationNumber,
      lastName: r.lastName,
      firstName: r.firstName,
      programCode: r.programCode ?? "",
      attempt:
        project.students[key]?.attempt != null
          ? String(project.students[key]?.attempt)
          : "",
    });
  };

  const saveEdit = () => {
    if (!editKey || !draft) return;
    const patch = {
      matriculationNumber: draft.matriculationNumber,
      lastName: draft.lastName,
      firstName: draft.firstName,
      programCode: draft.programCode,
      attempt: draft.attempt.trim() ? Number(draft.attempt) : null,
    };
    const check = updateManualParticipant(project, editKey, patch);
    if (check.error) {
      setError(check.error);
      return;
    }
    const key = editKey;
    setProject((prev) => updateManualParticipant(prev, key, patch).project);
    setEditKey(null);
    setDraft(null);
    setError(null);
  };

  const remove = (key: string) => {
    setProject((prev) =>
      clearStructuralBackupMilestones(removeManualParticipant(prev, key))
    );
    setConfirmKey(null);
  };

  return (
    <div className="space-y-2">
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <div className="max-h-96 overflow-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Matrikel</TableHead>
              <TableHead>Nachname</TableHead>
              <TableHead>Vorname</TableHead>
              <TableHead>Studiengang</TableHead>
              <TableHead>Versuch</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const key = normalizeMatriculation(r.matriculationNumber) ?? r.matriculationNumber;
              const editing = editKey === key && draft;
              const attempt = project.students[key]?.attempt;
              if (editing) {
                const set = (k: keyof EditDraft) => (e: React.ChangeEvent<HTMLInputElement>) =>
                  setDraft({ ...draft, [k]: e.target.value });
                return (
                  <TableRow key={key}>
                    <TableCell><Input className="h-7 w-28" value={draft.matriculationNumber} onChange={set("matriculationNumber")} aria-label="Matrikelnummer" /></TableCell>
                    <TableCell><Input className="h-7" value={draft.lastName} onChange={set("lastName")} aria-label="Nachname" /></TableCell>
                    <TableCell><Input className="h-7" value={draft.firstName} onChange={set("firstName")} aria-label="Vorname" /></TableCell>
                    <TableCell><Input className="h-7 w-20" value={draft.programCode} onChange={set("programCode")} aria-label="Studiengang" /></TableCell>
                    <TableCell><Input className="h-7 w-14" value={draft.attempt} onChange={set("attempt")} aria-label="Versuch" /></TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      <Button type="button" size="icon-sm" variant="ghost" onClick={saveEdit} aria-label="Speichern">
                        <Check className="size-4" />
                      </Button>
                      <Button type="button" size="icon-sm" variant="ghost" onClick={() => { setEditKey(null); setDraft(null); setError(null); }} aria-label="Abbrechen">
                        <X className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              }
              return (
                <TableRow key={key}>
                  <TableCell className="font-mono text-xs">{key}</TableCell>
                  <TableCell className="text-sm">{r.lastName}</TableCell>
                  <TableCell className="text-sm">{r.firstName}</TableCell>
                  <TableCell>
                    {r.programCode ? <Badge variant="outline">{r.programCode}</Badge> : <span className="text-muted-foreground">–</span>}
                  </TableCell>
                  <TableCell className="tabular-nums text-sm">{attempt ?? "–"}</TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    {confirmKey === key ? (
                      <span className="inline-flex items-center gap-1 text-xs">
                        <span className="text-destructive">Bewertungen löschen?</span>
                        <Button type="button" size="xs" variant="destructive" onClick={() => remove(key)}>Ja</Button>
                        <Button type="button" size="xs" variant="ghost" onClick={() => setConfirmKey(null)}>Nein</Button>
                      </span>
                    ) : (
                      <>
                        <Button type="button" size="icon-sm" variant="ghost" onClick={() => startEdit(key)} aria-label="Bearbeiten">
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Löschen"
                          onClick={() =>
                            participantHasAssessment(project, key)
                              ? setConfirmKey(key)
                              : remove(key)
                          }
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/**
 * Manuelle Teilnehmerliste: Teilnehmende ohne HISinOne-Datei
 * (Einzelformular, Liste einfügen, Excel/CSV, Tabelle).
 */
export function ManualParticipantsPanel({
  project,
  setProject,
  id,
  className,
}: {
  project: ExamProject;
  setProject: Updater;
  id?: string;
  className?: string;
}) {
  const count = listManualParticipants(project).length;
  return (
    <Card id={id} className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          Manuelle Teilnehmerliste
          {count > 0 && (
            <Badge variant="secondary" className="ml-2 font-normal">
              {count}
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Für Prüfungen ohne {HISINONE_LABEL}-Daten (z. B. berufsbegleitende
          Studiengänge). Zählt wie eine {HISINONE_LABEL}-Datei zur
          Teilnehmerliste; Notenmeldung über die Excel-Notenliste bzw. manuelle
          Notenmeldung unter Dokumente. Pflicht: Matrikelnummer, Nachname,
          Vorname.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm font-medium">Einzeln erfassen</p>
            <AddStudentForm project={project} onAdd={setProject} />
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Mehrere übernehmen</p>
            <BulkImport project={project} setProject={setProject} />
          </div>
        </div>
        <ParticipantTable project={project} setProject={setProject} />
      </CardContent>
    </Card>
  );
}
