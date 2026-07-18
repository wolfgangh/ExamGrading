"use client";

import { ALargeSmall, Contrast, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme/theme-provider";
import {
  FONT_SCALE_LABELS,
  nextFontScale,
  type FontScale,
} from "@/lib/preferences";
import { cn } from "@/lib/utils";

const SCALE_HINT: Record<FontScale, string> = {
  md: "A",
  lg: "A+",
  xl: "A++",
};

export function AppearanceControls() {
  const {
    colorMode,
    highContrast,
    fontScale,
    toggleColorMode,
    toggleHighContrast,
    cycleFontScale,
  } = useTheme();

  const next = nextFontScale(fontScale);
  const fontTitle = `Schriftgröße: ${FONT_SCALE_LABELS[fontScale]} (Klick → ${FONT_SCALE_LABELS[next]})`;

  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        onClick={cycleFontScale}
        title={fontTitle}
        aria-label={`Schriftgröße: ${FONT_SCALE_LABELS[fontScale]}`}
        className={cn(
          "relative",
          fontScale !== "md" && "border-primary bg-primary/10"
        )}
      >
        <ALargeSmall />
        {fontScale !== "md" && (
          <span className="absolute -right-0.5 -bottom-0.5 rounded bg-primary px-0.5 text-[0.55rem] leading-none font-bold text-primary-foreground">
            {SCALE_HINT[fontScale]}
          </span>
        )}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        onClick={toggleHighContrast}
        title={
          highContrast
            ? "Hohen Kontrast deaktivieren"
            : "Hohen Kontrast aktivieren"
        }
        aria-label="Hohen Kontrast umschalten"
        aria-pressed={highContrast}
        className={cn(highContrast && "border-primary bg-primary/10")}
      >
        <Contrast />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        onClick={toggleColorMode}
        title={colorMode === "dark" ? "Hellmodus" : "Dunkelmodus"}
        aria-label="Darstellung umschalten"
      >
        {colorMode === "dark" ? <Sun /> : <Moon />}
      </Button>
    </div>
  );
}
