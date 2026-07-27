/**
 * Versionsstand der App (mit package.json abstimmen).
 * Wird im Footer und ggf. in Exporten angezeigt.
 */
export const APP_NAME = "ExamGrade";
export const APP_VERSION = "0.4.48";
export const APP_COPYRIGHT = "Prof. Dr. Wolfgang Hößl";

export function appVersionLabel(): string {
  return `${APP_NAME} v${APP_VERSION}`;
}

export function appFooterText(): string {
  return `© ${APP_COPYRIGHT} · ${appVersionLabel()} · OTH Regensburg · Client-seitig · Keine Serverübertragung`;
}
