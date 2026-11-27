"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BookOpenCheck,
  ClipboardList,
  FileQuestion,
  Home,
  Layers,
  Monitor,
  PenSquare,
  Plus,
} from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { ComboboxField } from "@/components/ui/combobox-field";
import {
  DEFAULT_LECTURER,
  EXAM_NAME_OPTIONS,
  defaultLecturersForExam,
  findCatalogEntry,
  resolveExamDisplayName,
} from "@/lib/exam-catalog";
import { LecturerPicker } from "@/components/exam/lecturer-picker";
import { ParticipantSourceToggle } from "@/components/exam/participant-source-toggle";
import { createEmptyExamProject } from "@/lib/project-factory";
import { saveExam } from "@/lib/storage";
import {
  currentSemesterLabel,
  semesterSelectOptions,
} from "@/lib/semester";
import { EXAM_TYPE_LABELS, type ExamType } from "@/lib/types";
import {
  DEFAULT_PARTICIPANT_SOURCES,
  type ParticipantSources,
} from "@/lib/participant-sources";
import { cn } from "@/lib/utils";

/** Einmal je Browser bestätigt: Daten liegen nur lokal */
const STORAGE_ACK_KEY = "examgrade-local-storage-ack";

const EXAM_TYPE_TILES: {
  value: ExamType;
  short: string;
  hint: string;
  Icon: typeof Monitor;
}[] = [
  { value: "elektr_p", short: "elektrP", hint: "Elektronische Prüfung vor Ort, Moodle-Antritt und -Punkte", Icon: Monitor },
  { value: "the", short: "THE", hint: "Take-Home-Exam, Moodle-Antritt und -Punkte", Icon: Home },
  { value: "written", short: "Klausur", hint: "Punkte je Aufgabe, Notenschlüssel", Icon: PenSquare },
  { value: "sta_criteria", short: "StA – Kriterien", hint: "Studienarbeit, gewichtete Kriterien", Icon: ClipboardList },
  { value: "sta_manual", short: "StA – manuell", hint: "Studienarbeit, Note je Person direkt", Icon: BookOpenCheck },
  { value: "portfolio", short: "Portfolio", hint: "Teilleistungen, gewichtete Teilnoten", Icon: Layers },
  { value: "other", short: "Sonstige", hint: "Freie Konfiguration", Icon: FileQuestion },
];

