"use client";

import Link from "next/link";
import { LogOut } from "lucide-react";
import { AppearanceControls } from "@/components/layout/appearance-controls";
import { Button } from "@/components/ui/button";
import { clearAuthentication } from "@/lib/app-auth";

export function AppHeader({
  subtitle,
  actions,
}: {
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  const logout = () => {
    clearAuthentication();
    // AuthGate reagiert auf AUTH_CHANGE_EVENT und zeigt den Login
  };

  return (
    <header className="surface-header sticky top-0 z-40 border-b">
      <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-3">
        <Link href="/" className="flex min-w-0 items-center gap-3">
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
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={logout}
            title="Abmelden"
            aria-label="Abmelden"
          >
            <LogOut />
          </Button>
        </div>
      </div>
    </header>
  );
}
