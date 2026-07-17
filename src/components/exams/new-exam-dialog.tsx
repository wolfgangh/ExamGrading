"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
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
import { createEmptyExamProject, createDefaultSubAreas } from "@/lib/project-factory";
import { saveExam } from "@/lib/storage";
import type { ExamType } from "@/lib/types";

type FormValues = {
  name: string;
  examNumber?: string;
  semester?: string;
  lecturers?: string;
  examType: "the" | "written" | "other";
  maxPoints: number;
  passThreshold: number;
  useFrmPreset?: boolean;
};

const schema = z.object({
  name: z.string().min(2, "Bitte Prüfungsname angeben"),
  examNumber: z.string().optional(),
  semester: z.string().optional(),
  lecturers: z.string().optional(),
  examType: z.enum(["the", "written", "other"]),
  maxPoints: z.number().min(1).max(1000),
  passThreshold: z.number().min(0).max(1000),
  useFrmPreset: z.boolean().optional(),
});

export function NewExamDialog({ onCreated }: { onCreated?: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      examNumber: "",
      semester: "",
      lecturers: "",
      examType: "the",
      maxPoints: 90,
      passThreshold: 45,
      useFrmPreset: true,
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setSaving(true);
    try {
      const lecturers = (values.lecturers ?? "")
        .split(/[,;]/)
        .map((s) => s.trim())
        .filter(Boolean);

      const maxPoints = Number(values.maxPoints) || 90;
      const passThreshold = Number(values.passThreshold) || 45;

      const project = createEmptyExamProject({
        name: values.name,
        examNumber: values.examNumber,
        semester: values.semester,
        lecturers,
        examType: values.examType as ExamType,
        maxPoints,
        passThreshold,
        subAreas: values.useFrmPreset
          ? createDefaultSubAreas().map((sa) => ({
              name: sa.name,
              code: sa.code,
              maxPoints: sa.maxPoints,
            }))
          : [
              {
                name: "Gesamt",
                code: "G",
                maxPoints,
              },
            ],
      });

      await saveExam(project);
      setOpen(false);
      form.reset();
      onCreated?.();
      router.push(`/exam/${project.id}/overview`);
    } finally {
      setSaving(false);
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button>
            <Plus className="size-4" />
            Neue Prüfung
          </Button>
        }
      />
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Neue Prüfung anlegen</DialogTitle>
          <DialogDescription>
            Metadaten und Notenschema. Importe und Punkte folgen im nächsten
            Schritt.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="name">Prüfungsname *</Label>
            <Input id="name" {...form.register("name")} placeholder="Finanzierung und Investition" />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="examNumber">Prüfungsnummer</Label>
            <Input
              id="examNumber"
              {...form.register("examNumber")}
              placeholder="BW 20152 7820010 FI"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="semester">Semester</Label>
              <Input
                id="semester"
                {...form.register("semester")}
                placeholder="Sommer 2025"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Prüfungstyp</Label>
              <Select
                value={form.watch("examType")}
                onValueChange={(v) =>
                  form.setValue("examType", v as FormValues["examType"])
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="the">Take-Home-Exam</SelectItem>
                  <SelectItem value="written">Klausur</SelectItem>
                  <SelectItem value="other">Sonstige</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="lecturers">Dozenten (Komma-getrennt)</Label>
            <Input
              id="lecturers"
              {...form.register("lecturers")}
              placeholder="Prof. Dr. Mustermann, Prof. Dr. Beispiel"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="maxPoints">Max. Punkte</Label>
              <Input
                id="maxPoints"
                type="number"
                step="0.5"
                {...form.register("maxPoints", { valueAsNumber: true })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="passThreshold">Bestehensgrenze</Label>
              <Input
                id="passThreshold"
                type="number"
                step="0.5"
                {...form.register("passThreshold", { valueAsNumber: true })}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 rounded border"
              {...form.register("useFrmPreset")}
            />
            Teilgebiete FRM + Investition (45/45) vorbefüllen
          </label>
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
