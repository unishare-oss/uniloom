// Single component only, like agent-brand.tsx.
import GithubLogo from "@lobehub/icons/es/Github/components/Mono";

/** The GitHub mark in the avatar spot of a change GitHub made. */
export const GithubMark = ({ size = 28 }: { size?: number }) => (
  <span
    style={{ width: size, height: size }}
    className="inline-flex items-center justify-center rounded-full border bg-card text-foreground ring-4 ring-background"
  >
    <GithubLogo size={size * 0.6} aria-hidden />
  </span>
);
