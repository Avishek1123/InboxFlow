import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: [
    "firebase-admin",
    "@prisma/client",
    "prisma",
    "@ngrok/ngrok",
    "localtunnel",
  ],
  // Required for Firebase Google signInWithPopup.
  // same-origin alone blocks window.closed; allow-popups is required.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "unsafe-none",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
