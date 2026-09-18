import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The repo-level CLAUDE.md is the single source of conventions; do not generate another.
  agentRules: false,
};

export default nextConfig;
