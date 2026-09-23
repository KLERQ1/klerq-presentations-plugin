import http from "node:http";
import { readFileSync } from "node:fs";
const html = readFileSync(new URL("./mock-host.html", import.meta.url), "utf8");
http.createServer(async (req, res) => {
  if (req.url.startsWith("/preview/")) {
    const r = await fetch("http://127.0.0.1:3033" + req.url.replace(/\?.*$/, ""));
    res.writeHead(200, { "content-type": "text/html" }); res.end(await r.text()); return;
  }
  res.writeHead(200, { "content-type": "text/html" }); res.end(html);
}).listen(3034, "127.0.0.1", () => console.log("mock host on http://127.0.0.1:3034/"));
