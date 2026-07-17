"use client";

import { useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Copy,
  FileJson,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { useExams } from "@/hooks/use-exams";
import { NewExamDialog } from "@/components/exams/new-exam-dialog";
import { AppHeader } from "@/components/layout/app-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EXAM_TYPE_LABELS } from "@/lib/types";
import {
  datedExportFilename,
  downloadJson,
} from "@/lib/utils";
import {
  exportExamJson,
  parseExamJson,
  saveExam,
} from "@/lib/storage";
import { createId } from "@/lib/id";

export function ExamList() {
  const { exams, loading, error, refresh, remove, duplicate } = useExams();
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const importJson = async (file: File) => {
    const text = await file.text();
    const project = parseExamJson(text);
    project.id = createId("exam");
    project.createdAt = new Date().toISOString();
    project.updatedAt = project.createdAt;
    await saveExam(project);
    await refresh();
    router.push(`/exam/${project.id}/overview`);
  };

  return (
    <div className="page-shell">
      <AppHeader
        actions={
          <>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importJson(f);
                e.target.value = "";
              }}
            />
            <Button
              variant="outline"
              onClick={() => fileRef.current?.click()}
            >
              <FileJson className="size-4" />
              JSON importieren
            </Button>
            <NewExamDialog onCreated={() => void refresh()} />
          </>
        }
      />

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Prüfungen</h1>
          <p className="mt-1 text-muted-foreground">
            Notenvergabe und HIS/QIS-Export – ersetzt den Excel-Workflow.
          </p>
        </div>

        {loading && (
          <p className="text-muted-foreground">Lade Prüfungen…</p>
        )}
        {error && <p className="text-destructive">{error}</p>}

        {!loading && exams.length === 0 && (
          <Card className="surface-panel border-dashed">
            <CardHeader>
              <CardTitle>Noch keine Prüfung</CardTitle>
              <CardDescription>
                Legen Sie eine neue Prüfung an oder importieren Sie ein
                JSON-Backup.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <NewExamDialog onCreated={() => void refresh()} />
            </CardContent>
          </Card>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {exams.map((exam) => (
            <Card key={exam.id} className="surface-panel transition-shadow hover:shadow-md">
              <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
                <div className="min-w-0">
                  <CardTitle className="truncate text-lg">
                    <Link
                      href={`/exam/${exam.id}/overview`}
                      className="hover:underline"
                    >
                      {exam.name}
                    </Link>
                  </CardTitle>
                  <CardDescription className="mt-1 space-y-0.5">
                    <span className="block">
                      {exam.examNumber || "ohne Nummer"}
                      {exam.semester ? ` · ${exam.semester}` : ""}
                    </span>
                    <span className="block">
                      {EXAM_TYPE_LABELS[exam.examType]} ·{" "}
                      {exam.hisRows.length} HIS · {exam.attendance.length}{" "}
                      Antritte · {exam.points.length} Punkte
                    </span>
                  </CardDescription>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button variant="ghost" size="icon-sm">
                        <MoreHorizontal />
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        downloadJson(
                          datedExportFilename(exam.name, "json"),
                          exportExamJson(exam)
                        );
                      }}
                    >
                      <FileJson className="size-4" />
                      JSON exportieren
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => void duplicate(exam, false)}
                    >
                      <Copy className="size-4" />
                      Duplizieren
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => void duplicate(exam, true)}
                    >
                      <Copy className="size-4" />
                      Für Folgesemester (ohne Daten)
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => {
                        if (
                          confirm(
                            `Prüfung „${exam.name}“ wirklich löschen?`
                          )
                        ) {
                          void remove(exam.id);
                        }
                      }}
                    >
                      <Trash2 className="size-4" />
                      Löschen
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    Geändert{" "}
                    {new Date(exam.updatedAt).toLocaleString("de-DE")}
                  </span>
                  <Link
                    href={`/exam/${exam.id}/overview`}
                    className="inline-flex h-7 items-center rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted"
                  >
                    Öffnen
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
