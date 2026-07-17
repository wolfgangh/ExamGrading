/**
 * Client-seitiger App-Zugang (sessionStorage).
 *
 * Passwort ändern:
 *   1. Lokal:  `.env.local` → NEXT_PUBLIC_APP_PASSWORD=geheim
 *   2. Vercel: Project → Settings → Environment Variables → NEXT_PUBLIC_APP_PASSWORD
 *   3. Neu bauen/deployen (NEXT_PUBLIC_* wird zur Build-Zeit eingebettet).
 *
 * Hinweis: Das Passwort ist im Client-Bundle sichtbar – nur Zugangshürde, kein
 * serverseitiger Geheimnisschutz.
 */

export const AUTH_SESSION_KEY = "exam-grade-auth";
export const AUTH_TOKEN = "authenticated";
export const AUTH_CHANGE_EVENT = "examgrade-auth-changed";

/**
 * Fallback, falls NEXT_PUBLIC_APP_PASSWORD nicht gesetzt ist.
 * In Produktion bitte per Environment-Variable überschreiben.
 */
export const DEFAULT_APP_PASSWORD = "oth-regensburg";

export function getExpectedPassword(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_PASSWORD?.trim();
  if (fromEnv) return fromEnv;
  return DEFAULT_APP_PASSWORD;
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
  return input === getExpectedPassword();
}
