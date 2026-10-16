"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { NEO_BUTTON } from "@/components/comments/neo-button";

/** The inline editor for editing a comment or writing a reply. */
export const CommentEditor = ({
  initialValue = "",
  placeholder,
  submitLabel,
  pendingLabel,
  isPending,
  onSubmit,
  onCancel,
}: {
  initialValue?: string;
  placeholder?: string;
  submitLabel: string;
  pendingLabel: string;
  isPending: boolean;
  /** Resolves true when it was saved. */
  onSubmit: (body: string) => Promise<boolean>;
  onCancel: () => void;
}) => {
  const [value, setValue] = useState(initialValue);
  const canSubmit = value.trim() !== "" && !isPending;

  return (
    <div className="space-y-3">
      <Textarea
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.shiftKey) {
            e.preventDefault();
            if (canSubmit) void onSubmit(value);
          }
        }}
        placeholder={placeholder}
        rows={3}
        className="resize-none"
      />
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
            className={`${NEO_BUTTON} bg-background hover:bg-muted`}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void onSubmit(value)}
            className={`${NEO_BUTTON} hover:bg-primary`}
            disabled={!canSubmit}
          >
            {isPending ? pendingLabel : submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
