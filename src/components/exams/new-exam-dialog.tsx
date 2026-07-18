"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import {
  DEFAULT_LECTURER,
  EXAM_NAME_OPTIONS,
  LECTURER_OPTIONS,
  findCatalogEntry,
  resolveExamDisplayName,
  resolveSubAreasForExamName,
  type CatalogSubArea,
} from "@/lib/exam-catalog";
import { createEmptyExamProject } from "@/lib/project-factory";
import { saveExam } from "@/lib/storage";
import { EXAM_TYPE_LABELS, type ExamType } from "@/lib/types";

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
  const [semester, setSemester] = useState("");
  const [examType, setExamType] = useState<ExamTypeValue>("the");
  const [lecturers, setLecturers] = useState<string[]>([DEFAULT_LECTURER]);
  const [lecturerDraft, setLecturerDraft] = useState("");
  const [subAreas, setSubAreas] = useState<CatalogSubArea[]>([
    emptySubAreaRow(),
  ]);
  const [nameError, setNameError] = useState<string | null>(null);

  const totalMax = useMemo(
    () => subAreas.reduce((s, sa) => s + (Number(sa.maxPoints) || 0), 0),
    [subAreas]
  );

  const resetForm = () => {
    setNameInput("");
    setExamNumber("");
    setSemester("");
    setExamType("the");
    setLecturers([DEFAULT_LECTURER]);
    setLecturerDraft("");
    setSubAreas([emptySubAreaRow()]);
    setNameError(null);
  };

  const applyNameAndSubAreas = (raw: string) => {
    setNameInput(raw);
    setNameError(null);
    if (!raw.trim()) {
      setSubAreas([emptySubAreaRow()]);
      return;
    }
    setSubAreas(resolveSubAreasForExamName(raw));
  };

  const addLecturer = (value?: string) => {
    const name = (value ?? lecturerDraft).trim();
    if (!name) return;
    setLecturers((prev) =>
      prev.some((l) => l.toLowerCase() === name.toLowerCase())
        ? prev
        : [...prev, name]
    );
    setLecturerDraft("");
  };

  const removeLecturer = (name: string) => {
    setLecturers((prev) => prev.filter((l) => l !== name));
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
          <Button>
            <Plus className="size-4" />
            Neue Prüfung
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
            <div className="grid gap-1.5">
              <Label htmlFor="semester">Semester</Label>
              <ClearableInput
                id="semester"
                value={semester}
                onChange={setSemester}
                placeholder="Sommer 2026"
                clearLabel="Semester löschen"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Prüfungstyp</Label>
              <Select
                value={examType}
                onValueChange={(v) => v && setExamType(v as ExamTypeValue)}
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
                  <SelectItem value="other">
                    {EXAM_TYPE_LABELS.other}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Dozenten */}
          <div className="grid gap-1.5">
            <Label>Dozenten</Label>
            <div className="flex flex-wrap gap-1.5">
              {lecturers.map((l) => (
                <Badge
                  key={l}
                  variant="secondary"
                  className="gap-1 pr-1 font-normal"
                >
                  {l}
                  <button
                    type="button"
                    className="rounded-sm p-0.5 hover:bg-muted"
                    onClick={() => removeLecturer(l)}
                    aria-label={`${l} entfernen`}
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
              {lecturers.length === 0 && (
                <span className="text-sm text-muted-foreground">
                  Kein Dozent ausgewählt
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <ClearableInput
                  list="lecturer-options"
                  value={lecturerDraft}
                  onChange={setLecturerDraft}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addLecturer();
                    }
                  }}
                  placeholder="Dozent wählen oder eingeben…"
                  autoComplete="off"
                  clearLabel="Dozenteneingabe löschen"
                />
                <datalist id="lecturer-options">
                  {LECTURER_OPTIONS.map((opt) => (
                    <option key={opt} value={opt} />
                  ))}
                </datalist>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => addLecturer()}
              >
                Hinzufügen
              </Button>
            </div>
          </div>

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

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Speichern…" : "Anlegen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
