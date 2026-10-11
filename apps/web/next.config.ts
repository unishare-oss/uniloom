import type { NextConfig } from "next";
import { AVATAR_HOSTS } from "./src/lib/avatar-hosts";

const nextConfig: NextConfig = {
  // Locally the app is opened at 127.0.0.1 (uniAuth only redirects local clients to a
  // loopback IP), which next dev otherwise treats as a foreign origin. Dev only.
  allowedDevOrigins: ["127.0.0.1"],
  // uniAuth avatars (see src/lib/avatar-hosts.ts).
  images: { remotePatterns: AVATAR_HOSTS.map((host) => ({ ...host })) },
  // The API, Better Auth included, behind the web origin: the session cookie stays on this host.
  async rewrites() {
    const apiUrl = process.env.API_URL ?? "http://localhost:3011";
    return [
      { source: "/api/:path*", destination: `${apiUrl}/api/:path*` },
      // The MCP server and how agents find uniAuth (plan 33): the resource is <web>/mcp.
      { source: "/mcp", destination: `${apiUrl}/mcp` },
      {
        source: "/.well-known/oauth-protected-resource",
        destination: `${apiUrl}/.well-known/oauth-protected-resource`,
      },
      {
        source: "/.well-known/oauth-protected-resource/:path*",
        destination: `${apiUrl}/.well-known/oauth-protected-resource/:path*`,
      },
    ];
  },
};

export default nextConfig;
