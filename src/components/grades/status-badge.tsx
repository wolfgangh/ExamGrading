"use client";

import { Badge } from "@/components/ui/badge";
import { STUDENT_STATUS_LABELS, type StudentStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STYLES: Record<StudentStatus, string> = {
  registered: "bg-muted text-muted-foreground border-transparent",
  attended: "bg-amber-100 text-amber-900 border-transparent dark:bg-amber-950 dark:text-amber-100",
  points: "bg-sky-100 text-sky-900 border-transparent dark:bg-sky-950 dark:text-sky-100",
  graded: "bg-blue-100 text-blue-900 border-transparent dark:bg-blue-950 dark:text-blue-100",
  export_ready:
    "bg-emerald-100 text-emerald-900 border-transparent dark:bg-emerald-950 dark:text-emerald-100",
  no_show:
    "bg-orange-100 text-orange-900 border-transparent dark:bg-orange-950 dark:text-orange-100",
  mismatch:
    "bg-red-100 text-red-900 border-transparent dark:bg-red-950 dark:text-red-100",
};

export function StatusBadge({ status }: { status: StudentStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", STYLES[status])}
    >
      {STUDENT_STATUS_LABELS[status]}
    </Badge>
  );
}
