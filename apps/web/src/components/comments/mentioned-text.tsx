import { Fragment } from "react";
import { linkifyText } from "@/components/comments/linkify-text";
import { splitMentions } from "@/lib/mentions";

/** A comment's text: each mentioned "@Name" in bold, the rest with its links. */
export const MentionedText = ({
  body,
  mentions,
}: {
  body: string;
  mentions: { id: string; name: string }[];
}) => {
  return splitMentions(
    body,
    mentions.map((mention) => mention.name),
  ).map((part, index) =>
    part.mention ? (
      <span key={index} className="font-semibold text-accent-foreground">
        {part.text}
      </span>
    ) : (
      <Fragment key={index}>{linkifyText(part.text)}</Fragment>
    ),
  );
};
