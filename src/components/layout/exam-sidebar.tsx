"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  GitMerge,
  HardDrive,
  Layers,
  ListChecks,
  PenLine,
  Settings,
  Table2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  isOnlineStyleExam,
  isPortfolioExam,
  isStaCriteriaExam,
  isStaManualExam,
  type ExamProject,
  type ExamType,
} from "@/lib/types";
import { useExamContext } from "@/components/exam/exam-context";
import {
  buildWorkflowSteps,
  workflowProgress,
  type WorkflowStep,
} from "@/lib/workflow-steps";
import { Button, buttonVariants } from "@/components/ui/button";
import { examUsesGradeScenarios } from "@/lib/grades/scenarios";

const SIDEBAR_COLLAPSED_KEY = "examgrade-sidebar-collapsed";

type NavItem = {
  href: string;
  label: string;
  icon: typeof BarChart3;
  /** weitere Routen, die zu diesem Eintrag gehören (z. B. Punkte-Reiter) */
  also?: string[];
};

type NavGroup = { label: string | null; items: NavItem[] };

/** Gegliederte Navigation: Vorbereitung · Bewertung · Noten · Abschluss · Einstellungen */
function buildNavGroups(
  examType?: ExamType,
  project?: ExamProject | null
): NavGroup[] {
  const prep: NavItem[] = [
    { href: "overview", label: "Übersicht", icon: BarChart3 },
    { href: "import", label: "Import", icon: FileSpreadsheet },
  ];
  if (examType && isOnlineStyleExam(examType)) {
    prep.push({ href: "matching", label: "Zuordnung", icon: GitMerge });
  }

  const assess: NavItem[] = [];
  if (examType && isStaCriteriaExam(examType)) {
    assess.push({ href: "assessment", label: "Kriterien", icon: ClipboardList });
  } else if (examType && isPortfolioExam(examType)) {
    assess.push({ href: "assessment", label: "Teilnoten", icon: ClipboardList });
  } else if (!(examType && isStaManualExam(examType))) {
    assess.push({ href: "points", label: "Punkte", icon: PenLine, also: ["detail-points"] });
  }

  const grades: NavItem[] = [
    { href: "grades", label: "Notenübersicht", icon: Table2 },
  ];
  const showScenarios = project
    ? examUsesGradeScenarios(project)
    : Boolean(examType && !isStaManualExam(examType) && !isPortfolioExam(examType));
  if (showScenarios) {
    grades.push({ href: "scenarios", label: "Notenszenarien", icon: Layers });
  }

  return [
    { label: "Vorbereitung", items: prep },
    ...(assess.length ? [{ label: "Bewertung", items: assess }] : []),
    { label: "Noten", items: grades },
    {
      label: "Abschluss",
      items: [
        { href: "documents", label: "Dokumente", icon: FileText },
        { href: "export", label: "Sicherung", icon: HardDrive },
      ],
    },
    { label: null, items: [{ href: "settings", label: "Einstellungen", icon: Settings }] },
  ];
}

