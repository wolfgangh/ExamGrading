/** Vorgefertigte Begründungen für Matrikel-Zuordnung (editierbar + eigene Texte) */

export const CUSTOM_REASON_VALUE = "__custom__";

export const MERGE_REASON_TEMPLATES: string[] = [
  "Tippfehler in der selbst eingetragenen Matrikelnummer (Antritt); Name und Anmeldename stimmen mit HISinOne überein.",
  "Eine Ziffer in der Matrikelnummer abweichend; Identität nach Abgleich des HISinOne-Dokuments bestätigt.",
  "Antritt und Punkte dem korrekten HISinOne-Eintrag zugeordnet nach manueller Prüfung der Eingabedaten.",
  "Doppelte Erfassung (No-Show in HISinOne + Antritt unter falscher Matrikel) – zusammengeführt nach Sichtung.",
];

export const DISMISS_REASON_TEMPLATES: string[] = [
  "Kein Tippfehler – andere Person bzw. Matrikel korrekt; kein Merge.",
  "Unzureichende Übereinstimmung von Name und Matrikel; Fall bleibt Sonderfall ohne HISinOne-Match.",
  "Nach Prüfung der Antritts- und HISinOne-Daten kein belastbarer Identitätsnachweis; kein Merge.",
  "Orphan bewusst belassen (z. B. externe Person / Sonderfall für manuelle Notenmeldung).",
];

export const UNDO_REASON_TEMPLATES: string[] = [
  "Zusammenführung fälschlich durchgeführt – Zuordnung zurückgenommen.",
  "Nach erneuter Prüfung ist die Identität nicht eindeutig – Merge aufgehoben.",
  "Falsches HISinOne-Ziel gewählt – Merge rückgängig gemacht.",
  "Punkte/Antritt sollen wieder unter der ursprünglichen (Antritts-)Matrikel geführt werden.",
];
