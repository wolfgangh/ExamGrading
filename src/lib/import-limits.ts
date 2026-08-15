/** Max. Größe einer JSON-Projektsicherung (inkl. Base64-HIS-Vorlagen). */
export const MAX_PROJECT_ARCHIVE_BYTES = 50 * 1024 * 1024;

/** Max. Größe einer Semester-/Sammel-ZIP mit mehreren JSON-Sicherungen. */
export const MAX_SEMESTER_ZIP_BYTES = 150 * 1024 * 1024;

/** Max. Größe einer Excel-Importdatei (HIS / Antritt / Punkte). */
export const MAX_EXCEL_IMPORT_BYTES = 15 * 1024 * 1024;

/** Max. JSON-Dateien in einer Semester-ZIP. */
export const MAX_ZIP_JSON_ENTRIES = 50;

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

/** Unkomprimierte Größe eines JSZip-Eintrags, falls bekannt. */
export function zipEntryUncompressedBytes(entry: {
  uncompressedSize?: number;
  _data?: { uncompressedSize?: number };
}): number | null {
  if (typeof entry.uncompressedSize === "number") return entry.uncompressedSize;
  if (typeof entry._data?.uncompressedSize === "number") {
    return entry._data.uncompressedSize;
  }
  return null;
}

export function assertZipJsonEntries(
  entries: { name: string }[],
  fileName: string
): void {
  if (entries.length > MAX_ZIP_JSON_ENTRIES) {
    throw new Error(
      `ZIP „${fileName}“ enthält ${entries.length} JSON-Dateien (Maximum ${MAX_ZIP_JSON_ENTRIES}).`
    );
  }
}

export function assertZipEntryUncompressed(
  entry: {
    name: string;
    uncompressedSize?: number;
    _data?: { uncompressedSize?: number };
  },
  fileLabel: string
): void {
  const unc = zipEntryUncompressedBytes(entry);
  if (unc != null && unc > MAX_PROJECT_ARCHIVE_BYTES) {
    throw new Error(
      `ZIP-Eintrag „${fileLabel}“ ist unkomprimiert zu groß (${formatByteLimit(unc)}, Maximum ${formatByteLimit(MAX_PROJECT_ARCHIVE_BYTES)}).`
    );
  }
}

export function assertJsonSizeLimit(json: string, maxBytes: number): void {
  const size = utf8ByteLength(json);
  if (size > maxBytes) {
    throw new Error(
      `JSON-Sicherung ist zu groß (${formatByteLimit(size)}, Maximum ${formatByteLimit(maxBytes)}).`
    );
  }
}
