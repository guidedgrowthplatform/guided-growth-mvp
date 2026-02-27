import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  // Capacitor uses the 'out' directory as webDir
  images: {
    unoptimized: true, // Required for static export
  },
};

export default nextConfig;
