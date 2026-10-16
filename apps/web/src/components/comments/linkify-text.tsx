import type { ReactNode } from "react";

const URL_PATTERN = /(https?:\/\/[^\s<]+[^\s<.,;:!?)"'\]])/g;

/** Plain text with each http(s) URL turned into a link. */
export const linkifyText = (text: string): ReactNode[] => {
  return text.split(URL_PATTERN).map((part, i) =>
    // split() with one capture group puts the URLs at the odd places.
    i % 2 === 1 ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline-offset-2 hover:underline"
      >
        {part}
      </a>
    ) : (
      part
    ),
  );
};
