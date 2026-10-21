import type { ComponentType, SVGProps } from "react";
import { Bot } from "lucide-react";
// Single components only: the package root also pulls in the wrappers that need @lobehub/ui.
import ClaudeLogo from "@lobehub/icons/es/Claude/components/Color";
import CodexLogo from "@lobehub/icons/es/Codex/components/Color";
import CursorLogo from "@lobehub/icons/es/Cursor/components/Mono";
import GeminiCliLogo from "@lobehub/icons/es/GeminiCLI/components/Color";
import CopilotLogo from "@lobehub/icons/es/GithubCopilot/components/Mono";
import OpenCodeLogo from "@lobehub/icons/es/OpenCode/components/Mono";
import { cn } from "@/lib/utils";

type Svg = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>;

type Brand = {
  Logo: Svg;
  /** The name's colour; the black-and-white brands follow the theme. */
  className: string;
};

const mono = "text-foreground";

/** The agents with a setup guide (agent-setups.ts), matched on the client's self-declared name. */
const brands: { match: RegExp; brand: Brand }[] = [
  {
    match: /claude code/i,
    brand: {
      Logo: ClaudeLogo,
      className: "text-[#C15F3C] dark:text-[#E08A6B]",
    },
  },
  { match: /codex/i, brand: { Logo: CodexLogo, className: mono } },
  { match: /gemini/i, brand: { Logo: GeminiCliLogo, className: mono } },
  { match: /opencode/i, brand: { Logo: OpenCodeLogo, className: mono } },
  { match: /cursor/i, brand: { Logo: CursorLogo, className: mono } },
  {
    match: /copilot|vs ?code|visual studio code/i,
    brand: { Logo: CopilotLogo, className: mono },
  },
];

export const agentBrand = (name: string | null | undefined): Brand | null =>
  (name && brands.find((b) => b.match.test(name))?.brand) || null;

/**
 * "via <logo> <name>" after the person's name: the brand's logo and colour when it is an agent we
 * know, otherwise a robot. The name is self-declared by the client, so this is display only.
 */
export const AgentBadge = ({ name }: { name: string }) => {
  const brand = agentBrand(name);
  return (
    <>
      <span className="text-muted-foreground">via</span>{" "}
      <span
        className={cn(
          "inline-flex items-center gap-1 align-[-2px] font-semibold",
          brand ? brand.className : "text-primary",
        )}
      >
        {brand ? (
          <brand.Logo size={14} aria-hidden />
        ) : (
          <Bot className="size-3.5" aria-hidden />
        )}
        {name}
      </span>
    </>
  );
};

/** The small corner mark on the avatar: the brand's logo, or a robot. */
export const AgentMark = ({ name }: { name: string | null }) => {
  const brand = agentBrand(name);
  return brand ? (
    <brand.Logo size={10} aria-hidden />
  ) : (
    <Bot className="size-2.5" />
  );
};
