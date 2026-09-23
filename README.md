# KLERQ deck builder — Agent Plugin

Packages the KLERQ deck-builder skill together with the KLERQ MCP server in two formats at
once: the [Agent Plugins 1.0.0](https://agent-plugins.org/) format, so it loads in ChatGPT,
Codex, GitHub Copilot, Cursor, Kiro and VS Code, and Claude's own plugin format, so the same
zip uploads to Claude.ai and installs in Claude Code.

```
klerq-deck-builder/
├── plugin.json                       # manifest (Agent Plugins 1.0.0)
├── mcp.json                          # KLERQ MCP server, Streamable HTTP (portable)
├── .claude-plugin/plugin.json        # manifest (Claude plugins)
├── .mcp.json                         # KLERQ MCP server (Claude transport name "http")
├── mcp-app/                          # MCP Apps server: renders the form in Claude, ChatGPT, Copilot… (see its README)
│   ├── server.mjs                    # two tools: presentation_brief, presentation_form
│   ├── ui/bridge.js                  # MCP Apps protocol bridge for the form pages
│   └── build.mjs                     # builds dist/*.html from the skill's form assets
└── skills/
    └── klerq-deck-builder/
        ├── SKILL.md                  # the workflow, four modes (app form / widget form / questions / plain chat)
        ├── assets/                   # inline KLERQ-branded form (Claude.ai only)
        │   ├── brief-box.html
        │   ├── form-template.html
        │   ├── config.json           # hostedScriptUrl for fast mode
        │   └── hosted/               # built script for CDN hosting
        ├── references/
        │   ├── form-mode.md          # data gathering, prefilling, answer messages
        │   └── chapters.md           # payload shapes for presentations_create
        └── scripts/build.py          # rebuilds hosted/klerq-form.js
```

## Install

```bash
npx plugins add ./klerq-deck-builder                      # local folder, for testing
npx plugins add KLERQ1/klerq-presentations-plugin         # from GitHub
```

For Claude.ai, zip the folder (without `.git`) and upload it as a plugin. For Claude Code,
install it from the same repository.

The CLI detects the agent tools on your machine and installs to each of them, translating
the portable format into that client's own structure. To install by hand, copy
`skills/klerq-deck-builder/` into the client's skills directory (`.agents/skills/` for Codex,
`.claude/skills/` for Claude Code) and add the server from `mcp.json` to that client's MCP
configuration.

## Authentication

Agent Plugins deliberately defines nothing portable for OAuth, credentials or secrets: that
stays with each client. So the first KLERQ call in a new client will prompt you to sign in,
and you authorise KLERQ once per client. Nothing in this repo holds a token.

## What travels, and what does not

| Part | Portable |
|---|---|
| The skill (SKILL.md + references) | Yes — Agent Skills is a shared format |
| The KLERQ connector (mcp.json) | Yes — Streamable HTTP MCP, fixed URL |
| Interview as numbered questions in chat | Yes — plain chat mode, every client |
| Export to PowerPoint via `export_presentation` | Yes — runs server-side in KLERQ |
| The inline KLERQ-branded form via MCP Apps (`mcp-app/`) | Claude.ai, Claude Desktop, ChatGPT, VS Code Copilot, Microsoft 365 Copilot, Cursor, Goose — every MCP Apps host |
| The same form as a Claude widget (`assets/form-template.html`) | Claude.ai only, used when the form server is not configured |
| Tappable questions | Claude for PowerPoint only |
| Filling a user's own .pptx template | Only where the client can run code and edit files |

The skill picks its mode from the tools it sees: the `presentation_form` tool means the
MCP Apps form, an inline widget tool means the Claude widget form, a tappable-question tool
means questions, none of these means plain chat with numbered options. The content flow,
the KLERQ record and the KLERQ export are the same in all four.

## The form in other clients (MCP Apps)

`mcp-app/` is a small MCP server that serves the brief box and the chapter form as
[MCP Apps](https://modelcontextprotocol.io/extensions/apps/overview) resources. The chat
client renders them in a sandboxed iframe; the assistant passes the KLERQ data in as a tool
argument and the answers come back as a chat message. The server holds no KLERQ data and no
credentials. Deploy it (see `mcp-app/README.md`) and add it next to the KLERQ server:

```jsonc
// .mcp.json (Claude)
"klerq-form": { "type": "http", "url": "https://klerq-presentations-plugin.onrender.com/mcp" }
// mcp.json (other clients)
"klerq-form": { "type": "streamable-http", "url": "https://klerq-presentations-plugin.onrender.com/mcp" }
```

It is deployed on Render at that address and already listed in both configs. If it is
removed, Claude.ai falls back to the widget form and every other client to plain chat mode. The two tools can also be merged into the KLERQ MCP server itself later;
the skill only looks for the tool names.

Clients may implement the standard partially — one component type, or only some MCP
transports — so check that both the skill and the server loaded before relying on it.

## Client-specific extras

Anything one client alone understands (hooks, slash commands, sub-agents) belongs in a
reverse-domain folder such as `com.example.client/`, or under `extensions` in the manifest.
Never at the manifest root: the schema sets `additionalProperties: false`, so a single stray
top-level key invalidates the whole file.

Note the filename collision: Claude's own format uses `.claude-plugin/plugin.json`, which is
a different file with a different schema from the root `plugin.json`. Both are kept in sync
by hand; change the name, version or description in both.
