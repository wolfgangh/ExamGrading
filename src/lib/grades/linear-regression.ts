/**
 * Einfache OLS-Regression y = a + b·x mit t-Test und zweiseitigem p-Wert für die Steigung.
 */

export type LinearRegressionResult = {
  n: number;
  /** Achsenabschnitt a */
  intercept: number;
  /** Steigung b (dy/dx) */
  slope: number;
  /** Bestimmtheitsmaß R² */
  rSquared: number;
  /** Pearson r */
  r: number;
  /** Standardfehler der Steigung */
  seSlope: number;
  /** t-Statistik der Steigung */
  tStat: number;
  /** Freiheitsgrade n−2 */
  df: number;
  /** zweiseitiger p-Wert der Steigung */
  pValue: number;
  /** Vorhersage ŷ = a + b·x */
  predict: (x: number) => number;
};

function incompleteBeta(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  // Lentz continued fraction for regularized incomplete beta
  const bt =
    Math.exp(
      lgamma(a + b) -
        lgamma(a) -
        lgamma(b) +
        a * Math.log(x) +
        b * Math.log(1 - x)
    );
  if (x < (a + 1) / (a + b + 2)) {
    return (bt * betaCf(a, b, x)) / a;
  }
  return 1 - (bt * betaCf(b, a, 1 - x)) / b;
}

function betaCf(a: number, b: number, x: number): number {
  const maxIt = 200;
  const eps = 3e-14;
  let am = 1;
  let bm = 1;
  let az = 1;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let bz = 1 - (qab * x) / qap;
  for (let m = 1; m <= maxIt; m++) {
    const em = m;
    const tem = em + em;
    let d = (em * (b - em) * x) / ((qam + tem) * (a + tem));
    const ap = az + d * am;
    const bp = bz + d * bm;
    d = (-(a + em) * (qab + em) * x) / ((a + tem) * (qap + tem));
    const app = ap + d * az;
    const bpp = bp + d * bz;
    const aold = az;
    am = ap / bpp;
    bm = bp / bpp;
    az = app / bpp;
    bz = 1;
    if (Math.abs(az - aold) < eps * Math.abs(az)) return az;
  }
  return az;
}

/** Stirling approximation for ln Γ(z), z > 0 */
function lgamma(z: number): number {
  if (z < 0.5) {
    // reflection
    return (
      Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z)
    );
  }
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.984369654078991e-6, 1.5056327351493116e-7,
  ];
  z -= 1;
  let x = c[0];
  for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
  const t = z + g + 0.5;
  return (
    0.5 * Math.log(2 * Math.PI) +
    (z + 0.5) * Math.log(t) -
    t +
    Math.log(x)
  );
}

/** zweiseitiger p-Wert der Student-t-Verteilung */
export function studentTPvalueTwoTailed(t: number, df: number): number {
  if (!Number.isFinite(t) || !Number.isFinite(df) || df <= 0) return 1;
  const x = df / (df + t * t);
  const a = df / 2;
  const b = 0.5;
  const ib = incompleteBeta(a, b, x);
  // survival: regularized incomplete beta relates to CDF
  return Math.min(1, Math.max(0, ib));
}

export function linearRegression(
  xs: number[],
  ys: number[]
): LinearRegressionResult | null {
  const n = Math.min(xs.length, ys.length);
  const pairs: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    if (Number.isFinite(xs[i]) && Number.isFinite(ys[i])) {
      pairs.push({ x: xs[i], y: ys[i] });
    }
  }
  const m = pairs.length;
  if (m < 3) return null;

  let sumX = 0;
  let sumY = 0;
  for (const p of pairs) {
    sumX += p.x;
    sumY += p.y;
  }
  const meanX = sumX / m;
  const meanY = sumY / m;

  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const p of pairs) {
    const dx = p.x - meanX;
    const dy = p.y - meanY;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }
  if (sxx < 1e-18) return null;

  const slope = sxy / sxx;
  const intercept = meanY - slope * meanX;
  const r = syy > 1e-18 ? sxy / Math.sqrt(sxx * syy) : 0;
  const rSquared = r * r;

  // residual SS
  let sse = 0;
  for (const p of pairs) {
    const e = p.y - (intercept + slope * p.x);
    sse += e * e;
  }
  const df = m - 2;
  const mse = df > 0 ? sse / df : 0;
  const seSlope = Math.sqrt(mse / sxx);
  const tStat = seSlope > 1e-18 ? slope / seSlope : 0;
  const pValue =
    df > 0 && seSlope > 1e-18
      ? studentTPvalueTwoTailed(Math.abs(tStat), df)
      : 1;

  return {
    n: m,
    intercept,
    slope,
    rSquared,
    r,
    seSlope,
    tStat,
    df,
    pValue,
    predict: (x: number) => intercept + slope * x,
  };
}

export function formatPValue(p: number): string {
  if (!Number.isFinite(p)) return "–";
  if (p < 0.001) return "< 0,001";
  return p.toFixed(3).replace(".", ",");
}
