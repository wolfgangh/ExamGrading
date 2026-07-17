import { normalizeMatriculation } from "@/lib/matching/matriculation";
import type { Student } from "@/lib/types";

/** Normalisiert Login/E-Mail für Vergleich */
export function normalizeLogin(raw: string | undefined | null): string | null {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase();
  if (!s || s === "-" || s === "–") return null;
  return s;
}

export function nameKey(lastName: string, firstName: string): string {
  return `${lastName.trim().toLowerCase()}|${firstName.trim().toLowerCase()}`;
}

export type MatchMethod = "matriculation" | "login" | "email" | "name" | "none";

export interface StudentLookup {
  byMat: Map<string, Student>;
  byLogin: Map<string, string>; // login/email → matnr
  byName: Map<string, string>; // nameKey → matnr
}

/** Lookup aus project.students (Antritt liefert oft E-Mail = Anmeldename) */
export function buildStudentLookup(
  students: Record<string, Student>
): StudentLookup {
  const byMat = new Map<string, Student>();
  const byLogin = new Map<string, string>();
  const byName = new Map<string, string>();

  for (const [key, s] of Object.entries(students)) {
    const mat =
      normalizeMatriculation(s.matriculationNumber) ??
      normalizeMatriculation(key);
    if (!mat) continue;
    byMat.set(mat, s);

    const email = normalizeLogin(s.email);
    if (email) {
      byLogin.set(email, mat);
      // lokaler Teil vor @
      const local = email.split("@")[0];
      if (local) byLogin.set(local, mat);
    }

    if (s.lastName || s.firstName) {
      byName.set(nameKey(s.lastName, s.firstName), mat);
    }
  }

  return { byMat, byLogin, byName };
}

/**
 * Matrikelnummer auflösen – primär Anmeldename (THE-Match).
 */
export function resolveMatriculation(input: {
  matriculationRaw?: unknown;
  login?: string;
  email?: string;
  lastName?: string;
  firstName?: string;
  lookup: StudentLookup;
}): { mat: string | null; method: MatchMethod } {
  const fromCol = normalizeMatriculation(input.matriculationRaw ?? null);
  if (fromCol && input.lookup.byMat.has(fromCol)) {
    return { mat: fromCol, method: "matriculation" };
  }
  if (fromCol) {
    // Matnr. in Datei, auch ohne vorherigen Student-Eintrag
    return { mat: fromCol, method: "matriculation" };
  }

  const login = normalizeLogin(input.login);
  if (login) {
    const mat = input.lookup.byLogin.get(login);
    if (mat) return { mat, method: "login" };
    const local = login.split("@")[0];
    if (local) {
      const mat2 = input.lookup.byLogin.get(local);
      if (mat2) return { mat: mat2, method: "login" };
    }
  }

  const email = normalizeLogin(input.email);
  if (email) {
    const mat = input.lookup.byLogin.get(email);
    if (mat) return { mat, method: "email" };
    const local = email.split("@")[0];
    if (local) {
      const mat2 = input.lookup.byLogin.get(local);
      if (mat2) return { mat: mat2, method: "email" };
    }
  }

  if (input.lastName || input.firstName) {
    const mat = input.lookup.byName.get(
      nameKey(input.lastName ?? "", input.firstName ?? "")
    );
    if (mat) return { mat, method: "name" };
  }

  return { mat: null, method: "none" };
}
