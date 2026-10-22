"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MentionTextarea } from "@/components/comments/mention-textarea";
import { Textarea } from "@/components/ui/textarea";
import { mentionIdsIn } from "@/lib/mentions";

/**
 * The inline editor for editing a comment or writing a reply. A ticket's `projectId` turns on
 * @mentions; `initialMentions` are the people the edited comment already mentions.
 */
export const CommentEditor = ({
  projectId,
  initialValue = "",
  initialMentions = [],
  placeholder,
  submitLabel,
  pendingLabel,
  isPending,
  onSubmit,
  onCancel,
}: {
  projectId?: string;
  initialValue?: string;
  initialMentions?: { id: string; name: string }[];
  placeholder?: string;
  submitLabel: string;
  pendingLabel: string;
  isPending: boolean;
  /** Resolves true when it was saved. */
  onSubmit: (body: string, mentions: string[]) => Promise<boolean>;
  onCancel: () => void;
}) => {
  const [value, setValue] = useState(initialValue);
  const [picked, setPicked] = useState(initialMentions);
  const canSubmit = value.trim() !== "" && !isPending;
  const submit = () => onSubmit(value, mentionIdsIn(value, picked));
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      if (canSubmit) void submit();
    }
  };

  return (
    <div className="space-y-3">
      {projectId ? (
        <MentionTextarea
          autoFocus
          projectId={projectId}
          value={value}
          onValueChange={setValue}
          onMention={(person) => setPicked((now) => [...now, person])}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          rows={3}
          className="resize-none"
        />
      ) : (
        <Textarea
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          rows={3}
          className="resize-none"
        />
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground select-none">
          <kbd className="font-mono">Shift</kbd> +{" "}
          <kbd className="font-mono">Enter</kbd> to submit
        </span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void submit()}
            disabled={!canSubmit}
          >
            {isPending ? pendingLabel : submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
