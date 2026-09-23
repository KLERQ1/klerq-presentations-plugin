// End-to-end check against a running server (npm start), acting as an MCP Apps host.
// Usage: node test.mjs [http://127.0.0.1:3033/mcp]
import assert from "node:assert/strict";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const url = new URL(process.argv[2] || "http://127.0.0.1:3033/mcp");
const UI_EXT = "io.modelcontextprotocol/ui";
const MIME = "text/html;profile=mcp-app";

async function connect(withUi) {
  const client = new Client(
    { name: withUi ? "test-host-with-ui" : "test-host-plain", version: "1.0.0" },
    withUi ? { capabilities: { extensions: { [UI_EXT]: { mimeTypes: [MIME] } } } } : {},
  );
  await client.connect(new StreamableHTTPClientTransport(url));
  return client;
}

const sample = {
  phase: "rest",
  brief: "We are preparing a presentation for Van Doorne about faster pitching.",
  ai: { general: "Client from your brief; title and summary suggested by Claude." },
  aiFields: ["client", "title", "about"],
  chapters: ["preface", "specialists", "highlights", "clients"],
  general: { client: "Van Doorne", title: "KLERQ for Van Doorne", about: "Faster pitching with KLERQ." },
  clients: ["Van Doorne", "Orka"],
  texts: [{ n: "Preface", src: "Meet KLERQ", c: "", cs: false, t: "KLERQ helps law firms pitch faster." }],
  textRecs: { preface: [0, "Neutral firm text."] },
  specialists: [{ n: "Jorn Vermeulen", r: "CEO", p: ["Law firm positioning"], b: [{ n: "English bio", st: "Approved", t: "Bio." }], rec: "Named in your brief" }],
  industries: [],
  highlights: [{ n: "Faster Pitching", v: "", c: "Ellex", cs: ["Ellex"], st: "Approved", conf: false, s: "Summary", ls: ["Jorn Vermeulen"], ss: [], sp: "Jorn Vermeulen", m: "Ellex", ms: "Completed", sd: "2025-01-01", ed: "", rec: "Fits the topic" }],
};

let failures = 0;
const check = (name, fn) => Promise.resolve().then(fn).then(() => console.log("ok  ", name)).catch((e) => { failures++; console.log("FAIL", name, "\n     ", e.message); });

// --- Host with MCP Apps support ---
const ui = await connect(true);

await check("tools/list exposes both form tools with ui metadata", async () => {
  const { tools } = await ui.listTools();
  const names = tools.map((t) => t.name).sort();
  assert.deepEqual(names, ["presentation_brief", "presentation_form"]);
  for (const t of tools) {
    assert.equal(t._meta?.ui?.resourceUri, `ui://klerq/${t.name === "presentation_brief" ? "brief" : "form"}.html`);
    assert.equal(t._meta?.["ui/resourceUri"], t._meta.ui.resourceUri, "legacy key kept for older hosts");
  }
});

await check("resources/list exposes the two ui:// pages", async () => {
  const { resources } = await ui.listResources();
  const uris = resources.map((r) => r.uri).sort();
  assert.deepEqual(uris, ["ui://klerq/brief.html", "ui://klerq/form.html"]);
  for (const r of resources) assert.equal(r.mimeType, MIME);
});

await check("resources/read returns the built form page", async () => {
  const { contents } = await ui.readResource({ uri: "ui://klerq/form.html" });
  const c = contents[0];
  assert.equal(c.mimeType, MIME);
  assert.match(c.text, /<!doctype html>/i);
  assert.match(c.text, /window\.kqStart=function\(DATA\)/);
  assert.match(c.text, /ui\/initialize/);
  assert.match(c.text, /window\.sendPrompt/);
  assert.doesNotMatch(c.text.split("window.kqStart")[1], /DATA_START/, "the template's sample data block must be gone");
  assert.ok(c.text.length > 40000 && c.text.length < 200000, `unexpected size ${c.text.length}`);
});

await check("resources/read returns the built brief page", async () => {
  const { contents } = await ui.readResource({ uri: "ui://klerq/brief.html" });
  assert.match(contents[0].text, /Your brief/);
  assert.match(contents[0].text, /window\.KQ_MODE="brief"/);
});

await check("presentation_brief with a UI host returns the open-box note", async () => {
  const r = await ui.callTool({ name: "presentation_brief", arguments: {} });
  assert.equal(r.isError, undefined);
  assert.match(r.content[0].text, /brief box is open/);
});

await check("presentation_form with a UI host echoes data in _meta, not in content", async () => {
  const r = await ui.callTool({ name: "presentation_form", arguments: { data: sample } });
  assert.equal(r.isError, undefined);
  assert.match(r.content[0].text, /form is open .*Van Doorne/);
  assert.deepEqual(r._meta?.["klerq/data"], sample);
  assert.ok(!r.content[0].text.includes("Jorn"), "content must not repeat the form data");
});

await check("presentation_form rejects a call without data", async () => {
  const r = await ui.callTool({ name: "presentation_form", arguments: {} }).catch((e) => ({ isError: true, content: [{ type: "text", text: e.message }] }));
  assert.equal(r.isError, true);
});

await ui.close();

// --- Host without MCP Apps support (e.g. a terminal client) ---
const plain = await connect(false);

await check("presentation_brief without declared UI support still opens, with the fallback hint", async () => {
  const r = await plain.callTool({ name: "presentation_brief", arguments: {} });
  assert.match(r.content[0].text, /brief box is open/);
  assert.match(r.content[0].text, /If the form is not visible/);
  assert.match(r.content[0].text, /plain chat mode/);
});

await check("presentation_form without declared UI support still carries the data and the hint", async () => {
  const r = await plain.callTool({ name: "presentation_form", arguments: { data: sample } });
  assert.match(r.content[0].text, /form is open/);
  assert.match(r.content[0].text, /If the form is not visible/);
  assert.deepEqual(r._meta?.["klerq/data"], sample);
});

await check("UI-capable host gets no fallback hint", async () => {
  const c = await connect(true);
  const r = await c.callTool({ name: "presentation_brief", arguments: {} });
  assert.doesNotMatch(r.content[0].text, /If the form is not visible/);
  const { tools } = await c.listTools();
  for (const t of tools) assert.deepEqual(t._meta?.ui?.visibility, ["model", "app"]);
  await c.close();
});

await plain.close();

console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exitCode = failures ? 1 : 0;
