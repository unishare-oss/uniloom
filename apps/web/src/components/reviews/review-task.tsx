"use client";

import { ChevronDown, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  KindIcon,
  PriorityIcon,
  StateLozenge,
} from "@/components/items/item-meta";
import { ReviewItemPreview } from "@/components/reviews/review-item-preview";
import { Avatar } from "@/components/user/avatar";
import type { GetReviews200ItemsItem } from "@/lib/api/generated/uniloomAPI.schemas";

export const ReviewTask = ({ item }: { item: GetReviews200ItemsItem }) => {
  const [open, setOpen] = useState(false);
  return (
    <article className="rounded-xl border bg-card">
      <div className="flex items-start gap-3 p-4 sm:p-5">
        {item.priority && (
          <span className="mt-1">
            <PriorityIcon priority={item.priority} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {item.kind && <KindIcon kind={item.kind} />}
            <span className="font-mono">{item.key}</span>
            <Link
              href={`/p/${item.project.id}`}
              className="rounded underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-ring"
            >
              {item.project.name}
            </Link>
          </div>
          <h3 className="mt-1.5 text-sm font-semibold leading-relaxed sm:text-base">
            <Link
              href={`/p/${item.project.id}/items/${item.id}`}
              className="rounded hover:underline focus-visible:outline-ring"
            >
              {item.title}
              <ArrowUpRight
                aria-hidden="true"
                className="ml-1 inline size-3.5 text-muted-foreground"
              />
            </Link>
          </h3>
          <span className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            {item.assignee && (
              <Avatar
                image={item.assignee.image}
                name={item.assignee.name}
                size={20}
              />
            )}
            {item.assignee?.name ?? "Unassigned"}
          </span>
        </div>
        {item.state && (
          <span className="shrink-0">
            <StateLozenge
              name={item.state.name}
              category={item.state.category}
            />
          </span>
        )}
      </div>
      <details
        name="review-task"
        className="group/review"
        onToggle={(event) => {
          if (event.target === event.currentTarget)
            setOpen(event.currentTarget.open);
        }}
      >
        <summary className="flex cursor-pointer list-none items-center justify-between rounded-b-xl border-t px-4 py-2.5 text-sm text-muted-foreground outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring sm:px-5 [&::-webkit-details-marker]:hidden">
          Preview task
          <ChevronDown
            aria-hidden="true"
            className="size-4 group-open/review:rotate-180"
          />
        </summary>
        {open && <ReviewItemPreview itemId={item.id} />}
      </details>
    </article>
  );
};
