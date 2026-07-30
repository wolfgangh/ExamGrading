import { APP_NAME, APP_VERSION, appVersionLabel } from "@/lib/app-version";

/** Privates Repo – nur mit GitHub-Zugang sichtbar/bedienbar */
export const GITHUB_REPO = "wolfgangh/ExamGrading";
export const GITHUB_REPO_URL = `https://github.com/${GITHUB_REPO}`;

export const GITHUB_ISSUES_CHOOSE_URL = `${GITHUB_REPO_URL}/issues/new/choose`;

export type FeedbackIssueKind = "bug" | "feature" | "question";

const TEMPLATE_FILE: Record<FeedbackIssueKind, string> = {
  bug: "bug_report.yml",
  feature: "feature_request.yml",
  question: "question.yml",
};

export function githubNewIssueUrl(
  kind: FeedbackIssueKind,
  title?: string
): string {
  const u = new URL(`${GITHUB_REPO_URL}/issues/new`);
  u.searchParams.set("template", TEMPLATE_FILE[kind]);
  if (title?.trim()) u.searchParams.set("title", title.trim());
  return u.toString();
}

export type ClientEnvironmentInfo = {
  appName: string;
  appVersion: string;
  appLabel: string;
  userAgent: string;
  language: string;
  platform: string;
  viewport: string;
  screen: string;
  teamsHint: string;
  href: string;
  collectedAt: string;
};

/** Browser-Umgebung für Bug-Meldungen (ohne Prüfungsdaten). */
export function collectClientEnvironment(): ClientEnvironmentInfo {
  if (typeof window === "undefined") {
    return {
      appName: APP_NAME,
      appVersion: APP_VERSION,
      appLabel: appVersionLabel(),
      userAgent: "—",
      language: "—",
      platform: "—",
      viewport: "—",
      screen: "—",
      teamsHint: "—",
      href: "—",
      collectedAt: new Date().toISOString(),
    };
  }

  const nav = window.navigator;
  const inTeams =
    /\bTeams\b/i.test(nav.userAgent) ||
    /\bMSTeams\b/i.test(nav.userAgent) ||
    window.location.search.includes("teams") ||
    document.referrer.includes("teams.microsoft.com");

  return {
    appName: APP_NAME,
    appVersion: APP_VERSION,
    appLabel: appVersionLabel(),
    userAgent: nav.userAgent || "—",
    language: nav.language || "—",
    platform: nav.platform || "—",
    viewport: `${window.innerWidth}×${window.innerHeight}`,
    screen: `${window.screen?.width ?? "?"}×${window.screen?.height ?? "?"}`,
    teamsHint: inTeams ? "vermutlich Teams / eingebettet" : "nein / unklar",
    href: window.location.pathname + window.location.search,
    collectedAt: new Date().toISOString(),
  };
}

export function formatEnvironmentMarkdown(
  info: ClientEnvironmentInfo = collectClientEnvironment()
): string {
  return [
    "### Umgebung (automatisch aus der App)",
    "",
    `- **App:** ${info.appLabel}`,
    `- **Browser:** ${info.userAgent}`,
    `- **Sprache:** ${info.language}`,
    `- **Plattform:** ${info.platform}`,
    `- **Viewport:** ${info.viewport}`,
    `- **Bildschirm:** ${info.screen}`,
    `- **Teams/Einbettung:** ${info.teamsHint}`,
    `- **Seite (Pfad):** ${info.href}`,
    `- **Erfasst:** ${info.collectedAt}`,
    "",
    "_Keine Matrikelnummern, Noten oder JSON-Sicherungen anhängen._",
  ].join("\n");
}
