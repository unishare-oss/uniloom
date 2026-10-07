"use client";

import Image from "next/image";
import { useState } from "react";
import { isAllowedAvatar, isLocalAvatar } from "@/lib/avatar-hosts";
import { cn } from "@/lib/utils";

const initials = (name: string) => {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase());
  return letters.join("") || "?";
};

/**
 * The uniAuth avatar, or the person's initials when there is none or it can't load. A
 * rounded square (corners 25% of the size), like the profile in the sidebar.
 */
export const Avatar = ({
  name,
  image,
  size = 64,
  className,
}: {
  name: string;
  image: string | null;
  size?: number;
  /** Overrides the rounded-square shape. */
  className?: string;
}) => {
  const [failed, setFailed] = useState(false);
  if (image && !failed && isAllowedAvatar(image)) {
    return (
      <Image
        src={image}
        alt=""
        width={size}
        height={size}
        unoptimized={isLocalAvatar(image)}
        onError={() => setFailed(true)}
        className={cn("rounded-[25%] object-cover", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden
      data-testid="avatar-initials"
      className={cn(
        "inline-flex items-center justify-center rounded-[25%] bg-muted font-medium text-muted-foreground",
        className,
      )}
      style={{ width: size, height: size, fontSize: size / 2.6 }}
    >
      {initials(name)}
    </span>
  );
};
