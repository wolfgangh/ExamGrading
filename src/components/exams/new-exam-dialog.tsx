"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ComboboxField } from "@/components/ui/combobox-field";
import { ClearableInput } from "@/components/ui/clearable-input";
import {
  DEFAULT_LECTURER,
  EXAM_NAME_OPTIONS,
  defaultLecturersForExam,
  findCatalogEntry,
  resolveExamDisplayName,
  resolveSubAreasForExamName,
  type CatalogSubArea,
} from "@/lib/exam-catalog";
import { LecturerPicker } from "@/components/exam/lecturer-picker";
import { createEmptyExamProject } from "@/lib/project-factory";
import { saveExam } from "@/lib/storage";
import {
  currentSemesterLabel,
  semesterSelectOptions,
} from "@/lib/semester";
import {
  EXAM_TYPE_LABELS,
  isOnlineStyleExam,
  type ExamType,
  type MoodlePointsRoundStep,
} from "@/lib/types";
import {
  DEFAULT_MOODLE_ROUND_STEP,
  MOODLE_ROUND_STEP_OPTIONS,
} from "@/lib/grades/round-half-points";

type ExamTypeValue = ExamType;

function emptySubAreaRow(): CatalogSubArea {
  return { name: "Gesamt", code: "G", maxPoints: 90 };
}

