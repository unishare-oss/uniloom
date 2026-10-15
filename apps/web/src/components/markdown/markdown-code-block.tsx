"use client";

import type { ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export const MarkdownCodeBlock = ({
  code,
  language,
  children,
}: {
  code: string;
  language: string;
  children: ReactNode;
}) => {
  const [message, setMessage] = useState("");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setMessage("Copied");
    } catch {
      setMessage("Copy failed. Select and copy the code.");
    }
  };
  return (
    <div className="markdown-code-block">
      <div className="markdown-code-toolbar">
        <span>{language || "Plain text"}</span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={copy}
          aria-label="Copy code"
        >
          {message === "Copied" ? (
            <Check aria-hidden="true" />
          ) : (
            <Copy aria-hidden="true" />
          )}{" "}
          {message === "Copied" ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre>{children}</pre>
      <span
        role="status"
        className={
          message.startsWith("Copy failed")
            ? "block px-3 pb-2 text-xs text-destructive"
            : "sr-only"
        }
      >
        {message}
      </span>
    </div>
  );
};
