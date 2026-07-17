"use client";

import Link from "next/link";
import { AppearanceControls } from "@/components/layout/appearance-controls";

export function AppHeader({
  subtitle,
  actions,
}: {
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="surface-header sticky top-0 z-40 border-b">
      <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-3 min-w-0">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            EG
          </div>
          <div className="min-w-0">
            <p className="text-base font-semibold text-foreground">ExamGrade</p>
            <p className="truncate text-sm text-muted-foreground">
              {subtitle ?? "Prüfungsnoten-Tool"}
            </p>
          </div>
        </Link>
        <div className="ml-auto flex items-center gap-2">
          {actions}
          <AppearanceControls />
        </div>
      </div>
    </header>
  );
}
