export type ColorMode = "light" | "dark";
export type FontFamily = "sans" | "serif";
/** Basis 17px + zwei größere Stufen */
export type FontScale = "md" | "lg" | "xl";

export interface AppearancePreferences {
  colorMode: ColorMode;
  fontFamily: FontFamily;
  highContrast: boolean;
  fontScale: FontScale;
}

export const APPEARANCE_STORAGE_KEY = "exam-grade-appearance";

export const FONT_SCALES: readonly FontScale[] = ["md", "lg", "xl"] as const;

export const FONT_SCALE_LABELS: Record<FontScale, string> = {
  md: "Standard",
  lg: "Groß",
  xl: "Sehr groß",
};

export const FONT_SCALE_PX: Record<FontScale, string> = {
  md: "17px",
  lg: "19px",
  xl: "22px",
};

export const DEFAULT_APPEARANCE: AppearancePreferences = {
  colorMode: "light",
  fontFamily: "sans",
  highContrast: false,
  fontScale: "md",
};

function parseFontScale(value: unknown): FontScale {
  if (value === "lg" || value === "xl" || value === "md") return value;
  return "md";
}

export function nextFontScale(current: FontScale): FontScale {
  const i = FONT_SCALES.indexOf(current);
  return FONT_SCALES[(i + 1) % FONT_SCALES.length] ?? "md";
}

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
      fontScale: parseFontScale(parsed.fontScale),
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
  root.dataset.fontScale = prefs.fontScale;
  root.style.setProperty("--app-font-size", FONT_SCALE_PX[prefs.fontScale]);
  root.classList.toggle("high-contrast", prefs.highContrast);
}
