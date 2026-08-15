import type { EnrichedStudentRow } from "@/lib/types";
import { uniqueRowsByMatriculation } from "@/lib/grades/statistics";

export type AssessmentRemainingPerson = {
  key: string;
  name: string;
  hiddenByFilter: boolean;
};

export type AssessmentRemaining = {
  total: number;
  done: number;
  remaining: AssessmentRemainingPerson[];
};

/** Personen in HISinOne, die noch eine Note brauchen (kein No-Show). */
export function listAssessmentRemaining(
  rows: EnrichedStudentRow[],
  visibleKeys: Iterable<string>
): AssessmentRemaining {
  const visible = new Set(visibleKeys);
  const due = uniqueRowsByMatriculation(rows.filter((r) => r.inHis));
  const leftover = due.filter(
    (r) => r.status !== "no_show" && r.finalGrade == null
  );
  return {
    total: due.length,
    done: due.length - leftover.length,
    remaining: leftover.map((r) => ({
      key: r.key,
      name:
        `${r.student.lastName ?? ""}, ${r.student.firstName ?? ""}`.replace(
          /^,\s*|,\s*$/g,
          ""
        ) || r.key,
      hiddenByFilter: !visible.has(r.key),
    })),
  };
}
