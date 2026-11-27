import type { ExamProject } from "@/lib/types";

/**
 * Teilnehmer-Quelle einer Prüfung: HISinOne-Datei(en) und/oder manuelle
 * Teilnehmerliste. Steuert, welche Import-Schritte und Exporte angezeigt werden.
 * Mindestens eine Quelle ist immer aktiv; Standard: nur HISinOne.
 */
export type ParticipantSources = { his: boolean; manual: boolean };

export const DEFAULT_PARTICIPANT_SOURCES: ParticipantSources = {
  his: true,
  manual: false,
};

function hasHisData(project: ExamProject): boolean {
  return (project.hisSources ?? []).some(
    (s) => s.kind !== "manual" && s.rows.length > 0
  ) || ((project.hisSources?.length ?? 0) === 0 && (project.hisRows?.length ?? 0) > 0);
}

function hasManualData(project: ExamProject): boolean {
  return (project.hisSources ?? []).some(
    (s) => s.kind === "manual" && s.rows.length > 0
  );
}

/** Gespeicherte Wahl, sonst aus vorhandenen Daten abgeleitet. */
export function getParticipantSources(project: ExamProject): ParticipantSources {
  const stored = project.participantSources;
  if (stored && (stored.his || stored.manual)) {
    return { his: stored.his === true, manual: stored.manual === true };
  }
  const his = hasHisData(project);
  const manual = hasManualData(project);
  if (!his && !manual) return { ...DEFAULT_PARTICIPANT_SOURCES };
  return { his, manual };
}

/** Quelle umschalten; die letzte aktive Quelle kann nicht abgeschaltet werden. */
export function toggleParticipantSource(
  project: ExamProject,
  key: keyof ParticipantSources
): ExamProject {
  const cur = getParticipantSources(project);
  const next = { ...cur, [key]: !cur[key] };
  if (!next.his && !next.manual) return project;
  return { ...project, participantSources: next };
}

export function participantSourcesLabel(s: ParticipantSources): string {
  if (s.his && s.manual) return "HISinOne und manuell";
  return s.manual ? "Manuell" : "HISinOne";
}
