export type ColorMode = "light" | "dark";
export type FontFamily = "sans" | "serif";

export interface AppearancePreferences {
  colorMode: ColorMode;
  fontFamily: FontFamily;
  highContrast: boolean;
}

export const APPEARANCE_STORAGE_KEY = "exam-grade-appearance";

export const DEFAULT_APPEARANCE: AppearancePreferences = {
  colorMode: "light",
  fontFamily: "sans",
  highContrast: false,
};

export function readAppearance(): AppearancePreferences {
  if (typeof window === "undefined") return DEFAULT_APPEARANCE;
  try {
    const raw = localStorage.getItem(APPEARANCE_STORAGE_KEY);
    if (!raw) return DEFAULT_APPEARANCE;
    const parsed = JSON.parse(raw) as Partial<AppearancePreferences>;
    return {
      colorMode: parsed.colorMode === "dark" ? "dark" : "light",
      fontFamily: parsed.fontFamily === "serif" ? "serif" : "sans",
      highContrast: parsed.highContrast === true,
    };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

export function writeAppearance(prefs: AppearancePreferences): void {
  localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(prefs));
}

export function applyAppearanceToDocument(prefs: AppearancePreferences): void {
  const root = document.documentElement;
  root.classList.toggle("dark", prefs.colorMode === "dark");
  root.classList.toggle("font-serif", prefs.fontFamily === "serif");
  root.classList.toggle("font-sans", prefs.fontFamily !== "serif");
  root.dataset.font = prefs.fontFamily;
  root.dataset.theme = prefs.colorMode;
  root.dataset.contrast = prefs.highContrast ? "high" : "normal";
  root.classList.toggle("high-contrast", prefs.highContrast);
}
