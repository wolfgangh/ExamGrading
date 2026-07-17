"use client";

import { useCallback, useState } from "react";
import { FileSpreadsheet, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function ImportDropzone({
  label,
  description,
  accept = ".xlsx,.xls,.csv",
  onFile,
  disabled,
}: {
  label: string;
  description: string;
  accept?: string;
  onFile: (file: File) => void | Promise<void>;
  disabled?: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);

  const handle = useCallback(
    async (file: File | undefined) => {
      if (!file || disabled) return;
      setBusy(true);
      try {
        await onFile(file);
      } finally {
        setBusy(false);
      }
    },
    [onFile, disabled]
  );

  return (
    <div
      className={cn(
        "surface-panel flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors",
        dragging
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/40",
        (disabled || busy) && "opacity-60"
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        void handle(e.dataTransfer.files?.[0]);
      }}
    >
      <FileSpreadsheet className="mb-2 size-8 text-primary" />
      <p className="font-medium">{label}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {description}
      </p>
      <label className="mt-4">
        <input
          type="file"
          accept={accept}
          className="hidden"
          disabled={disabled || busy}
          onChange={(e) => {
            void handle(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={disabled || busy}
          onClick={(e) => {
            const input = (e.currentTarget.parentElement as HTMLLabelElement)
              ?.querySelector("input");
            input?.click();
          }}
        >
          <Upload className="size-4" />
          {busy ? "Wird gelesen…" : "Datei wählen"}
        </Button>
      </label>
    </div>
  );
}
