"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeMatriculation } from "@/lib/matching/matriculation";
import type { ExamProject, PointsRecord, Student } from "@/lib/types";
import { UserPlus } from "lucide-react";

export function AddStudentForm({
  project,
  onAdd,
}: {
  project: ExamProject;
  onAdd: (updater: (prev: ExamProject) => ExamProject) => void;
}) {
  const [mat, setMat] = useState("");
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOk(null);
    const key = normalizeMatriculation(mat);
    if (!key) {
      setError("Bitte gültige Matrikelnummer angeben.");
      return;
    }
    if (!lastName.trim()) {
      setError("Nachname fehlt.");
      return;
    }
    if (
      project.students[key] ||
      project.hisRows.some(
        (h) => normalizeMatriculation(h.matriculationNumber) === key
      )
    ) {
      setError("Matrikelnummer ist bereits vorhanden.");
      return;
    }

    const student: Student = {
      matriculationNumber: mat.trim(),
      lastName: lastName.trim(),
      firstName: firstName.trim(),
    };

    onAdd((prev) => {
      const rec: PointsRecord = {
        matriculationNumber: key,
        bySubArea: Object.fromEntries(prev.subAreas.map((s) => [s.id, null])),
        totalPoints: null,
        source: "manual",
        criterionValues:
          prev.examType === "sta_criteria"
            ? Object.fromEntries(
                (prev.criteria ?? []).map((c) => [c.id, null])
              )
            : undefined,
      };
      return {
        ...prev,
        students: { ...prev.students, [key]: student },
        points: [...prev.points, rec],
      };
    });
    setOk(`„${student.lastName}, ${student.firstName}“ hinzugefügt.`);
    setMat("");
    setLastName("");
    setFirstName("");
  };

  return (
    <form onSubmit={submit} className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="add-mat">Matrikelnummer</Label>
          <Input
            id="add-mat"
            value={mat}
            onChange={(e) => setMat(e.target.value)}
            placeholder="z. B. 1234567"
            required
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="add-ln">Nachname</Label>
          <Input
            id="add-ln"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="add-fn">Vorname</Label>
          <Input
            id="add-fn"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </div>
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      {ok && (
        <p className="text-sm text-emerald-700 dark:text-emerald-300">{ok}</p>
      )}
      <Button type="submit" size="sm" className="w-fit gap-1.5">
        <UserPlus className="size-4" />
        Person hinzufügen
      </Button>
      <p className="text-xs text-muted-foreground">
        Manuelle Personen erscheinen in der Bewertung. Ohne HIS-Eintrag nicht
        im HISinOne-Excel – ggf. manuelle Notenmeldung nutzen.
      </p>
    </form>
  );
}
