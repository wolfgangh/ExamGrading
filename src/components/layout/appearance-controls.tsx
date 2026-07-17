"use client";

import { Contrast, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme/theme-provider";
import { cn } from "@/lib/utils";

export function AppearanceControls() {
  const { colorMode, highContrast, toggleColorMode, toggleHighContrast } =
    useTheme();

  return (
    <div className="flex items-center gap-1">
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