/** Status je Navigationseintrag aus den Workflow-Schritten */
function navStatus(
  item: NavItem,
  base: string,
  steps: WorkflowStep[]
): "done" | "open" | null {
  const paths = [item.href, ...(item.also ?? [])].map((h) => `${base}/${h}`);
  const related = steps.filter((st) => {
    const path = st.href.split(/[?#]/)[0];
    return paths.includes(path);
  });
  if (related.length === 0) return null;
  return related.every((st) => st.done) ? "done" : "open";
}

export function ExamSidebar({
  examId,
  examType,
  mobileOpen = false,
  onMobileOpenChange,
}: {
  examId: string;
  examType?: ExamType;
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const base = `/exam/${examId}`;
  const { project, rows, stats } = useExamContext();
  const groups = buildNavGroups(examType ?? project?.examType, project);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      if (v === "1") setCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    onMobileOpenChange?.(false);
    // Nur bei Seitenwechsel schließen – Setter-Identität ignorieren
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onMobileOpenChange?.(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen, onMobileOpenChange]);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const steps =
    project && stats
      ? buildWorkflowSteps(project, rows, stats, examId)
      : [];
  const progress = steps.length > 0 ? workflowProgress(steps) : null;
  const compact = collapsed && !mobileOpen;

  const navBody = (
    <>
      <div className="flex shrink-0 items-center gap-1 border-b p-2">
        {!compact && (
          <Link
            href="/"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "min-w-0 flex-1 justify-start gap-2"
            )}
            title="Zur Übersicht aller Prüfungen"
          >
            <ArrowLeft className="size-4 shrink-0" />
            Zurück
          </Link>
        )}
        {mobileOpen && (
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            className="md:hidden"
            onClick={() => onMobileOpenChange?.(false)}
            aria-label="Navigation schließen"
            title="Schließen"
          >
            <X className="size-4" />
          </Button>
        )}
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          className={cn("hidden md:inline-flex", compact && "mx-auto")}
          onClick={toggleCollapsed}
          title={compact ? "Navigation einblenden" : "Navigation ausblenden"}
          aria-expanded={!compact}
          aria-label={
            compact ? "Navigation einblenden" : "Navigation ausblenden"
          }
        >
          {compact ? (
            <ChevronRight className="size-4" />
          ) : (
            <ChevronLeft className="size-4" />
          )}
        </Button>
      </div>
      {!compact && (
        <div className="shrink-0 border-b px-3 py-2">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <ClipboardList className="size-3.5" />
            Prüfung
          </p>
        </div>
      )}
      <nav className="min-h-0 flex-1 overflow-y-auto p-2">
        {groups.map((g, gi) => (
          <div
            key={g.label ?? `g${gi}`}
            className={cn(gi > 0 && "mt-3", g.label === null && "border-t pt-3")}
          >
            {g.label && !compact && (
              <p className="px-2.5 pb-1 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
                {g.label}
              </p>
            )}
            <div className="space-y-0.5">
              {g.items.map((item) => {
                const { href, label, icon: Icon } = item;
                const paths = [href, ...(item.also ?? [])].map((h) => `${base}/${h}`);
                const active = paths.some(
                  (p) => pathname === p || pathname.startsWith(p + "/")
                );
                const status = navStatus(item, base, steps);
                return (
                  <Link
                    key={href}
                    href={`${base}/${href}`}
                    title={
                      status === "done"
                        ? `${label} – erledigt`
                        : status === "open"
                          ? `${label} – offen`
                          : label
                    }
                    className={cn(
                      "relative flex items-center gap-2 rounded-lg text-sm transition-colors",
                      compact ? "justify-center px-2 py-2.5" : "px-2.5 py-2",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground hover:bg-muted"
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    {!compact && <span className="min-w-0 flex-1 truncate">{label}</span>}
                    {status && (
                      <span
                        aria-hidden
                        className={cn(
                          compact ? "absolute right-1 top-1 size-2 rounded-full" : "text-xs",
                          status === "done" &&
                            (compact ? "bg-emerald-500" : active ? "text-primary-foreground" : "text-emerald-600 dark:text-emerald-400"),
                          status === "open" &&
                            (compact ? "bg-amber-500" : active ? "text-primary-foreground" : "text-amber-600 dark:text-amber-400")
                        )}
                      >
                        {compact ? null : status === "done" ? "✓" : "●"}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {progress && !compact && (
        <div className="shrink-0 border-t bg-card/80 p-3 backdrop-blur-sm">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <ListChecks className="size-3.5" />
            Workflow
          </div>
          <p className="text-xs tabular-nums text-foreground">
            {progress.doneCount}/{progress.totalCount} erledigt
          </p>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                progress.doneCount === progress.totalCount
                  ? "bg-emerald-600"
                  : "bg-primary"
              )}
              style={{ width: `${progress.progressPct}%` }}
            />
          </div>
          {progress.nextOpen ? (
            <Link
              href={progress.nextOpen.href}
              className="mt-2 block text-xs leading-snug text-muted-foreground hover:text-foreground"
            >
              Als Nächstes:{" "}
              <span className="font-medium text-foreground">
                {progress.nextOpen.label}
              </span>
              {progress.nextOpen.critical ? (
                <span className="text-amber-700 dark:text-amber-300">
                  {" "}
                  · erforderlich
                </span>
              ) : null}
            </Link>
          ) : (
            <p className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              Workflow abgeschlossen
            </p>
          )}
          <Link
            href={`${base}/overview`}
            className="mt-2 inline-block text-xs font-medium text-primary underline-offset-2 hover:underline"
          >
            Details in Übersicht
          </Link>
        </div>
      )}
    </>
  );

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-50 bg-black/40 md:hidden"
          aria-label="Navigation schließen"
          onClick={() => onMobileOpenChange?.(false)}
        />
      )}
      <aside
        className={cn(
          "surface-panel flex min-h-0 shrink-0 flex-col overflow-hidden border-r transition-[width] duration-200",
          "fixed inset-y-0 left-0 z-50 h-full w-56 md:static md:z-auto md:h-full",
          collapsed ? "md:w-14" : "md:w-56",
          mobileOpen ? "flex" : "hidden md:flex"
        )}
        aria-label="Prüfungsnavigation"
      >
        {navBody}
      </aside>
    </>
  );
}
