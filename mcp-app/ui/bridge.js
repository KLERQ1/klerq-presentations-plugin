// MCP Apps bridge for the KLERQ form pages (plain JS, no dependencies).
// Implements the view side of the MCP Apps protocol (2026-01-26) over
// window.postMessage: the ui/initialize handshake, tool-input / tool-result
// notifications, size reporting, and ui/message to send the answers back.
// It replaces the Claude widget's sendPrompt() so the form code stays untouched.
(function () {
  var MODE = window.KQ_MODE || "form";
  var PROTOCOL = "2026-01-26";
  var host = window.parent;
  var started = false;
  var connected = false;
  var nextId = 1;
  var pending = {};

  function el() { return document.getElementById("app"); }
  function fail(msg) { var a = el(); if (a && !started) a.textContent = msg; }

  function start(data) {
    if (started) return;
    started = true;
    try { window.kqStart(data || {}); }
    catch (e) { console.error(e); var a = el(); if (a) a.textContent = "The form could not start: " + (e && e.message); }
  }

  function pick(args) {
    if (!args) return null;
    var d = args.data;
    if (typeof d === "string") { try { d = JSON.parse(d); } catch (e) { d = null; } }
    if (d && typeof d === "object") return d;
    if (MODE === "brief") return { brief: typeof args.brief === "string" ? args.brief : "" };
    return null;
  }

  function post(msg) { try { host.postMessage(msg, "*"); } catch (e) { console.error(e); } }
  function notify(method, params) { post({ jsonrpc: "2.0", method: method, params: params || {} }); }
  function request(method, params) {
    return new Promise(function (resolve, reject) {
      var id = nextId++;
      pending[id] = { resolve: resolve, reject: reject };
      post({ jsonrpc: "2.0", id: id, method: method, params: params || {} });
    });
  }
  function reply(id, result) { post({ jsonrpc: "2.0", id: id, result: result }); }
  function replyError(id, code, message) { post({ jsonrpc: "2.0", id: id, error: { code: code, message: message } }); }

  window.addEventListener("message", function (ev) {
    var m = ev.data;
    if (!m || m.jsonrpc !== "2.0") return;
    if (m.id !== undefined && m.method === undefined) {
      var p = pending[m.id];
      if (!p) return;
      delete pending[m.id];
      if (m.error) p.reject(m.error); else p.resolve(m.result);
      return;
    }
    var params = m.params || {};
    switch (m.method) {
      case "ping": reply(m.id, {}); break;
      case "ui/resource-teardown": reply(m.id, {}); break;
      case "ui/notifications/tool-input": { var d = pick(params.arguments); if (d) start(d); break; }
      case "ui/notifications/tool-result": {
        var meta = params._meta || {};
        var r = meta["klerq/data"] || (params.structuredContent && params.structuredContent.data);
        if (r) start(r); else if (MODE === "brief") start({});
        break;
      }
      case "ui/notifications/tool-cancelled": fail("The tool call was cancelled."); break;
      case "ui/notifications/host-context-changed": break;
      default:
        if (m.id !== undefined) replyError(m.id, -32601, "Method not found: " + m.method);
    }
  });

  // Report our height so the host can size the iframe (autoResize equivalent).
  function watchSize() {
    var lastW = 0, lastH = 0, queued = false;
    function measure() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () {
        queued = false;
        var de = document.documentElement, saved = de.style.height;
        de.style.height = "max-content";
        var h = Math.ceil(de.getBoundingClientRect().height);
        de.style.height = saved;
        var w = Math.ceil(window.innerWidth);
        if (w !== lastW || h !== lastH) { lastW = w; lastH = h; notify("ui/notifications/size-changed", { width: w, height: h }); }
      });
    }
    measure();
    if (window.ResizeObserver) { var ro = new ResizeObserver(measure); ro.observe(document.documentElement); ro.observe(document.body); }
    else setInterval(measure, 500);
  }

  // The form calls sendPrompt(text) when the user presses Continue on the last step.
  window.sendPrompt = function (text) {
    var note = function (msg) { var s = document.getElementById("sm"); if (s) s.textContent = msg; };
    if (!connected) { note("Not connected to the chat. Copy the text below and paste it into the chat."); return; }
    request("ui/message", { role: "user", content: [{ type: "text", text: text }] })
      .then(function (res) { if (res && res.isError) note("The chat did not accept the message. Copy the text below and paste it into the chat."); })
      .catch(function () { note("Couldn't send automatically. Copy the text below and paste it into the chat."); });
  };

  var demo = /(?:\?|&)demo(?:=|&|$)/.test(location.search);
  if (demo || host === window) {
    // Opened directly in a browser: show the form with the sample data.
    start(MODE === "brief" ? {} : window.KQ_DEMO || {});
    return;
  }

  request("ui/initialize", { appInfo: { name: "klerq-presentation-" + MODE, version: "1.0.0" }, appCapabilities: {}, protocolVersion: PROTOCOL })
    .then(function () {
      connected = true;
      notify("ui/notifications/initialized", {});
      watchSize();
      // The brief box needs no data: show it as soon as the host is ready,
      // unless a tool-input notification already started it with a prefill.
      if (MODE === "brief") setTimeout(function () { start({}); }, 300);
    })
    .catch(function (e) {
      console.error(e);
      fail("This chat client could not connect the form. Continue in the chat instead.");
    });
  // Some hosts send tool-input before initialize completes; the listener above handles it either way.
})();
