import type { ExamProject } from "@/lib/types";

/** Offene Aufgaben mit „Bewertung notwendig“ */
export function countOpenGradingTasks(project: ExamProject): {
  people: number;
  tasks: number;
} {
  let people = 0;
  let tasks = 0;
  for (const p of project.points ?? []) {
    const n = p.needsGrading?.length ?? 0;
    if (n > 0) {
      people++;
      tasks += n;
    }
  }
  return { people, tasks };
}

export function hasOpenGrading(project: ExamProject): boolean {
  const { tasks } = countOpenGradingTasks(project);
  return tasks > 0;
}

export function openGradingSummary(project: ExamProject): string {
  const { people, tasks } = countOpenGradingTasks(project);
  if (tasks === 0) return "Alle Aufgaben bewertet";
  return `${people} Person(en), ${tasks} Aufgabe(n) offen („Bewertung notwendig“)`;
}
