"use client";

import { FeedbackDialog } from "@/components/layout/feedback-dialog";
import { appFooterDisclaimer, appFooterText } from "@/lib/app-version";

export function AppFooter() {
  return (
    <footer className="shrink-0 border-t bg-card/40 px-4 py-2.5 text-center text-xs text-muted-foreground">
      <p>{appFooterText()}</p>
      <p className="mt-1.5">
        <FeedbackDialog />
      </p>
      <p className="mt-1 text-[0.7rem] opacity-90">{appFooterDisclaimer()}</p>
    </footer>
  );
}
