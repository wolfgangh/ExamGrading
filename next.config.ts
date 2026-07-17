import type { NextConfig } from "next";

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
};

export default nextConfig;
