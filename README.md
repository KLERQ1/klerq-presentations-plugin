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

For Claude.ai, run `python scripts/build-claude-zip.py` and upload the zip as a plugin. For Claude Code,
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
| The inline KLERQ-branded form via MCP Apps (served by the KLERQ MCP server) | Claude.ai, Claude Desktop, ChatGPT, VS Code Copilot, Microsoft 365 Copilot, Cursor, Goose — every MCP Apps host |
| The same form as a Claude widget (`assets/form-template.html`) | Claude.ai only, used when the form server is not configured |
| Tappable questions | Claude for PowerPoint only |
| Filling a user's own .pptx template | Only where the client can run code and edit files |

The skill picks its mode from the tools it sees: the `presentation_form` tool on the KLERQ
server means the MCP Apps form, an inline widget tool means the Claude widget form, a tappable-question tool
means questions, none of these means plain chat with numbered options. The content flow,
the KLERQ record and the KLERQ export are the same in all four.

## The form in other clients (MCP Apps)

The brief box and the chapter form are served by the KLERQ MCP server itself as
[MCP Apps](https://modelcontextprotocol.io/extensions/apps/overview) resources: two tools,
`presentation_brief` and `presentation_form`, whose results render the form inline in every
host that supports the extension (Claude.ai, ChatGPT, VS Code Copilot, Microsoft 365 Copilot,
Cursor). The server holds no form data: the assistant passes the KLERQ content in as the tool
argument and the answers come back as a chat message. The code lives in the server repo
(GitLab `klerq/blueknows/klerq-mcp`, `src/tools/form`, see its `docs/form-mcp-app.md`); the
form assets there are copies of `skills/klerq-deck-builder/assets/` and must be updated
together.

Until the server release that carries the form tools is live, Claude.ai falls back to the
widget form and every other client to plain chat mode. No separate form server is needed or
configured any more.

## Packages per customer

Every workspace has its own MCP address (`<workspace>.mcp.klerq.app`). The three builders take
`--tenant <workspace>` and write `…-<workspace>.zip`; `docs/customer-setup.md` has the steps a
customer follows in Claude, ChatGPT and Microsoft 365 Copilot, including adding the server by
URL without any package.

```bash
python scripts/build-claude-zip.py  --tenant acme
python scripts/build-chatgpt-zip.py --tenant acme
python scripts/build-m365-zip.py    --tenant acme --auth-ref <that customer's auth config id>
```

Once the server accepts the universal address `mcp.klerq.app` (one listing for every
workspace, see the team plan), build with `--universal` instead of `--tenant`: the packages
then point at that address and the Copilot package keeps its fixed app id for AppSource.

## ChatGPT package

ChatGPT validates more than the portable format: it wants an `extensions.com.openai.interface`
block (display name, descriptions, category, square logo and icon) and, for the MCP servers,
an `.app.json` that maps each server to the app you registered in ChatGPT developer mode.
`scripts/build-chatgpt-zip.py` builds that package as `klerq-deck-builder-chatgpt.zip`
next to the repo folder:

```bash
python scripts/build-chatgpt-zip.py                                   # skills + mcp.json, no app mapping
python scripts/build-chatgpt-zip.py klerq=asdk_app_xxx
```

To get the ids: ChatGPT → Settings → Security and login → Developer mode on; then
chatgpt.com/plugins → plus → add the KLERQ MCP server URL; open the
new app and copy the `plugin_asdk_app_…` id from the browser URL. The script strips the
`plugin_` prefix.

## Microsoft 365 Copilot package

`m365/` holds a Microsoft 365 app package: a Teams app manifest (v1.22) that references a
declarative agent (schema v1.8) with one MCP plugin (schema v2.4, `RemoteMCPServer`
runtime): the KLERQ server (OAuth via the Enterprise token store), including the two form
tools with their MCP Apps widget metadata. The skill's instructions are condensed into the agent's
`instructions` (limit 8,000 characters). `scripts/build-m365-zip.py` validates the files and
builds `klerq-deck-builder-m365.zip` next to the repo folder; `scripts/validate-m365.py`
checks them against Microsoft's JSON schemas.

```bash
python scripts/build-m365-zip.py --auth-ref <auth config id>
```

The auth config id comes from Microsoft 365 Agents Toolkit (choose dynamic client
registration for the KLERQ server; it publishes a registration endpoint) or from the Teams
developer portal (OAuth client registration). Upload the zip in the Microsoft 365 admin
center under Copilot → Agents & connectors → Upload custom agent.

Two things to know before testing:

- **A Microsoft 365 Copilot license (or pay-as-you-go billing) is required.** Without it the
  account runs "M365 Copilot (Basic)": the agent loads and follows its instructions, but no
  actions run, no sign-in to KLERQ appears and `-developer on` shows no debug card. That is
  the text-only behaviour, not a packaging problem.
- The KLERQ plugin pins its 18 tools in `klerq-tools.json` (16 data tools plus the two form
  tools, which carry the `_meta.ui.resourceUri` the widget renderer needs).
