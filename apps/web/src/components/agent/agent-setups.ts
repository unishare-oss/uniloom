/** One thing to do in an agent: where, what to run or paste (copied), and a hint. */
export type AgentStep = {
  title: string;
  where: string;
  text?: string;
  note?: string;
};

export type AgentSetup = {
  id: string;
  name: string;
  steps: AgentStep[];
  /** Another way to add the server: the config file to edit instead of the command. */
  config?: { where: string; text: string };
};

// Checked against each tool's docs on 2026-10-13:
// Claude Code: https://code.claude.com/docs/en/mcp
// Codex CLI:   https://learn.chatgpt.com/docs/extend/mcp?surface=cli
// Gemini CLI:  https://geminicli.com/docs/tools/mcp-server/
// OpenCode:    https://opencode.ai/docs/mcp-servers/
// Cursor:      https://cursor.com/docs/context/mcp
// VS Code:     https://code.visualstudio.com/docs/copilot/customization/mcp-servers
//              https://code.visualstudio.com/docs/agents/reference/mcp-configuration
export const agentSetups = (serverUrl: string): AgentSetup[] => [
  {
    id: "claude",
    name: "Claude Code",
    steps: [
      {
        title: "Add the server",
        where: "Terminal",
        text: `claude mcp add --transport http uniloom ${serverUrl}`,
      },
      {
        title: "Sign in",
        where: "Inside Claude Code",
        text: "/mcp",
        note: "Pick uniloom and follow the steps in your browser.",
      },
    ],
  },
  {
    id: "codex",
    name: "Codex CLI",
    steps: [
      {
        title: "Add the server",
        where: "Terminal",
        text: `codex mcp add uniloom --url ${serverUrl}`,
      },
      {
        title: "Sign in",
        where: "Terminal",
        text: "codex mcp login uniloom",
      },
    ],
    config: {
      where: "~/.codex/config.toml",
      text: `[mcp_servers.uniloom]\nurl = "${serverUrl}"`,
    },
  },
  {
    id: "gemini",
    name: "Gemini CLI",
    steps: [
      {
        title: "Add the server",
        where: "Terminal",
        text: `gemini mcp add --transport http uniloom ${serverUrl}`,
      },
      {
        title: "Sign in",
        where: "Inside Gemini CLI",
        text: "/mcp auth uniloom",
      },
    ],
    config: {
      where: "~/.gemini/settings.json",
      text: `{\n  "mcpServers": {\n    "uniloom": { "httpUrl": "${serverUrl}" }\n  }\n}`,
    },
  },
  {
    id: "opencode",
    name: "OpenCode",
    steps: [
      {
        title: "Add the server",
        where: "opencode.json",
        text: `{\n  "$schema": "https://opencode.ai/config.json",\n  "mcp": {\n    "uniloom": {\n      "type": "remote",\n      "url": "${serverUrl}",\n      "enabled": true\n    }\n  }\n}`,
      },
      {
        title: "Sign in",
        where: "Terminal",
        text: "opencode mcp auth uniloom",
      },
    ],
  },
  {
    id: "cursor",
    name: "Cursor",
    steps: [
      {
        title: "Add the server",
        where: "~/.cursor/mcp.json",
        text: `{\n  "mcpServers": {\n    "uniloom": { "url": "${serverUrl}" }\n  }\n}`,
      },
      {
        title: "Sign in",
        where: "Cursor Settings → MCP",
        note: "Find uniloom in the list, connect it and sign in in your browser.",
      },
    ],
  },
  {
    id: "vscode",
    name: "VS Code (Copilot)",
    steps: [
      {
        title: "Add the server",
        where: ".vscode/mcp.json",
        text: `{\n  "servers": {\n    "uniloom": { "type": "http", "url": "${serverUrl}" }\n  }\n}`,
      },
      {
        title: "Sign in",
        where: "Command Palette → MCP: List Servers",
        note: "Pick uniloom and start it. On first connect a browser window opens to sign in.",
      },
    ],
  },
];
