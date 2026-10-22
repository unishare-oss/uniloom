"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Avatar } from "@/components/user/avatar";
import { Textarea } from "@/components/ui/textarea";
import { useListMembers } from "@/lib/api/generated/members/members";
import { useGetMe } from "@/lib/api/generated/users/users";
import { mentionQueryAt } from "@/lib/mentions";
import { cn } from "@/lib/utils";

const MAX_SUGGESTIONS = 8;

/**
 * A textarea that suggests the project's members when you type "@". Picking one writes
 * "@Name " and tells the parent who was picked; the parent sends only the ones whose
 * "@Name" is still in the text.
 */
export const MentionTextarea = ({
  projectId,
  value,
  onValueChange,
  onMention,
  onKeyDown,
  className,
  ...props
}: Omit<React.ComponentProps<"textarea">, "value" | "onChange"> & {
  projectId: string;
  value: string;
  onValueChange: (value: string) => void;
  onMention: (person: { id: string; name: string }) => void;
}) => {
  const textarea = useRef<HTMLTextAreaElement>(null);
  // One id per box: the composer and an open reply/edit box can both show a list.
  const listId = useId();
  const nextCaret = useRef<number | null>(null);
  const [caret, setCaret] = useState(0);
  const [active, setActive] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const { data: members } = useListMembers(projectId, {
    query: { select: (r) => r.data },
  });
  const { data: me } = useGetMe({ query: { select: (r) => r.data } });

  const typing = mentionQueryAt(value, caret);
  const query = typing?.query.toLowerCase() ?? "";
  const suggestions = typing
    ? (members ?? [])
        .filter(
          (member) =>
            member.userId !== me?.id &&
            (member.name.toLowerCase().startsWith(query) ||
              member.email.toLowerCase().startsWith(query)),
        )
        .slice(0, MAX_SUGGESTIONS)
    : [];
  const open = !dismissed && suggestions.length > 0;
  const selected = Math.min(active, suggestions.length - 1);

  // Put the caret after the inserted "@Name " once the new value is in the box.
  useEffect(() => {
    if (nextCaret.current === null) return;
    textarea.current?.setSelectionRange(nextCaret.current, nextCaret.current);
    nextCaret.current = null;
  }, [value]);

  const pick = (member: (typeof suggestions)[number]) => {
    if (!typing) return;
    const inserted = `@${member.name} `;
    nextCaret.current = typing.start + inserted.length;
    setCaret(nextCaret.current);
    onValueChange(value.slice(0, typing.start) + inserted + value.slice(caret));
    onMention({ id: member.userId, name: member.name });
  };

  return (
    <div className="relative">
      <Textarea
        {...props}
        ref={textarea}
        value={value}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls={listId}
        aria-activedescendant={open ? `${listId}-${selected}` : undefined}
        className={className}
        onChange={(e) => {
          setCaret(e.target.selectionStart);
          setActive(0);
          setDismissed(false);
          onValueChange(e.target.value);
        }}
        onSelect={(e) => setCaret(e.currentTarget.selectionStart)}
        onKeyDown={(e) => {
          if (open && !e.shiftKey) {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              const step = e.key === "ArrowDown" ? 1 : -1;
              setActive(
                (selected + step + suggestions.length) % suggestions.length,
              );
              return;
            }
            if (e.key === "Enter" || e.key === "Tab") {
              e.preventDefault();
              pick(suggestions[selected]);
              return;
            }
          }
          if (open && e.key === "Escape") {
            e.preventDefault();
            setDismissed(true);
            return;
          }
          onKeyDown?.(e);
        }}
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute top-full right-0 left-0 z-20 mt-1 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-md"
        >
          {suggestions.map((member, index) => (
            <li
              key={member.userId}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === selected}
              // Keep the focus in the textarea while clicking.
              onMouseDown={(e) => {
                e.preventDefault();
                pick(member);
              }}
              onMouseEnter={() => setActive(index)}
              className={cn(
                "flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm",
                index === selected && "bg-accent text-accent-foreground",
              )}
            >
              <Avatar name={member.name} image={member.image} size={20} />
              <span className="font-medium">{member.name}</span>
              <span className="truncate text-xs text-muted-foreground">
                {member.email}
              </span>
              <span className="ml-auto text-[10px] tracking-wider text-muted-foreground uppercase">
                {member.role.toLowerCase()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
