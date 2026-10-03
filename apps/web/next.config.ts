import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Locally the app is opened at 127.0.0.1 (uniAuth only redirects local clients to a
  // loopback IP), which next dev otherwise treats as a foreign origin. Dev only.
  allowedDevOrigins: ["127.0.0.1"],
  // The API behind the web origin: the session cookie will stay on this host.
  async rewrites() {
    const apiUrl = process.env.API_URL ?? "http://localhost:3011";
    return [{ source: "/api/:path*", destination: `${apiUrl}/api/:path*` }];
  },
};

export default nextConfig;
