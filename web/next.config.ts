import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The repo-level CLAUDE.md is the single source of conventions; do not generate another.
  agentRules: false,
  // Contract addresses live in ../deployments/10143.json (the only source, CLAUDE.md); let the
  // bundler resolve files from the repo root so web imports that file instead of a copy.
  turbopack: { root: path.join(__dirname, "..") },
  outputFileTracingRoot: path.join(__dirname, ".."),
};

export default nextConfig;
