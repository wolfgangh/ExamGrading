"use client";

import { appFooterText } from "@/lib/app-version";

export function AppFooter() {
  return (
    <footer className="shrink-0 border-t bg-card/40 px-4 py-2.5 text-center text-xs text-muted-foreground">
      <p>{appFooterText()}</p>
    </footer>
  );
}
