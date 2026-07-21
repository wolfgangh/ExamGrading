/**
 * Parst Moodle-/Excel-Bearbeitungsdauer in Minuten.
 * Unterstützt: Excel-Zeit (Bruchteil eines Tages), „1 Stunde 5 Minuten“,
 * „65 Minuten“, „01:05:00“, „1:05“, reine Zahlen (Minuten).
 */
export function parseProcessingDurationMinutes(
  value: unknown
): number | null {
  if (value == null || value === "") return null;

  if (typeof value === "number" && Number.isFinite(value)) {
    // Excel Zeit: 0 < x < 2 (Bruchteil eines Tages)
    if (value > 0 && value < 2) {
      return Math.round(value * 24 * 60 * 10) / 10;
    }
    // Sonst: bereits Minuten (oder Sekunden wenn sehr groß?)
    if (value > 24 * 60 * 3) {
      // > 3 Tage in Minuten → eher Sekunden
      return Math.round((value / 60) * 10) / 10;
    }
    return Math.round(value * 10) / 10;
  }

  // Excel Date object
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const h = value.getUTCHours();
    const m = value.getUTCMinutes();
    const s = value.getUTCSeconds();
    // Oft als 1899-12-30 + Zeit gespeichert
    return Math.round((h * 60 + m + s / 60) * 10) / 10;
  }

  const raw = String(value)
    .trim()
    .replace(/[\u00a0\u202f]/g, " ")
    .replace(/\s+/g, " ");
  if (!raw) return null;

  // hh:mm:ss oder h:mm
  const clock = raw.match(/^(\d{1,3}):(\d{1,2})(?::(\d{1,2}))?$/);
  if (clock) {
    const a = Number(clock[1]);
    const b = Number(clock[2]);
    const c = clock[3] != null ? Number(clock[3]) : 0;
    if (clock[3] != null) {
      // h:m:s
      return Math.round((a * 60 + b + c / 60) * 10) / 10;
    }
    // a:b → wenn a >= 24 eher min:sec, sonst h:m
    if (a >= 24) {
      return Math.round((a + b / 60) * 10) / 10;
    }
    return Math.round((a * 60 + b) * 10) / 10;
  }

  const lower = raw.toLowerCase();
  let minutes = 0;
  let matched = false;

  const hours =
    lower.match(/(\d+(?:[.,]\d+)?)\s*(?:stunden?|std\.?|h\b)/i) ??
    lower.match(/(\d+(?:[.,]\d+)?)\s*hours?/i);
  if (hours) {
    minutes += Number(hours[1].replace(",", ".")) * 60;
    matched = true;
  }

  const mins =
    lower.match(/(\d+(?:[.,]\d+)?)\s*(?:minuten?|min\.?)/i) ??
    lower.match(/(\d+(?:[.,]\d+)?)\s*minutes?/i);
  if (mins) {
    minutes += Number(mins[1].replace(",", "."));
    matched = true;
  }

  const secs =
    lower.match(/(\d+(?:[.,]\d+)?)\s*(?:sekunden?|sek\.?|s\b)/i) ??
    lower.match(/(\d+(?:[.,]\d+)?)\s*seconds?/i);
  if (secs) {
    minutes += Number(secs[1].replace(",", ".")) / 60;
    matched = true;
  }

  if (matched) return Math.round(minutes * 10) / 10;

  // reine Zahl als Text
  const pure = lower.replace(",", ".").replace(/[^\d.\-]/g, "");
  if (pure && /^-?\d+(\.\d+)?$/.test(pure)) {
    const n = Number(pure);
    if (!Number.isFinite(n)) return null;
    if (n > 24 * 60 * 3) return Math.round((n / 60) * 10) / 10;
    return Math.round(n * 10) / 10;
  }

  return null;
}

/** Anzeige z. B. „1 h 05 min“ oder „42 min“ */
export function formatDurationMinutes(
  minutes: number | null | undefined
): string {
  if (minutes == null || !Number.isFinite(minutes)) return "–";
  const m = Math.max(0, minutes);
  const h = Math.floor(m / 60);
  const min = Math.round(m - h * 60);
  if (h <= 0) return `${min} min`;
  return `${h} h ${String(min).padStart(2, "0")} min`;
}
