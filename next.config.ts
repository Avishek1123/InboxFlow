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
  // Required for Firebase Google signInWithPopup — strict COOP blocks window.closed polling.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
