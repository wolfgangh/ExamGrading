"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ExamProject } from "@/lib/types";
import { supportsStudentGroups } from "@/lib/types";
import { addManualParticipants } from "@/lib/manual-participants";
import { clearStructuralBackupMilestones } from "@/lib/workflow-milestones";
import { StudentGroupSelect } from "@/components/exam/student-group-select";
import { UserPlus } from "lucide-react";

/** Einzelne Person zur manuellen Teilnehmerliste hinzufügen. */
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
  const [programCode, setProgramCode] = useState("");
  const [email, setEmail] = useState("");
  const [attempt, setAttempt] = useState("");
  const [groupId, setGroupId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const showGroup = supportsStudentGroups(project.examType);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOk(null);
    const input = {
      matriculationNumber: mat,
      lastName,
      firstName,
      programCode,
      email,
      attempt: attempt.trim() ? Number(attempt) : null,
      groupId: showGroup ? groupId : null,
    };
    // Validierung gegen den aktuellen Stand (gleiche Regeln wie beim Speichern)
    const check = addManualParticipants(project, [input]);
    if (check.added === 0) {
      setError(check.issues[0]?.reason ?? "Person konnte nicht hinzugefügt werden.");
      return;
    }
    onAdd((prev) =>
      clearStructuralBackupMilestones(addManualParticipants(prev, [input]).project)
    );
    setOk(`„${lastName.trim()}, ${firstName.trim()}“ hinzugefügt.`);
    setMat("");
    setLastName("");
    setFirstName("");
    setProgramCode("");
    setEmail("");
    setAttempt("");
    setGroupId(null);
  };

  return (
    <form onSubmit={submit} className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="add-mat">Matrikelnummer *</Label>
          <Input
            id="add-mat"
            value={mat}
            onChange={(e) => setMat(e.target.value)}
            placeholder="z. B. 1234567"
            required
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="add-ln">Nachname *</Label>
          <Input
            id="add-ln"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="add-fn">Vorname *</Label>
          <Input
            id="add-fn"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="add-prog">Studiengang</Label>
          <Input
            id="add-prog"
            value={programCode}
            onChange={(e) => setProgramCode(e.target.value)}
            placeholder="z. B. MEB, MBW"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="add-mail">E-Mail</Label>
          <Input
            id="add-mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="add-att">Versuch</Label>
          <Input
            id="add-att"
            inputMode="numeric"
            value={attempt}
            onChange={(e) => setAttempt(e.target.value)}
            placeholder="1, 2 oder 3"
          />
        </div>
        {showGroup && (
          <div className="grid gap-1.5">
            <Label>Gruppe</Label>
            <StudentGroupSelect
              project={project}
              groupId={groupId}
              onChange={setGroupId}
            />
          </div>
        )}
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
    </form>
  );
}
