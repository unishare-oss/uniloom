"use client";

import Image from "next/image";
import { useState } from "react";
import { isAllowedAvatar, isLocalAvatar } from "@/lib/avatar-hosts";

function initials(name: string) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase());
  return letters.join("") || "?";
}

/** The uniAuth avatar, or the person's initials when there is none or it can't load. */
export function Avatar({
  name,
  image,
  size = 64,
}: {
  name: string;
  image: string | null;
  size?: number;
}) {
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
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden
      data-testid="avatar-initials"
      className="inline-flex items-center justify-center rounded-full bg-muted font-medium text-muted-foreground"
      style={{ width: size, height: size, fontSize: size / 2.6 }}
    >
      {initials(name)}
    </span>
  );
}
