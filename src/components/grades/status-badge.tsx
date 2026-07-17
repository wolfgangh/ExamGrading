"use client";

import { Badge } from "@/components/ui/badge";
import { STUDENT_STATUS_LABELS, type StudentStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STYLES: Record<StudentStatus, string> = {
  registered: "bg-muted text-muted-foreground border-transparent",
  attended:
    "bg-amber-100 text-amber-950 border-transparent dark:bg-amber-800/70 dark:text-amber-50",
  points:
    "bg-sky-100 text-sky-950 border-transparent dark:bg-sky-800/70 dark:text-sky-50",
  graded:
    "bg-blue-100 text-blue-950 border-transparent dark:bg-blue-800/70 dark:text-blue-50",
  export_ready:
    "bg-emerald-100 text-emerald-950 border-transparent dark:bg-emerald-800/70 dark:text-emerald-50",
  no_show:
    "bg-orange-100 text-orange-950 border-transparent dark:bg-orange-800/80 dark:text-orange-50",
  mismatch:
    "bg-red-100 text-red-950 border-transparent dark:bg-red-800/80 dark:text-red-50",
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
