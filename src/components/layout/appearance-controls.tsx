"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme/theme-provider";

export function AppearanceControls() {
  const { colorMode, toggleColorMode } = useTheme();

  return (
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
  );
}
