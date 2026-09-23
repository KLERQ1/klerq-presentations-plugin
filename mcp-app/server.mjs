// KLERQ presentation form: an MCP Apps server.
// Exposes two tools that render the brief box and the chapter form inline in
// Claude, ChatGPT, VS Code Copilot and other MCP Apps hosts. It holds no KLERQ
// data and no credentials: the assistant loads the data from the KLERQ MCP
// server and passes it in as the tool argument; the form sends the answers
// back as a chat message.
import { readFileSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/server";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import { createMcpExpressApp } from "@modelcontextprotocol/express";
import {
  registerAppTool,
  registerAppResource,
  RESOURCE_MIME_TYPE,
  getUiCapability,
} from "@modelcontextprotocol/ext-apps/server";

const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(here, "dist");
const VERSION = JSON.parse(readFileSync(resolve(here, "package.json"), "utf8")).version;
const html = (name) => readFileSync(resolve(dist, name), "utf8");
for (const f of ["brief.html", "form.html"]) {
  if (!existsSync(resolve(dist, f))) {
    console.error(`dist/${f} missing: run "npm run build" first`);
    process.exit(1);
  }
}

export const UI = { brief: "ui://klerq/brief.html", form: "ui://klerq/form.html" };
const NO_UI =
  "This chat client cannot show the KLERQ form. Continue in plain chat mode: ask the chapters as numbered questions.";

export function createServer() {
  const server = new McpServer({ name: "klerq-form", version: VERSION });
  const uiMeta = { ui: { prefersBorder: false, csp: { connectDomains: [], resourceDomains: [] } } };

  registerAppResource(
    server,
    "KLERQ brief box",
    UI.brief,
    { mimeType: RESOURCE_MIME_TYPE, _meta: uiMeta },
    async () => ({ contents: [{ uri: UI.brief, mimeType: RESOURCE_MIME_TYPE, text: html("brief.html"), _meta: uiMeta }] }),
  );
  registerAppResource(
    server,
    "KLERQ presentation form",
    UI.form,
    { mimeType: RESOURCE_MIME_TYPE, _meta: uiMeta },
    async () => ({ contents: [{ uri: UI.form, mimeType: RESOURCE_MIME_TYPE, text: html("form.html"), _meta: uiMeta }] }),
  );

  // Does the connected client render MCP Apps? Capabilities come from the
  // initialize handshake (2025 protocol, needs a session) or from the
  // per-request _meta envelope (2026-07-28 protocol). Returns true, false, or
  // undefined when the server cannot tell (stateless mode with an older host).
  const CAPS_KEY = "io.modelcontextprotocol/clientCapabilities";
  const supportsUi = (ctx) => {
    const candidates = [
      ctx?.mcpReq?._meta?.[CAPS_KEY],
      ctx?._meta?.[CAPS_KEY],
      ctx?.mcpReq?.clientCapabilities,
      ctx?.clientCapabilities,
      ctx?.client?.capabilities,
      typeof server.server?.getClientCapabilities === "function" ? server.server.getClientCapabilities() : undefined,
    ].filter((c) => c && typeof c === "object");
    if (candidates.length === 0) return undefined;
    return candidates.some((caps) => Boolean(getUiCapability(caps)));
  };
  const UNKNOWN_UI =
    " If the form is not visible in the chat, this client cannot render it: continue in plain chat mode and ask the chapters as numbered questions.";

  registerAppTool(
    server,
    "presentation_brief",
    {
      title: "KLERQ presentation brief",
      description:
        "Step 1 of the KLERQ deck builder. Shows the brief box inline: one text box asking what the presentation is for. " +
        "Call it before loading any KLERQ data. The user's brief comes back as a chat message starting with \"[Presentation form] Brief\".",
      inputSchema: z.object({
        brief: z.string().optional().describe("Optional text to prefill the brief box with. Leave empty to show the example story."),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
      _meta: { ui: { resourceUri: UI.brief } },
    },
    async (args, ctx) => {
      const ui = supportsUi(ctx);
      if (ui === false) {
        return {
          content: [
            {
              type: "text",
              text: NO_UI + " Start by asking for the brief: client, what it is about, team and lead, experience to show, deadline.",
            },
          ],
        };
      }
      return {
        content: [
          {
            type: "text",
            text:
              "The brief box is open in the chat. Load the KLERQ data now (clients, presentations, specialists, matters) in the same turn, " +
              "then end the turn with one line. The brief arrives as a message starting with \"[Presentation form] Brief\"." +
              (ui === undefined ? UNKNOWN_UI : ""),
          },
        ],
      };
    },
  );

  registerAppTool(
    server,
    "presentation_form",
    {
      title: "KLERQ presentation form",
      description:
        "Step 2 of the KLERQ deck builder. Renders the chapter-by-chapter form inline, prefilled from the brief. " +
        "Pass the complete form data JSON (clients, texts, specialists, industries, highlights, general, recommendations, drafts) " +
        "as the `data` argument, exactly as described in the skill's form-mode reference, with \"phase\": \"rest\". " +
        "Never include KLERQ record ids. The user's approved choices come back as a chat message starting with \"[Presentation form] Approve\".",
      inputSchema: z.object({
        data: z
          .record(z.string(), z.unknown())
          .describe("The form data block: the JSON that would go between DATA_START and DATA_END in the skill's form template."),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
      _meta: { ui: { resourceUri: UI.form } },
    },
    async ({ data }, ctx) => {
      const ui = supportsUi(ctx);
      if (ui === false) return { content: [{ type: "text", text: NO_UI }] };
      const chapters = Array.isArray(data?.chapters) ? data.chapters.join(", ") : "default chapters";
      return {
        content: [
          {
            type: "text",
            text:
              `The presentation form is open in the chat (client: ${data?.general?.client || "not set"}; chapters: ${chapters}). ` +
              'Do not repeat its contents. End the turn with one short line; the answers arrive as a message starting with "[Presentation form] Approve".' +
              (ui === undefined ? UNKNOWN_UI : ""),
          },
        ],
        _meta: { "klerq/data": data },
      };
    },
  );

  return server;
}

// --- HTTP (Streamable HTTP) ---
// Session mode (default): one server + transport per MCP session, so the
// client's capabilities from the initialize handshake are known on every later
// call. Set STATELESS=1 to run one server per request instead (works behind
// load balancers without sticky sessions; capability detection then depends on
// the host sending them per request).
const PORT = Number(process.env.PORT || 3033);
const HOST = process.env.HOST || (process.env.PORT ? "0.0.0.0" : "127.0.0.1");
const STATELESS = /^(1|true|yes)$/i.test(process.env.STATELESS || "");
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS || 30 * 60 * 1000);
const allowedHosts = process.env.ALLOWED_HOSTS
  ? process.env.ALLOWED_HOSTS.split(",").map((s) => s.trim()).filter(Boolean)
  : undefined;
const app = createMcpExpressApp({ host: HOST, allowedHosts });

app.get("/", (_req, res) =>
  res.json({
    name: "klerq-form",
    version: VERSION,
    mcp: "/mcp",
    mode: STATELESS ? "stateless" : "sessions",
    preview: ["/preview/brief.html?demo", "/preview/form.html?demo"],
  }),
);
app.get("/healthz", (_req, res) => res.send("ok"));
app.get("/preview/:name", (req, res) => {
  const name = req.params.name;
  if (!["brief.html", "form.html"].includes(name)) return res.status(404).send("not found");
  res.type("html").send(html(name));
});

const sessions = new Map(); // sessionId -> { transport, server, last }
const noSession = (res, id) =>
  res.status(404).json({ jsonrpc: "2.0", error: { code: -32001, message: `Session not found: ${id}` }, id: null });

async function newConnection(req, res) {
  const server = createServer();
  const transport = new NodeStreamableHTTPServerTransport(
    STATELESS
      ? { sessionIdGenerator: undefined }
      : {
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (id) => sessions.set(id, { transport, server, last: Date.now() }),
          onsessionclosed: (id) => sessions.delete(id),
        },
  );
  transport.onclose = () => {
    if (transport.sessionId) sessions.delete(transport.sessionId);
    server.close().catch(() => {});
  };
  if (STATELESS) res.on("close", () => transport.close().catch(() => {}));
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}

app.post("/mcp", async (req, res) => {
  const id = req.header("mcp-session-id");
  if (!STATELESS && id) {
    const s = sessions.get(id);
    if (!s) return noSession(res, id);
    s.last = Date.now();
    return s.transport.handleRequest(req, res, req.body);
  }
  return newConnection(req, res);
});
app.get("/mcp", (req, res) => {
  const id = req.header("mcp-session-id");
  const s = !STATELESS && id ? sessions.get(id) : undefined;
  if (!s) return res.status(STATELESS ? 405 : 400).json({ error: STATELESS ? "Stateless mode: use POST /mcp" : "Missing or unknown Mcp-Session-Id" });
  s.last = Date.now();
  return s.transport.handleRequest(req, res);
});
app.delete("/mcp", (req, res) => {
  const id = req.header("mcp-session-id");
  const s = !STATELESS && id ? sessions.get(id) : undefined;
  if (!s) return res.status(STATELESS ? 405 : 404).end();
  return s.transport.handleRequest(req, res);
});

// Drop sessions nobody has used for a while.
if (!STATELESS) {
  setInterval(() => {
    const cutoff = Date.now() - SESSION_TTL_MS;
    for (const [id, s] of sessions) if (s.last < cutoff) { sessions.delete(id); s.transport.close().catch(() => {}); }
  }, 60 * 1000).unref();
}

const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  app.listen(PORT, HOST, () => console.log(`klerq-form MCP Apps server on http://${HOST}:${PORT}/mcp`));
}
export default app;
