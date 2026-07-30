"use client";

import { useMemo, useState } from "react";
import { Bug, Copy, ExternalLink, Lightbulb, MessageCircleQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  GITHUB_ISSUES_CHOOSE_URL,
  collectClientEnvironment,
  formatEnvironmentMarkdown,
  githubNewIssueUrl,
  type FeedbackIssueKind,
} from "@/lib/github-feedback";

export function FeedbackDialog() {
  const [open, setOpen] = useState(false);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

  const envText = useMemo(() => {
    if (!open) return "";
    return formatEnvironmentMarkdown(collectClientEnvironment());
  }, [open]);

  const openIssue = (kind: FeedbackIssueKind) => {
    window.open(githubNewIssueUrl(kind), "_blank", "noopener,noreferrer");
  };

  const copyEnv = async () => {
    try {
      const text = formatEnvironmentMarkdown(collectClientEnvironment());
      await navigator.clipboard.writeText(text);
      setCopyMsg("Umgebungsinfos in die Zwischenablage kopiert.");
    } catch {
      setCopyMsg("Kopieren fehlgeschlagen – Text manuell markieren.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="text-xs font-medium text-primary underline-offset-2 hover:underline"
          >
            Feedback &amp; Fehler melden
          </button>
        }
      />
      <DialogContent className="max-h-[min(90vh,36rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Feedback &amp; Fehler melden</DialogTitle>
          <DialogDescription>
            Meldungen laufen über GitHub-Issues im privaten Repository. Sie
            brauchen einen freigeschalteten GitHub-Account (Rolle{" "}
            <strong>Triage</strong> genügt – kein Code-Zugriff nötig).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Bitte <strong>keine</strong> Matrikelnummern, Noten oder
            JSON-Sicherungen posten. App-Version und Browser unten kopieren und
            im Formular einfügen.
          </p>
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start"
              onClick={() => openIssue("bug")}
            >
              <Bug className="size-4" />
              Fehler melden (Bug)
              <ExternalLink className="ml-auto size-3.5 opacity-60" />
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start"
              onClick={() => openIssue("feature")}
            >
              <Lightbulb className="size-4" />
              Feature-Wunsch
              <ExternalLink className="ml-auto size-3.5 opacity-60" />
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start"
              onClick={() => openIssue("question")}
            >
              <MessageCircleQuestion className="size-4" />
              Frage / Unklarheit
              <ExternalLink className="ml-auto size-3.5 opacity-60" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full justify-start text-muted-foreground"
              onClick={() =>
                window.open(
                  GITHUB_ISSUES_CHOOSE_URL,
                  "_blank",
                  "noopener,noreferrer"
                )
              }
            >
              Alle Vorlagen auf GitHub
              <ExternalLink className="ml-auto size-3.5 opacity-60" />
            </Button>
          </div>
        </div>

        <div className="space-y-2 border-t pt-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium">Umgebung für die Meldung</p>
            <Button type="button" size="sm" variant="secondary" onClick={() => void copyEnv()}>
              <Copy className="size-3.5" />
              Kopieren
            </Button>
          </div>
          <pre className="max-h-40 overflow-auto rounded-md border bg-muted/40 p-2 text-left text-[0.65rem] leading-relaxed whitespace-pre-wrap text-muted-foreground">
            {envText || "…"}
          </pre>
          {copyMsg && (
            <p className="text-xs text-emerald-700 dark:text-emerald-300">
              {copyMsg}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
