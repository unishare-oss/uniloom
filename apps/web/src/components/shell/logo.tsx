/** Uniloom's mark: threads woven on a loom. */
export const LogoMark = ({ className }: { className?: string }) => {
  return (
    <svg
      viewBox="0 0 22 22"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden
      className={className}
    >
      <path d="M5 2v18M11 2v18M17 2v18M2 7h6M14 7h6M2 15h6M14 15h6M8 11h6" />
    </svg>
  );
};
