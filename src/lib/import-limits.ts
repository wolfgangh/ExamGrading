/** Max. Größe einer JSON-Projektsicherung (inkl. Base64-HIS-Vorlagen). */
export const MAX_PROJECT_ARCHIVE_BYTES = 50 * 1024 * 1024;

/** Max. Größe einer Excel-Importdatei (HIS / Antritt / Punkte). */
export const MAX_EXCEL_IMPORT_BYTES = 15 * 1024 * 1024;

export function formatByteLimit(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return Number.isInteger(mb) ? `${mb} MB` : `${mb.toFixed(1)} MB`;
}

export function assertFileSizeLimit(
  file: Pick<File, "size" | "name">,
  maxBytes: number,
  kindLabel: string
): void {
  if (file.size > maxBytes) {
    throw new Error(
      `${kindLabel} „${file.name}“ ist zu groß (${formatByteLimit(file.size)}, Maximum ${formatByteLimit(maxBytes)}).`
    );
  }
}

/** UTF-8-Bytelänge eines Strings (Browser + Node). */
export function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

export function assertJsonSizeLimit(json: string, maxBytes: number): void {
  const size = utf8ByteLength(json);
  if (size > maxBytes) {
    throw new Error(
      `JSON-Sicherung ist zu groß (${formatByteLimit(size)}, Maximum ${formatByteLimit(maxBytes)}).`
    );
  }
}
