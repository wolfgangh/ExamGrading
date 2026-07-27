import { normalizeMatriculation } from "@/lib/matching/matriculation";
import type { ExamProject, PointsRecord } from "@/lib/types";

/**
 * Person als „nicht angetreten“ markieren bzw. Markierung aufheben.
 * Portfolio/StA: keine Teilnoten nötig; Status no_show; Export mit leerer Note.
 */
export function setStudentNotAttended(
  project: ExamProject,
  matKey: string,
  notAttended: boolean
): ExamProject {
  const key = normalizeMatriculation(matKey) || matKey;
  if (!key) return project;

  const points = [...(project.points ?? [])];
  const idx = points.findIndex(
    (p) => normalizeMatriculation(p.matriculationNumber) === key
  );

  if (idx < 0) {
    if (!notAttended) return project;
    const empty: PointsRecord = {
      matriculationNumber: key,
      bySubArea: Object.fromEntries(
        (project.subAreas ?? []).map((sa) => [sa.id, null])
      ),
      totalPoints: null,
      source: "manual",
      notAttended: true,
    };
    return { ...project, points: [...points, empty] };
  }

  const next: PointsRecord = {
    ...points[idx],
    notAttended: notAttended ? true : undefined,
    source:
      points[idx].source === "moodle" ? "mixed" : points[idx].source || "manual",
  };
  if (!notAttended) {
    delete next.notAttended;
  }
  points[idx] = next;
  return { ...project, points };
}
