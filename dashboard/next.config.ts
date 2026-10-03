import type { NextConfig } from "next";

function extraDevOrigins(): string[] {
  const origins = new Set(["127.0.0.1", "localhost"]);
  for (const value of [
    process.env.NEXT_PUBLIC_DASHBOARD_URL,
    process.env.DASHBOARD_PUBLIC_URL,
    process.env.NEXT_PUBLIC_CLASSIFIER_URL
  ]) {
    if (!value) continue;
    try {
      origins.add(new URL(value).hostname);
    } catch {
      // ignore invalid URLs
    }
  }
  return [...origins];
}

const nextConfig: NextConfig = {
  allowedDevOrigins: extraDevOrigins(),
  serverExternalPackages: ["better-sqlite3"],
  experimental: {
    serverActions: {
      bodySizeLimit: "64mb"
    }
  }
};

export default nextConfig;
