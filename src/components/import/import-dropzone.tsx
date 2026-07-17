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
  onFiles,
  multiple = false,
  disabled,
}: {
  label: string;
  description: string;
  accept?: string;
  onFile?: (file: File) => void | Promise<void>;
  /** Mehrere Dateien (z. B. MEB + MBW HIS) */
  onFiles?: (files: File[]) => void | Promise<void>;
  multiple?: boolean;
  disabled?: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleMany = useCallback(
    async (fileList: FileList | File[] | null | undefined) => {
      if (!fileList || disabled) return;
      const files = Array.from(fileList);
      if (files.length === 0) return;
      setBusy(true);
      try {
        if (onFiles) {
          await onFiles(files);
        } else if (onFile) {
          for (const f of files) {
            await onFile(f);
          }
        }
      } finally {
        setBusy(false);
      }
    },
    [onFile, onFiles, disabled]
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
        void handleMany(e.dataTransfer.files);
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
          multiple={multiple}
          className="hidden"
          disabled={disabled || busy}
          onChange={(e) => {
            void handleMany(e.target.files);
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
          {busy
            ? "Wird gelesen…"
            : multiple
              ? "Datei(en) wählen"
              : "Datei wählen"}
        </Button>
      </label>
    </div>
  );
}
