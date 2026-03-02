import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Note: static export disabled on this branch because API routes
  // are needed for the STT evaluation test harness.
  // Re-enable `output: "export"` after evaluation is complete.
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