export function NewExamDialog({ onCreated }: { onCreated?: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const [nameInput, setNameInput] = useState("");
  const [semester, setSemester] = useState(() => currentSemesterLabel());
  const [examType, setExamType] = useState<ExamType>("elektr_p");
  const [lecturers, setLecturers] = useState<string[]>([DEFAULT_LECTURER]);
  const [sources, setSources] = useState<ParticipantSources>({
    ...DEFAULT_PARTICIPANT_SOURCES,
  });
  const [nameError, setNameError] = useState<string | null>(null);
  const [ackStored, setAckStored] = useState(true);
  const [dataAck, setDataAck] = useState(false);
  const [showStorageInfo, setShowStorageInfo] = useState(false);

  useEffect(() => {
    try {
      setAckStored(localStorage.getItem(STORAGE_ACK_KEY) === "1");
    } catch {
      setAckStored(false);
    }
  }, [open]);

  const resetForm = () => {
    setNameInput("");
    setSemester(currentSemesterLabel());
    setExamType("elektr_p");
    setLecturers([DEFAULT_LECTURER]);
    setSources({ ...DEFAULT_PARTICIPANT_SOURCES });
    setNameError(null);
    setDataAck(false);
    setShowStorageInfo(false);
  };

  const applyName = (raw: string) => {
    setNameInput(raw);
    setNameError(null);
    setLecturers(raw.trim() ? defaultLecturersForExam(raw) : [DEFAULT_LECTURER]);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (trimmed.length < 2) {
      setNameError("Bitte Prüfungsname angeben");
      return;
    }
    if (!ackStored && !dataAck) {
      setNameError("Bitte den Hinweis zur lokalen Speicherung bestätigen.");
      return;
    }
    setNameError(null);
    setSaving(true);
    try {
      if (!ackStored) {
        try {
          localStorage.setItem(STORAGE_ACK_KEY, "1");
        } catch {
          /* ignore */
        }
      }
      // Katalog nur für Anzeige-Name; Teilgebiete werden aus dem Katalog vorbefüllt
      const catalog = findCatalogEntry(trimmed);
      const project = createEmptyExamProject({
        name: catalog ? resolveExamDisplayName(trimmed) : trimmed,
        semester,
        lecturers: lecturers.length > 0 ? lecturers : [DEFAULT_LECTURER],
        examType,
        participantSources: sources,
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

  const storageInfo = (
    <ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed">
      <li>
        Alle Prüfungsdaten liegen <strong>nur in diesem Browser</strong> (kein
        Server, keine automatische Cloud-Sicherung).
      </li>
      <li>
        Die JSON-Sicherung nach Import und nach den Noten herunterladen und
        sicher ablegen (Menü „Sicherung“).
      </li>
      <li>
        <strong>Ohne Sicherung gehen die Daten verloren</strong>, z. B. beim
        Leeren des Browser-Speichers oder auf einem anderen Gerät.
      </li>
    </ul>
  );

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
          <Button size="sm" className="max-w-full shrink" title="Neue Prüfung anlegen">
            <Plus className="size-4 shrink-0" />
            <span className="truncate">
              <span className="sm:hidden">Neu</span>
              <span className="hidden sm:inline">Neue Prüfung</span>
            </span>
          </Button>
        }
      />
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Neue Prüfung anlegen</DialogTitle>
          <DialogDescription>
            Prüfungsnummer, Teilgebiete, Rundung und Notenschlüssel lassen sich
            danach unter Einstellungen anpassen.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4">
          <ComboboxField
            label="Prüfungsname"
            required
            clearable
            value={nameInput}
            onChange={applyName}
            options={EXAM_NAME_OPTIONS}
            placeholder="z. B. Finanzierung und Investition (FI)"
          />

          <div className="grid gap-1.5">
            <Label>Prüfungsform</Label>
            <div
              role="radiogroup"
              aria-label="Prüfungsform"
              className="grid gap-2 sm:grid-cols-2"
            >
              {EXAM_TYPE_TILES.map(({ value, short, hint, Icon }) => {
                const active = examType === value;
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    title={EXAM_TYPE_LABELS[value]}
                    onClick={() => setExamType(value)}
                    className={cn(
                      "flex items-start gap-2.5 rounded-lg border-2 px-3 py-2 text-left transition-colors",
                      active
                        ? "border-primary bg-primary/10"
                        : "border-border hover:bg-muted"
                    )}
                  >
                    <Icon className={cn("mt-0.5 size-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} aria-hidden />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{short}</span>
                      <span className="block text-xs text-muted-foreground">{hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ComboboxField
              label="Semester"
              value={semester}
              onChange={setSemester}
              options={semesterSelectOptions()}
              placeholder={currentSemesterLabel()}
              clearable
            />
            <div className="grid gap-1.5">
              <Label>Teilnehmer-Quelle</Label>
              <ParticipantSourceToggle
                value={sources}
                size="sm"
                onToggle={(key) =>
                  setSources((prev) => {
                    const next = { ...prev, [key]: !prev[key] };
                    return next.his || next.manual ? next : prev;
                  })
                }
              />
            </div>
          </div>

          <LecturerPicker value={lecturers} onChange={setLecturers} id="new-exam-lecturers" />

          {nameError && <p className="text-sm text-destructive">{nameError}</p>}

          {ackStored ? (
            <p className="text-xs text-muted-foreground">
              Daten liegen nur in diesem Browser – regelmäßig sichern.{" "}
              <button
                type="button"
                className="text-primary underline-offset-2 hover:underline"
                onClick={() => setShowStorageInfo((v) => !v)}
              >
                {showStorageInfo ? "Weniger" : "Mehr dazu"}
              </button>
              {showStorageInfo && <span className="mt-1 block">{storageInfo}</span>}
            </p>
          ) : (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-3 text-sm" role="note">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden />
                <div className="min-w-0 space-y-1.5">
                  <p className="font-medium text-amber-950 dark:text-amber-100">Lokale Datenspeicherung</p>
                  <div className="text-amber-950/90 dark:text-amber-50/90">{storageInfo}</div>
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
                      Verstanden: Die Daten existieren nur lokal und müssen
                      gesichert werden (wird in diesem Browser nur einmal gefragt).
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={saving || (!ackStored && !dataAck)}>
              {saving ? "Speichern…" : "Anlegen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
