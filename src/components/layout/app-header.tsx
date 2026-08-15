"use client";

import Link from "next/link";
import { LogOut, Menu } from "lucide-react";
import { AppearanceControls } from "@/components/layout/appearance-controls";
import { AppLogo } from "@/components/layout/app-logo";
import { Button } from "@/components/ui/button";
import { clearAuthentication } from "@/lib/app-auth";

export function AppHeader({
  subtitle,
  actions,
  onOpenNav,
}: {
  subtitle?: string;
  actions?: React.ReactNode;
  onOpenNav?: () => void;
}) {
  const logout = () => {
    clearAuthentication();
    // AuthGate reagiert auf AUTH_CHANGE_EVENT und zeigt den Login
  };

  return (
    <header className="surface-header sticky top-0 z-40 border-b">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
        {onOpenNav && (
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="md:hidden"
            onClick={onOpenNav}
            aria-label="Prüfungsnavigation öffnen"
            title="Navigation"
          >
            <Menu className="size-4" />
          </Button>
        )}
        <Link
          href="/"
          className="flex min-w-0 max-w-full shrink items-center gap-3 sm:max-w-[min(100%,18rem)] md:max-w-[min(100%,24rem)]"
        >
          <AppLogo size={36} priority />
          <div className="min-w-0">
            <p className="text-base font-semibold text-foreground">ExamGrade</p>
            <p className="truncate text-sm text-muted-foreground">
              {subtitle ?? "Prüfungsnoten-Tool"}
            </p>
          </div>
        </Link>
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
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
