"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MentionTextarea } from "@/components/comments/mention-textarea";
import { Textarea } from "@/components/ui/textarea";
import { mentionIdsIn } from "@/lib/mentions";

/** The box for a new top-level comment. A ticket's `projectId` turns on @mentions. */
export const CommentComposer = ({
  projectId,
  isPending,
  onSubmit,
}: {
  projectId?: string;
  isPending: boolean;
  /** Resolves true when it was posted, which clears the box. */
  onSubmit: (body: string, mentions: string[]) => Promise<boolean>;
}) => {
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<{ id: string; name: string }[]>([]);
  const canPost = text.trim() !== "" && !isPending;

  const post = async () => {
    if (await onSubmit(text, mentionIdsIn(text, picked))) {
      setText("");
      setPicked([]);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      if (canPost) void post();
    }
  };

  return (
    <div>
      {projectId ? (
        <MentionTextarea
          projectId={projectId}
          value={text}
          onValueChange={setText}
          onMention={(person) => setPicked((now) => [...now, person])}
          onKeyDown={onKeyDown}
          placeholder="Write a comment... Type @ to mention someone"
          rows={3}
          className="resize-none"
        />
      ) : (
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Write a comment..."
          rows={3}
          className="resize-none"
        />
      )}
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
