/**
 * Where uniAuth avatars come from: photos uploaded to uniAuth, and pictures from accounts
 * people link there (Google). Used by next.config.ts (images.remotePatterns) and Avatar.
 */
export const AVATAR_HOSTS = [
  {
    protocol: "https",
    hostname: "auth.psstee.dev",
    port: "",
    pathname: "/api/avatars/**",
  },
  // A local uniAuth.
  {
    protocol: "http",
    hostname: "localhost",
    port: "3002",
    pathname: "/api/avatars/**",
  },
  {
    protocol: "https",
    hostname: "*.googleusercontent.com",
    port: "",
    pathname: "/**",
  },
] as const;

/** Whether next/image may load this avatar. Any other host shows initials instead. */
export function isAllowedAvatar(src: string) {
  let url: URL;
  try {
    url = new URL(src);
  } catch {
    return false;
  }
  return AVATAR_HOSTS.some(
    ({ protocol, hostname, port, pathname }) =>
      url.protocol === `${protocol}:` &&
      (hostname.startsWith("*.")
        ? url.hostname.endsWith(hostname.slice(1))
        : url.hostname === hostname) &&
      url.port === port &&
      url.pathname.startsWith(pathname.replace(/\*\*$/, "")),
  );
}

/** Next 16 won't optimize images from local addresses, so a local uniAuth's load directly. */
export function isLocalAvatar(src: string) {
  return new URL(src).hostname === "localhost";
}
