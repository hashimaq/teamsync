import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Workspaces hoist `next` to D:\TeamSync\node_modules — point Turbopack there
  turbopack: {
    root: path.join(__dirname, ".."),
  },
  experimental: {
    // Keep recently visited dashboard pages in the client router cache
    // so Dashboard ↔ Workspaces switches feel instant (no full refetch flash).
    staleTimes: {
      dynamic: 60,
      static: 300,
    },
  },
};

export default nextConfig;
