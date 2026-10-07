"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { GetProject200Role } from "@/lib/api/generated/uniloomAPI.schemas";

export type Role = GetProject200Role;

export const roleLabels: Record<Role, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  MEMBER: "Member",
};

export const RoleSelect = ({
  value,
  roles,
  onChange,
  disabled,
  label,
}: {
  value: Role;
  roles: Role[];
  onChange: (role: Role) => void;
  disabled?: boolean;
  label: string;
}) => (
  <Select
    value={value}
    items={roleLabels}
    onValueChange={(role) => onChange(role as Role)}
    disabled={disabled}
  >
    <SelectTrigger aria-label={label} className="w-36">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {roles.map((role) => (
        <SelectItem key={role} value={role}>
          {roleLabels[role]}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);
