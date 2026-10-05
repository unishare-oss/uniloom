"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

/** Light, dark, or whatever the device uses (the default). Saved in this browser. */
export const ThemeSwitch = () => {
  const { theme, setTheme } = useTheme();
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">Appearance</legend>
      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            aria-pressed={theme === value}
            onClick={() => setTheme(value)}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 text-sm hover:bg-muted",
              theme === value &&
                "border-primary bg-accent text-accent-foreground",
            )}
          >
            <Icon className="size-5" />
            {label}
          </button>
        ))}
      </div>
    </fieldset>
  );
};
