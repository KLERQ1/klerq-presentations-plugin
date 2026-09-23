# KLERQ presentation form — MCP Apps server

Renders the KLERQ deck-builder form **inside the chat** of every client that supports
[MCP Apps](https://modelcontextprotocol.io/extensions/apps/overview): Claude.ai, Claude
Desktop, ChatGPT, GitHub Copilot in VS Code, Microsoft 365 Copilot, Cursor, Goose and
others. Clients without MCP Apps support (terminals such as Claude Code or Codex CLI) get a
text result that tells the assistant to continue in plain chat mode.

The server is deliberately dumb:

- It holds **no KLERQ data and no credentials.** The assistant loads everything from the
  KLERQ MCP server as before and passes it in as the tool argument.
- It serves two pages, built from the skill's own `assets/brief-box.html` and
  `assets/form-template.html`. The form code is untouched; only the data block and the
  "send to chat" call are swapped for the MCP Apps protocol (`ui/bridge.js`, ~5 KB, no
  dependencies).
- The answers come back as a normal chat message, exactly as in the Claude widget version
  (`[Presentation form] Brief` / `[Presentation form] Approve`), so the rest of the skill
  is unchanged.

## Tools

| Tool | Argument | Renders | Comes back as |
|---|---|---|---|
| `presentation_brief` | `brief` (optional prefill) | the brief box | `[Presentation form] Brief` + text |
| `presentation_form` | `data` (the form data JSON from the skill's form-mode reference) | the chapter form | `[Presentation form] Approve` + answers |

The `data` object is the same JSON that used to go between `DATA_START` and `DATA_END` in
the template, with `"phase": "rest"`. The server passes it to the page through the
`ui/notifications/tool-input` notification and, as a backup, in the tool result's
`_meta["klerq/data"]`. It is never repeated in the text the model sees.

## Run locally

```bash
cd mcp-app
npm install
npm run build          # writes dist/brief.html and dist/form.html
npm start              # http://127.0.0.1:3033/mcp
npm test               # builds, then runs test.mjs against the running server
```

Open `http://127.0.0.1:3033/preview/form.html?demo` in a browser to eyeball the form with
the template's sample data (no host needed). A mock MCP Apps host for browser testing is in
`test/mock-host.html` (`node test/host-server.mjs`, then open `http://127.0.0.1:3034/?page=form.html`).

Rebuild after any change to the skill's form assets:

```bash
npm run build
```

## Deploy

Any Node 20+ host works (Railway, Render, Fly.io, a VM, Azure App Service). Docker:

```bash
docker build -f mcp-app/Dockerfile -t klerq-form .      # from the repo root
docker run -p 3033:3033 -e ALLOWED_HOSTS=klerq-presentations-plugin.onrender.com klerq-form
```

Environment variables:

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `3033` | Listen port. Setting it also switches `HOST` to `0.0.0.0`. |
| `HOST` | `127.0.0.1` (or `0.0.0.0` when `PORT` is set) | Bind address. |
| `ALLOWED_HOSTS` | none | Comma-separated public hostnames, e.g. `klerq-presentations-plugin.onrender.com`. Turns on Host-header validation. Set it in production. |
| `STATELESS` | off | One server per request instead of MCP sessions. Use only behind a load balancer without sticky sessions; capability detection then relies on the host sending its capabilities per request. |
| `SESSION_TTL_MS` | 30 min | Idle time after which a session is dropped. |
| `STRICT_UI` | off | Refuse the form for clients that declare no MCP Apps capability. Off by default because some hosts (Microsoft 365 Copilot) render widgets without declaring it; they get the form plus a fallback hint instead. |

Put it behind HTTPS (the hosts require it) and add the URL to the plugin's MCP config:

```jsonc
// .mcp.json (Claude) — add next to "klerq"
"klerq-form": { "type": "http", "url": "https://klerq-presentations-plugin.onrender.com/mcp" }

// mcp.json (Agent Plugins, other clients)
"klerq-form": { "type": "streamable-http", "url": "https://klerq-presentations-plugin.onrender.com/mcp" }
```

No authentication is needed: the server has nothing to protect. If you want to restrict
who can reach it, put it behind the same OAuth as the KLERQ server (`requireBearerAuth`
from `@modelcontextprotocol/express`) or an allow-list on the reverse proxy.

## Logs

Each form tool call logs one JSON line with the client name, its declared capabilities and
whether the server treated it as UI-capable. On Render these appear under Logs; use them to
see how a new host identifies itself.

## Merging into the KLERQ MCP server

Everything in `createServer()` in `server.mjs` can be dropped into the main KLERQ MCP
server: two `registerAppResource` calls serving `dist/brief.html` and `dist/form.html`, and
two `registerAppTool` calls. Once there, the tools live next to `find_clients` and friends
and this separate deployment is no longer needed. The skill only looks for the tool names.

## How the page talks to the host

`ui/bridge.js` implements the view side of the MCP Apps protocol by hand so the page has no
dependencies: `ui/initialize` → `ui/notifications/initialized`, then it waits for
`ui/notifications/tool-input` (or `tool-result`), starts the form with that data, reports its
height with `ui/notifications/size-changed`, and sends the answers with a `ui/message`
request. Opened directly in a browser (no parent window, or `?demo`), it starts with the
sample data instead.
