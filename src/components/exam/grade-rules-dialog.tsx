"use client";

import { useMemo, useState } from "react";
import { useExamContext } from "@/components/exam/exam-context";
import {
  acknowledgeGradeRules,
  listGradeRuleChanges,
  needsGradeRulesReview,
} from "@/lib/grades/grade-rules-review";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatGrade } from "@/lib/utils";

/**
 * Einmaliger Hinweis je Projekt: Notenregeln wurden auf RaPO/APO umgestellt
 * (Notenmittel abschneiden, > 4,0 → 5,0, Korrektorenmittel als Notenstufe).
 * Erscheint nur, wenn sich berechnete Noten tatsächlich ändern.
 */
export function GradeRulesDialog() {
  const { project, setProject } = useExamContext();
  const [dismissed, setDismissed] = useState(false);

  const needsReview = project != null && needsGradeRulesReview(project);
  // Nur beim ersten Laden berechnen (Projekt-ID), nicht bei jeder Eingabe
  const projectId = project?.id;
  const changes = useMemo(
    () => (project && needsReview ? listGradeRuleChanges(project) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectId, needsReview]
  );

  const open = needsReview && !dismissed && changes.length > 0;
  if (!open) return null;

  const confirm = () => {
    setProject((prev) => acknowledgeGradeRules(prev));
    setDismissed(true);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setDismissed(true);
      }}
    >
      <DialogContent className="max-h-[min(90vh,40rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Notenregeln aktualisiert</DialogTitle>
          <DialogDescription>
            Notenmittel (Portfolio, Studienarbeit mit Note-Kriterien,
            Korrektorenmittel) werden jetzt nach RaPO/APO gebildet: erste
            Dezimalstelle abschneiden, über 4,0 nicht bestanden. Dadurch
            ändern sich {changes.length} berechnete Note(n). Bereits
            exportierte HISinOne-Dateien sind nicht betroffen; manuelle
            Überschreibungen bleiben unverändert.
          </DialogDescription>
        </DialogHeader>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-1 pr-2 font-medium">Name</th>
              <th className="py-1 pr-2 font-medium">Matr.</th>
              <th className="py-1 pr-2 text-right font-medium">alt</th>
              <th className="py-1 text-right font-medium">neu</th>
            </tr>
          </thead>
          <tbody>
            {changes.map((c) => (
              <tr key={c.key} className="border-b last:border-0">
                <td className="py-1 pr-2">
                  {c.lastName}, {c.firstName}
                </td>
                <td className="py-1 pr-2 tabular-nums">{c.key}</td>
                <td className="py-1 pr-2 text-right tabular-nums text-muted-foreground">
                  {c.oldGrade != null ? formatGrade(c.oldGrade) : "–"}
                </td>
                <td className="py-1 text-right font-semibold tabular-nums">
                  {c.newGrade != null ? formatGrade(c.newGrade) : "–"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDismissed(true)}>
            Später
          </Button>
          <Button onClick={confirm}>Zur Kenntnis genommen</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
