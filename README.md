# KLERQ deck builder — Agent Plugin

Packages the KLERQ deck-builder skill together with the KLERQ MCP server, in the
[Agent Plugins 1.0.0](https://agent-plugins.org/) format, so it loads in ChatGPT, Codex,
GitHub Copilot, Cursor, Kiro and VS Code — and, through the CLI, in Claude Code.

```
klerq-deck-builder/
├── plugin.json                       # manifest (Agent Plugins 1.0.0)
├── mcp.json                          # KLERQ MCP server, Streamable HTTP
└── skills/
    └── klerq-deck-builder/
        ├── SKILL.md                  # the workflow
        └── references/chapters.md    # payload shapes for presentations_create
```

## Install

```bash
npx plugins add ./klerq-deck-builder          # local folder, for testing
npx plugins add <owner>/klerq-deck-builder    # once it is on GitHub
```

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
| Interview as numbered questions in chat | Yes |
| Export to PowerPoint via `export_presentation` | Yes — runs server-side in KLERQ |
| The inline KLERQ-branded HTML form | **No** — Claude-only, needs an inline widget tool |
| Filling a user's own .pptx template | Only where the client can run code and edit files |

The original Claude version ran the interview as an inline form and built the slides into an
uploaded template. Neither has a portable equivalent, so this version asks the chapters as
numbered questions and exports through KLERQ's own export templates instead.

Clients may implement the standard partially — one component type, or only some MCP
transports — so check that both the skill and the server loaded before relying on it.

## Client-specific extras

Anything one client alone understands (hooks, slash commands, sub-agents) belongs in a
reverse-domain folder such as `com.example.client/`, or under `extensions` in the manifest.
Never at the manifest root: the schema sets `additionalProperties: false`, so a single stray
top-level key invalidates the whole file.

Note the filename collision: Claude Code's own format uses `.claude-plugin/plugin.json`,
which is a different file with a different schema from the root `plugin.json` here.
