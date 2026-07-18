"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  applyAppearanceToDocument,
  DEFAULT_APPEARANCE,
  nextFontScale,
  readAppearance,
  writeAppearance,
  type AppearancePreferences,
  type ColorMode,
  type FontFamily,
  type FontScale,
} from "@/lib/preferences";

interface ThemeContextValue extends AppearancePreferences {
  ready: boolean;
  setColorMode: (mode: ColorMode) => void;
  setFontFamily: (font: FontFamily) => void;
  setFontScale: (scale: FontScale) => void;
  setHighContrast: (on: boolean) => void;
  toggleColorMode: () => void;
  toggleHighContrast: () => void;
  cycleFontScale: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] =
    useState<AppearancePreferences>(DEFAULT_APPEARANCE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = readAppearance();
    setPrefs(stored);
    applyAppearanceToDocument(stored);
    setReady(true);
  }, []);

  const update = useCallback((next: AppearancePreferences) => {
    setPrefs(next);
    writeAppearance(next);
    applyAppearanceToDocument(next);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      ...prefs,
      ready,
      setColorMode: (colorMode) => update({ ...prefs, colorMode }),
      setFontFamily: (fontFamily) => update({ ...prefs, fontFamily }),
      setFontScale: (fontScale) => update({ ...prefs, fontScale }),
      setHighContrast: (highContrast) => update({ ...prefs, highContrast }),
      toggleColorMode: () =>
        update({
          ...prefs,
          colorMode: prefs.colorMode === "dark" ? "light" : "dark",
        }),
      toggleHighContrast: () =>
        update({ ...prefs, highContrast: !prefs.highContrast }),
      cycleFontScale: () =>
        update({ ...prefs, fontScale: nextFontScale(prefs.fontScale) }),
    }),
    [prefs, ready, update]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme muss innerhalb von ThemeProvider verwendet werden.");
  }
  return ctx;
}
