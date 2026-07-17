"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function ExamError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Exam route error:", error);
  }, [error]);

  return (
    <div className="page-shell flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-xl font-semibold">
        Prüfung konnte nicht geladen werden
      </h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Ein Fehler ist aufgetreten. Die Daten liegen ggf. weiterhin im Browser –
        bitte zur Übersicht zurück und erneut öffnen.
      </p>
      {error?.message && (
        <p className="max-w-lg font-mono text-xs text-destructive">
          {error.message}
        </p>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" variant="outline" onClick={reset}>
          Erneut versuchen
        </Button>
        <Link href="/" className={cn(buttonVariants(), "inline-flex")}>
          Zur Prüfungsliste
        </Link>
      </div>
    </div>
  );
}