export function NewExamDialog({ onCreated }: { onCreated?: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const [nameInput, setNameInput] = useState("");
  const [examNumber, setExamNumber] = useState("");
  const [semester, setSemester] = useState(() => currentSemesterLabel());
  const [examType, setExamType] = useState<ExamTypeValue>("the");
  const [moodleRoundStep, setMoodleRoundStep] =
    useState<MoodlePointsRoundStep>(DEFAULT_MOODLE_ROUND_STEP);
  const [lecturers, setLecturers] = useState<string[]>([DEFAULT_LECTURER]);
  const [subAreas, setSubAreas] = useState<CatalogSubArea[]>([
    emptySubAreaRow(),
  ]);
  const [nameError, setNameError] = useState<string | null>(null);
  /** Pflicht: lokale Speicherung / Sicherungsrisiko verstanden */
  const [dataAck, setDataAck] = useState(false);

  const showMoodleRound = isOnlineStyleExam(examType);
  const moodleRoundMeta = MOODLE_ROUND_STEP_OPTIONS.find(
    (o) => o.value === moodleRoundStep
  );

  const totalMax = useMemo(
    () => subAreas.reduce((s, sa) => s + (Number(sa.maxPoints) || 0), 0),
    [subAreas]
  );

  const resetForm = () => {
    setNameInput("");
    setExamNumber("");
    setSemester(currentSemesterLabel());
    setExamType("the");
    setMoodleRoundStep(DEFAULT_MOODLE_ROUND_STEP);
    setLecturers([DEFAULT_LECTURER]);
    setSubAreas([emptySubAreaRow()]);
    setNameError(null);
    setDataAck(false);
  };

  const applyNameAndSubAreas = (raw: string) => {
    setNameInput(raw);
    setNameError(null);
    if (!raw.trim()) {
      setSubAreas([emptySubAreaRow()]);
      setLecturers([DEFAULT_LECTURER]);
      return;
    }
    setSubAreas(resolveSubAreasForExamName(raw));
    setLecturers(defaultLecturersForExam(raw));
  };

  const updateSubArea = (index: number, patch: Partial<CatalogSubArea>) => {
    setSubAreas((prev) =>
      prev.map((sa, i) => (i === index ? { ...sa, ...patch } : sa))
    );
  };

  const addSubArea = () => {
    setSubAreas((prev) => [
      ...prev,
      { name: "Teilgebiet", code: "T", maxPoints: 0 },
    ]);
  };

  const removeSubArea = (index: number) => {
    setSubAreas((prev) =>
      prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)
    );
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (trimmed.length < 2) {
      setNameError("Bitte Prüfungsname angeben");
      return;
    }
    if (subAreas.length === 0 || totalMax <= 0) {
      setNameError("Bitte mindestens ein Teilgebiet mit Punkten angeben");
      return;
    }
    if (!dataAck) {
      setNameError(
        "Bitte den Hinweis zur lokalen Speicherung bestätigen."
      );
      return;
    }
    setNameError(null);
    setSaving(true);
    try {
      // Katalog nur für Anzeige-Name; Freitext bleibt
      const catalog = findCatalogEntry(trimmed);
      const project = createEmptyExamProject({
        name: catalog ? resolveExamDisplayName(trimmed) : trimmed,
        examNumber,
        semester,
        lecturers:
          lecturers.length > 0 ? lecturers : [DEFAULT_LECTURER],
        examType,
        moodlePointsRoundStep: isOnlineStyleExam(examType)
          ? moodleRoundStep
          : undefined,
        subAreas: subAreas.map((sa) => ({
          name: sa.name.trim() || "Teilgebiet",
          code: sa.code.trim() || "T",
          maxPoints: Number(sa.maxPoints) || 0,
        })),
      });

      await saveExam(project);
      setOpen(false);
      resetForm();
      onCreated?.();
      router.push(`/exam/${project.id}/overview`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetForm();
      }}
    >
      <DialogTrigger
        render={
          <Button
            size="sm"
            className="max-w-full shrink"
            title="Neue Prüfung anlegen"
          >
            <Plus className="size-4 shrink-0" />
            <span className="truncate">
              <span className="sm:hidden">Neu</span>
              <span className="hidden sm:inline">Neue Prüfung</span>
            </span>
          </Button>
        }
      />
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Neue Prüfung anlegen</DialogTitle>
          <DialogDescription>
            Katalogauswahl oder Freitext. Die Prüfungsnummer kann auch später
            aus der HISinOne-Datei übernommen werden. Bestehensgrenze und
            Notenszenarien legen Sie unter Einstellungen fest.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-3">
          <ComboboxField
            label="Prüfungsname"
            required
            clearable
            value={nameInput}
            onChange={applyNameAndSubAreas}
            options={EXAM_NAME_OPTIONS}
            placeholder="z. B. Finanzierung und Investition (FI)"
          />
          {nameError && (
            <p className="text-sm text-destructive">{nameError}</p>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="examNumber">Prüfungsnummer</Label>
            <ClearableInput
              id="examNumber"
              value={examNumber}
              onChange={setExamNumber}
              placeholder="optional – oder aus HISinOne-Import"
              clearLabel="Prüfungsnummer löschen"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <ComboboxField
              label="Semester"
              value={semester}
              onChange={setSemester}
              options={semesterSelectOptions()}
              placeholder={currentSemesterLabel()}
              clearable
            />
            <div className="grid gap-1.5">
              <Label>Prüfungstyp</Label>
              <Select
                value={examType}
                onValueChange={(v) => {
                  if (!v) return;
                  const t = v as ExamTypeValue;
                  setExamType(t);
                  // Beim Wechsel zu THE/elektrP Standard-Rundung setzen
                  if (
                    isOnlineStyleExam(t) &&
                    !isOnlineStyleExam(examType)
                  ) {
                    setMoodleRoundStep(DEFAULT_MOODLE_ROUND_STEP);
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Typ wählen">
                    {EXAM_TYPE_LABELS[examType]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="the">
                    {EXAM_TYPE_LABELS.the}
                  </SelectItem>
                  <SelectItem value="elektr_p">
                    {EXAM_TYPE_LABELS.elektr_p}
                  </SelectItem>
                  <SelectItem value="written">
                    {EXAM_TYPE_LABELS.written}
                  </SelectItem>
                  <SelectItem value="sta_criteria">
                    {EXAM_TYPE_LABELS.sta_criteria}
                  </SelectItem>
                  <SelectItem value="sta_manual">
                    {EXAM_TYPE_LABELS.sta_manual}
                  </SelectItem>
                  <SelectItem value="portfolio">
                    {EXAM_TYPE_LABELS.portfolio}
                  </SelectItem>
                  <SelectItem value="other">
                    {EXAM_TYPE_LABELS.other}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {showMoodleRound && (
            <div className="grid gap-1.5 rounded-lg border bg-muted/30 px-3 py-3">
              <Label htmlFor="new-moodle-round">
                Moodle-/THE-Punkte runden
              </Label>
              <p className="text-xs text-muted-foreground">
                Beim Import werden Aufgabenpunkte auf das gewählte Raster
                aufgerundet (Standard: 0,5). Später unter Einstellungen
                änderbar.
              </p>
              <Select
                value={String(moodleRoundStep)}
                onValueChange={(v) => {
                  if (!v) return;
                  setMoodleRoundStep(
                    v === "none" ? "none" : v === "0.25" ? 0.25 : 0.5
                  );
                }}
              >
                <SelectTrigger id="new-moodle-round" className="w-full">
                  <SelectValue>
                    {moodleRoundMeta?.label ?? "Rundung wählen"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {MOODLE_ROUND_STEP_OPTIONS.map((o) => (
                    <SelectItem key={String(o.value)} value={String(o.value)}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {moodleRoundMeta && (
                <p className="rounded-md border border-border/80 bg-background px-2.5 py-2 text-xs leading-relaxed">
                  <span className="font-medium">Beispiel: </span>
                  {moodleRoundMeta.example}
                </p>
              )}
            </div>
          )}

          <LecturerPicker
            value={lecturers}
            onChange={setLecturers}
            id="new-exam-lecturers"
          />

          {/* Teilgebiete */}
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <Label>Teilgebiete</Label>
                <p className="text-xs text-muted-foreground">
                  FI und MAP werden vorbefüllt; sonst Gesamt oder eigene
                  Gebiete. Summe:{" "}
                  <span className="font-medium text-foreground">
                    {totalMax} Punkte
                  </span>
                </p>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={addSubArea}>
                <Plus className="size-3.5" />
                Gebiet
              </Button>
            </div>
            <div className="space-y-2">
              {subAreas.map((sa, index) => (
                <div
                  key={index}
                  className="grid grid-cols-[1fr_4.5rem_5rem_auto] items-end gap-1.5"
                >
                  <div className="grid gap-1">
                    {index === 0 && (
                      <span className="text-xs text-muted-foreground">Name</span>
                    )}
                    <Input
                      value={sa.name}
                      onChange={(e) =>
                        updateSubArea(index, { name: e.target.value })
                      }
                      placeholder="Name"
                    />
                  </div>
                  <div className="grid gap-1">
                    {index === 0 && (
                      <span className="text-xs text-muted-foreground">Kürzel</span>
                    )}
                    <Input
                      value={sa.code}
                      onChange={(e) =>
                        updateSubArea(index, { code: e.target.value })
                      }
                      placeholder="Code"
                    />
                  </div>
                  <div className="grid gap-1">
                    {index === 0 && (
                      <span className="text-xs text-muted-foreground">Max.</span>
                    )}
                    <Input
                      type="number"
                      step="0.5"
                      min={0}
                      value={sa.maxPoints}
                      onChange={(e) =>
                        updateSubArea(index, {
                          maxPoints: Number(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={subAreas.length <= 1}
                    onClick={() => removeSubArea(index)}
                    aria-label="Teilgebiet entfernen"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div
            className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-3 text-sm"
            role="note"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle
                className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400"
                aria-hidden
              />
              <div className="min-w-0 space-y-1.5">
                <p className="font-medium text-amber-950 dark:text-amber-100">
                  Lokale Datenspeicherung
                </p>
                <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed text-amber-950/90 dark:text-amber-50/90">
                  <li>
                    Alle Prüfungsdaten liegen <strong>nur in diesem Browser</strong>{" "}
                    (lokal, kein Server). Es gibt keine automatische
                    Cloud-Sicherung.
                  </li>
                  <li>
                    Bitte in den Workflow-Schritten{" "}
                    <strong>Sicherung nach Import</strong> und{" "}
                    <strong>Sicherung nach Noten</strong> die JSON-Projektsicherung
                    herunterladen und sicher ablegen.
                  </li>
                  <li>
                    <strong>Ohne Sicherung gehen die Daten verloren</strong>, wenn
                    der Browser geschlossen, der Speicher geleert oder die App in
                    einem anderen Browser bzw. auf einem anderen Gerät geöffnet
                    wird.
                  </li>
                </ul>
                <label className="mt-2 flex cursor-pointer items-start gap-2.5 rounded-md border border-amber-500/30 bg-background/60 px-2.5 py-2">
                  <Checkbox
                    checked={dataAck}
                    onCheckedChange={(v) => {
                      setDataAck(v === true);
                      if (v === true) setNameError(null);
                    }}
                    className="mt-0.5"
                    aria-required
                  />
                  <span className="text-xs leading-snug text-foreground">
                    Ich habe verstanden: Die Daten existieren nur lokal im
                    Browser und müssen gesichert werden; ohne Sicherung droht
                    Datenverlust (z. B. beim Schließen des Browsers).
                  </span>
                </label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={saving || !dataAck}>
              {saving ? "Speichern…" : "Anlegen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
