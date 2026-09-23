// Builds dist/brief.html and dist/form.html from the skill's form assets.
// The form code itself is untouched: only the data block and the send bridge
// are swapped for the MCP Apps protocol. Run: npm run build
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const assets = resolve(here, "..", "skills", "klerq-deck-builder", "assets");
const dist = resolve(here, "dist");
mkdirSync(dist, { recursive: true });

const bridge = readFileSync(resolve(here, "ui", "bridge.js"), "utf8");

const BASE_CSS = `:root{--radius:8px}html,body{margin:0;padding:0;background:transparent}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;font-size:14px}`;

function split(src) {
  const css = /<style>([\s\S]*?)<\/style>/.exec(src)[1];
  const body = /<\/style>([\s\S]*?)<script>/.exec(src)[1].trim();
  let js = /<script>([\s\S]*)<\/script>/.exec(src)[1];
  const demo = /\/\*DATA_START\*\/([\s\S]*?)\/\*DATA_END\*\//.exec(js)?.[1] ?? "{}";
  js = js.replace(/const DATA=\/\*DATA_START\*\/[\s\S]*?\/\*DATA_END\*\/;/, "");
  if (/DATA_START/.test(js)) throw new Error("data block not removed");
  return { css, body, js, demo };
}

function page({ title, mode, css, body, js, demo }) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>${BASE_CSS}</style><style>${css}</style></head>
<body>${body}
<script>window.KQ_MODE=${JSON.stringify(mode)};window.KQ_DEMO=${demo.trim()};
window.kqStart=function(DATA){${js}
};</script>
<script>${bridge}</script>
</body></html>`;
}

const form = split(readFileSync(resolve(assets, "form-template.html"), "utf8"));
writeFileSync(resolve(dist, "form.html"), page({ title: "KLERQ presentation form", mode: "form", ...form }));
const brief = split(readFileSync(resolve(assets, "brief-box.html"), "utf8"));
writeFileSync(resolve(dist, "brief.html"), page({ title: "KLERQ presentation brief", mode: "brief", ...brief }));

for (const f of ["form.html", "brief.html"]) console.log(f, readFileSync(resolve(dist, f)).length, "bytes");
