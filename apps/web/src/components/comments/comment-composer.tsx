"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/** The box for a new top-level comment. */
export const CommentComposer = ({
  isPending,
  onSubmit,
}: {
  isPending: boolean;
  /** Resolves true when it was posted, which clears the box. */
  onSubmit: (body: string) => Promise<boolean>;
}) => {
  const [text, setText] = useState("");
  const canPost = text.trim() !== "" && !isPending;

  const post = async () => {
    if (await onSubmit(text)) setText("");
  };

  return (
    <div>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.shiftKey) {
            e.preventDefault();
            if (canPost) void post();
          }
        }}
        placeholder="Write a comment..."
        rows={3}
        className="resize-none"
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground select-none">
          <kbd className="font-mono">Shift</kbd> +{" "}
          <kbd className="font-mono">Enter</kbd> to submit
        </span>
        <Button onClick={() => void post()} disabled={!canPost}>
          {isPending ? "Posting..." : "Post"}
        </Button>
      </div>
    </div>
  );
};
