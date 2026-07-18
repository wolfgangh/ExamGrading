import type { NextConfig } from "next";

/**
 * P0: Kein hardcodiertes App-Passwort. Production-Build und Vercel-Deploy
 * erfordern NEXT_PUBLIC_APP_PASSWORD (Dashboard oder .env.local).
 */
const appPassword = process.env.NEXT_PUBLIC_APP_PASSWORD?.trim();
const requireAppPassword =
  process.env.NODE_ENV === "production" || process.env.VERCEL === "1";

if (requireAppPassword && !appPassword) {
  throw new Error(
    [
      "NEXT_PUBLIC_APP_PASSWORD fehlt oder ist leer.",
      "Vercel: Project → Settings → Environment Variables → Variable setzen,",
      "Environments Production/Preview wählen, dann Redeploy.",
      "Lokal: .env.local anlegen (Vorlage: .env.example), dann erneut bauen.",
    ].join(" ")
  );
}

/**
 * Security-Headers (Defense-in-Depth).
 * Kein X-Frame-Options / frame-ancestors: MS-Teams Website-Tab läuft im iframe.
 * script/style unsafe-inline: Theme-FOUC-Script + Next/Tailwind-typisch.
 * blob: für Downloads und ggf. Worker (exceljs/jspdf).
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
];

const nextConfig: NextConfig = {
  // Kein output: "export" – dynamische /exam/[id]-Routen brauchen Serverless.
  // Production-Build: "next build" (ohne --turbopack), siehe package.json.
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "@base-ui/react",
      "date-fns",
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
