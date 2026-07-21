/**
 * Median und Quantile (lineare Interpolation, R type-7 / Excel PERCENTILE).
 */

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/** Quantil p ∈ [0, 1] */
export function quantile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  if (p <= 0) return Math.min(...values);
  if (p >= 1) return Math.max(...values);
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const t = idx - lo;
  return sorted[lo] * (1 - t) + sorted[hi] * t;
}
