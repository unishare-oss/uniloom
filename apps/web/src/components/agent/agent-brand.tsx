import type { ComponentType, SVGProps } from "react";
import { Bot } from "lucide-react";
// Single components only: the package root also pulls in the wrappers that need @lobehub/ui.
import ClaudeCodeLogo from "@lobehub/icons/es/ClaudeCode/components/Color";
import ClaudeCodeText from "@lobehub/icons/es/ClaudeCode/components/Text";
import CodexLogo from "@lobehub/icons/es/Codex/components/Color";
import CodexText from "@lobehub/icons/es/Codex/components/Text";
import CursorLogo from "@lobehub/icons/es/Cursor/components/Mono";
import CursorText from "@lobehub/icons/es/Cursor/components/Text";
import GeminiCliLogo from "@lobehub/icons/es/GeminiCLI/components/Color";
import GeminiCliText from "@lobehub/icons/es/GeminiCLI/components/Text";
import CopilotLogo from "@lobehub/icons/es/GithubCopilot/components/Mono";
import CopilotText from "@lobehub/icons/es/GithubCopilot/components/Text";
import OpenCodeLogo from "@lobehub/icons/es/OpenCode/components/Mono";
import OpenCodeText from "@lobehub/icons/es/OpenCode/components/Text";
import { cn } from "@/lib/utils";

type Svg = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>;

type Brand = {
  Logo: Svg;
  /** The brand's wordmark, drawn in currentColor. */
  Text: Svg;
  /** Wordmark colour and badge tint; the black-and-white brands follow the theme instead. */
  className: string;
  /** Wordmark height in px: the stacked two-line marks need more than the one-line ones. */
  textSize?: number;
};

const mono = "bg-foreground/10 text-foreground";

/** The agents with a setup guide (agent-setups.ts), matched on the client's self-declared name. */
const brands: { match: RegExp; brand: Brand }[] = [
  {
    match: /claude code/i,
    brand: {
      Logo: ClaudeCodeLogo,
      Text: ClaudeCodeText,
      textSize: 18,
      className: "bg-[#D97757]/15 text-[#C15F3C] dark:text-[#E08A6B]",
    },
  },
  {
    match: /codex/i,
    brand: { Logo: CodexLogo, Text: CodexText, className: mono },
  },
  {
    match: /gemini/i,
    brand: { Logo: GeminiCliLogo, Text: GeminiCliText, className: mono },
  },
  {
    match: /opencode/i,
    brand: { Logo: OpenCodeLogo, Text: OpenCodeText, className: mono },
  },
  {
    match: /cursor/i,
    brand: { Logo: CursorLogo, Text: CursorText, className: mono },
  },
  {
    match: /copilot|vs ?code|visual studio code/i,
    brand: { Logo: CopilotLogo, Text: CopilotText, className: mono },
  },
];

export const agentBrand = (name: string | null | undefined): Brand | null =>
  (name && brands.find((b) => b.match.test(name))?.brand) || null;

/**
 * The agent's name: its brand's logo and wordmark when it is one we know, otherwise a robot and the name.
 * The name is self-declared by the client, so this is display only, as the plain name was.
 */
export const AgentBadge = ({ name }: { name: string }) => {
  const brand = agentBrand(name);
  if (!brand) {
    return (
      <span className="mx-1 inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 align-[1px] text-xs leading-5 font-medium text-primary">
        <Bot className="size-3" />
        {name}
      </span>
    );
  }
  return (
    <span
      title={name}
      className={cn(
        "mx-1 inline-flex h-5 items-center gap-1.5 rounded-full px-2 align-[-4px]",
        brand.className,
      )}
    >
      <brand.Logo size={13} aria-hidden />
      <brand.Text size={brand.textSize ?? 12} aria-hidden />
      <span className="sr-only">{name}</span>
    </span>
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
