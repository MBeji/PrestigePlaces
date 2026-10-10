import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Base SQLite de démonstration construite par scripts/vercel-build.mjs quand aucun PostgreSQL n'est configuré.
  outputFileTracingIncludes: { "/**": ["./prisma/demo.db"] },
};

export default nextConfig;
