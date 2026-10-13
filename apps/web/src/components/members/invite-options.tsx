"use client";

import { useId } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CreateInviteBody } from "@/lib/api/generated/uniloomAPI.schemas";

export type InviteChoices = CreateInviteBody;

/** What a new link starts with. */
export const DEFAULT_CHOICES: InviteChoices = {
  expiresIn: "24h",
  maxUses: null,
};

const expiryLabels: Record<InviteChoices["expiresIn"], string> = {
  "1h": "1 hour",
  "24h": "24 hours",
  "7d": "7 days",
  "30d": "30 days",
};

// Select values are strings: "none" stands for no limit.
const limitLabels: Record<string, string> = {
  none: "No limit",
  "1": "1 person",
  "5": "5 people",
  "10": "10 people",
  "25": "25 people",
  "50": "50 people",
  "100": "100 people",
};

/** How long a new invite link works and how many people it lets in. */
export const InviteOptions = ({
  value,
  onChange,
  disabled,
}: {
  value: InviteChoices;
  onChange: (value: InviteChoices) => void;
  disabled?: boolean;
}) => {
  const expiryId = useId();
  const limitId = useId();

  return (
    <div className="flex flex-wrap gap-4">
      <div className="flex flex-col gap-1.5">
        <span id={expiryId} className="text-sm font-medium">
          Expires after
        </span>
        <Select
          value={value.expiresIn}
          items={expiryLabels}
          disabled={disabled}
          onValueChange={(expiresIn) =>
            onChange({
              ...value,
              expiresIn: expiresIn as InviteChoices["expiresIn"],
            })
          }
        >
          <SelectTrigger aria-labelledby={expiryId} className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(expiryLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <span id={limitId} className="text-sm font-medium">
          Limit
        </span>
        <Select
          value={value.maxUses === null ? "none" : String(value.maxUses)}
          items={limitLabels}
          disabled={disabled}
          onValueChange={(limit) =>
            onChange({
              ...value,
              maxUses: limit === "none" ? null : Number(limit),
            })
          }
        >
          <SelectTrigger aria-labelledby={limitId} className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(limitLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
