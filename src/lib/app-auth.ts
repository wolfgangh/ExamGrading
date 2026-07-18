/**
 * Client-seitiger App-Zugang (sessionStorage).
 *
 * Passwort (Pflicht, kein Code-Default):
 *   1. Lokal:  `.env.local` → NEXT_PUBLIC_APP_PASSWORD=… (siehe `.env.example`)
 *   2. Vercel: Project → Settings → Environment Variables → NEXT_PUBLIC_APP_PASSWORD
 *   3. Neu bauen/deployen (NEXT_PUBLIC_* wird zur Build-Zeit eingebettet).
 *
 * Production-Build bricht ab, wenn die Variable fehlt (`next.config.ts`).
 *
 * Hinweis: Das Passwort ist im Client-Bundle sichtbar – nur Zugangshürde, kein
 * serverseitiger Geheimnisschutz.
 */

export const AUTH_SESSION_KEY = "exam-grade-auth";
export const AUTH_TOKEN = "authenticated";
export const AUTH_CHANGE_EVENT = "examgrade-auth-changed";

/** Erwartetes Passwort aus Build-Env; leer wenn nicht gesetzt. */
export function getExpectedPassword(): string {
  return process.env.NEXT_PUBLIC_APP_PASSWORD?.trim() ?? "";
}

export function isAppPasswordConfigured(): boolean {
  return getExpectedPassword().length > 0;
}

export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(AUTH_SESSION_KEY) === AUTH_TOKEN;
  } catch {
    return false;
  }
}

export function setAuthenticated(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(AUTH_SESSION_KEY, AUTH_TOKEN);
    window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
  } catch {
    // private mode / blocked storage
  }
}

export function clearAuthentication(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
  } catch {
    // ignore
  }
}

export function verifyPassword(input: string): boolean {
  const expected = getExpectedPassword();
  if (!expected) {
    if (process.env.NODE_ENV === "development") {
      console.error(
        "[ExamGrade] NEXT_PUBLIC_APP_PASSWORD fehlt. Bitte .env.local anlegen (siehe .env.example) und Dev-Server neu starten."
      );
    }
    return false;
  }
  return input === expected;
}
