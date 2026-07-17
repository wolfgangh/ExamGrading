"use client";

import type { QuestionDef, SubArea } from "@/lib/types";
import { Label } from "@/components/ui/label";
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

export function QuestionSubareaMapper({
  questionDefs,
  subAreas,
  onChange,
}: {
  questionDefs: QuestionDef[];
  subAreas: SubArea[];
  onChange: (questionId: string, subAreaId: string) => void;
}) {
  if (questionDefs.length === 0 || subAreas.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Keine Aufgaben oder Teilgebiete vorhanden. Zuerst THE-Punkte
        importieren und Teilgebiete in den Einstellungen prüfen.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">
        Aufgaben den Teilgebieten zuordnen
      </Label>
      <p className="text-xs text-muted-foreground">
        Steuert Summen und Auswertung je Teilgebiet (z. B. FRM vs. Investition).
      </p>
      <div className="overflow-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Aufgabe</TableHead>
              <TableHead className="w-20">Max</TableHead>
              <TableHead>Teilgebiet</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {questionDefs.map((q) => (
              <TableRow key={q.id}>
                <TableCell className="font-medium">{q.label}</TableCell>
                <TableCell className="tabular-nums text-muted-foreground">
                  {q.maxPoints || "–"}
                </TableCell>
                <TableCell>
                  <Select
                    value={q.subAreaId ?? subAreas[0]?.id ?? ""}
                    onValueChange={(v) => v && onChange(q.id, v)}
                  >
                    <SelectTrigger className="w-full max-w-xs">
                      <SelectValue>
                        {subAreas.find(
                          (s) => s.id === (q.subAreaId ?? subAreas[0]?.id)
                        )?.name ?? "–"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {subAreas.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} ({s.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
