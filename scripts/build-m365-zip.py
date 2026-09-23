"""Build the Microsoft 365 Copilot app package (declarative agent + MCP plugins).

Usage (from the repo root):
    python scripts/build-m365-zip.py --auth-ref <auth config id>                 # KLERQ's own workspace
    python scripts/build-m365-zip.py --tenant acme --auth-ref <that customer's auth config id>
    python scripts/build-m365-zip.py --app-id <guid>                             # override the app id

Every workspace has its own MCP address (<tenant>.mcp.klerq.app) and therefore its own
OAuth client registration in the Teams developer portal (its Base URL is that address), so
a customer package needs that customer's auth config id. The app id is derived from the
tenant so packages for different customers never collide.

Output: ../klerq-deck-builder-m365[-<tenant>].zip next to the repo folder (Desktop).
Files go at the ZIP ROOT (no folder inside), as the admin center expects.
"""
import argparse, json, pathlib, re, sys, uuid, zipfile
from PIL import Image
from tenant import mcp_url, mcp_host, out_name, UNIVERSAL

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "m365"
FILES = ["manifest.json", "declarativeAgent.json", "klerq-plugin.json", "klerq-tools.json", "color.png", "outline.png"]

ap = argparse.ArgumentParser()
ap.add_argument("--auth-ref", help="OAuthPluginVault reference_id (auth config id) for the KLERQ MCP server")
ap.add_argument("--app-id", help="App id GUID for manifest.json")
ap.add_argument("--tenant", help="Workspace label: the package points at <tenant>.mcp.klerq.app (default: klerq)")
ap.add_argument("--universal", action="store_true", help="Point at the universal address mcp.klerq.app (once the server supports it)")
args = ap.parse_args()
if args.universal:
    args.tenant = "universal"
TENANT = args.tenant or "klerq"
OUT = ROOT.parent / out_name("klerq-deck-builder-m365", args.tenant)

errors, warnings = [], []
def load(name):
    try:
        return json.loads((SRC / name).read_text(encoding="utf-8"))
    except Exception as e:
        errors.append(f"{name}: invalid JSON ({e})"); return None

manifest, agent, klerq, tools = (load(n) for n in FILES[:4])
if errors:
    sys.exit("\n".join(errors))

# --- workspace ---
klerq["runtimes"][0]["spec"]["url"] = mcp_url(TENANT)
manifest["validDomains"] = [mcp_host(TENANT)]
if args.tenant and args.tenant != UNIVERSAL:
    # Stable per-tenant app id, so two customers' packages are distinct apps.
    # The universal package keeps the manifest's own id: it is the one AppSource listing.
    manifest["id"] = str(uuid.uuid5(uuid.NAMESPACE_DNS, mcp_host(TENANT)))

# --- overrides ---
if args.app_id:
    if not re.fullmatch(r"[0-9a-fA-F-]{36}", args.app_id): sys.exit("--app-id must be a GUID")
    manifest["id"] = args.app_id
if args.auth_ref:
    klerq["runtimes"][0]["auth"] = {"type": "OAuthPluginVault", "reference_id": args.auth_ref}

# --- checks the admin center / Copilot validator would also make ---
ref = klerq["runtimes"][0]["auth"].get("reference_id", "")
if ref.startswith("REPLACE"):
    warnings.append("klerq-plugin.json: auth reference_id is still the placeholder; the KLERQ actions will fail until you pass --auth-ref")
for k in ("version", "id", "developer", "name", "description", "icons", "accentColor", "copilotAgents"):
    if k not in manifest: errors.append(f"manifest.json: missing {k}")
for k in ("privacyUrl", "termsOfUseUrl", "websiteUrl", "name"):
    if not manifest.get("developer", {}).get(k): errors.append(f"manifest.json: developer.{k} missing")
if len(manifest["name"]["short"]) > 30: errors.append("manifest.json: name.short over 30 characters")
if len(manifest["description"]["short"]) > 80: errors.append("manifest.json: description.short over 80 characters")
if len(manifest["description"]["full"]) > 4000: errors.append("manifest.json: description.full over 4000 characters")
da = manifest["copilotAgents"]["declarativeAgents"][0]
if da["file"] != "declarativeAgent.json": errors.append("manifest.json: declarative agent file name mismatch")
if agent.get("version") != "v1.8": errors.append("declarativeAgent.json: version must be v1.8")
n = len(agent.get("instructions", ""))
if n == 0 or n > 8000: errors.append(f"declarativeAgent.json: instructions must be 1-8000 characters (is {n})")
if len(agent.get("name", "")) > 100: errors.append("declarativeAgent.json: name over 100 characters")
if len(agent.get("description", "")) > 1000: errors.append("declarativeAgent.json: description over 1000 characters")
if len(agent.get("conversation_starters", [])) > 12: errors.append("declarativeAgent.json: more than 12 conversation starters")
for a in agent.get("actions", []):
    if not (SRC / a["file"]).exists(): errors.append(f"declarativeAgent.json: action file {a['file']} missing")
for name, pl in (("klerq-plugin.json", klerq),):
    if pl.get("schema_version") != "v2.4": errors.append(f"{name}: schema_version must be v2.4")
    if not re.fullmatch(r"[A-Za-z0-9]+", pl.get("namespace", "")): errors.append(f"{name}: namespace must match ^[A-Za-z0-9]+$")
    if len(pl.get("name_for_human", "")) > 20: warnings.append(f"{name}: name_for_human beyond 20 characters may be truncated")
    if len(pl.get("description_for_human", "")) > 100: warnings.append(f"{name}: description_for_human beyond 100 characters may be truncated")
    fnames = [f["name"] for f in pl.get("functions", [])]
    for f in fnames:
        if not re.fullmatch(r"[A-Za-z0-9_]+", f): errors.append(f"{name}: function name {f} invalid")
    rt = pl["runtimes"][0]
    if rt["type"] != "RemoteMCPServer": errors.append(f"{name}: runtime type must be RemoteMCPServer")
    if not rt["spec"]["url"].startswith("https://"): errors.append(f"{name}: MCP url must be https")
    if rt.get("run_for_functions") == ["*"]:
        if pl.get("functions"): errors.append(f"{name}: dynamic tool discovery needs an empty functions array")
        if rt["spec"].get("mcp_tool_description"): errors.append(f"{name}: dynamic tool discovery must not pin tool descriptions")
        continue
    desc = rt["spec"].get("mcp_tool_description", {})
    tlist = desc.get("tools") or (tools["tools"] if desc.get("file") == "klerq-tools.json" else [])
    tnames = [t["name"] for t in tlist]
    for t in tlist:
        for k in ("name", "description", "inputSchema"):
            if k not in t: errors.append(f"{name}: tool {t.get('name')} lacks {k}")
    for f in rt.get("run_for_functions", []):
        if f not in fnames: errors.append(f"{name}: run_for_functions names unknown function {f}")
        if f not in tnames: errors.append(f"{name}: function {f} has no static tool description")
    for f in fnames:
        if f not in tnames: errors.append(f"{name}: function {f} missing from tool descriptions")
for fname, size, mode in (("color.png", (192, 192), None), ("outline.png", (32, 32), "RGBA")):
    im = Image.open(SRC / fname)
    if im.size != size: errors.append(f"{fname}: must be {size[0]}x{size[1]}, is {im.size}")
    if mode and im.mode != mode: errors.append(f"{fname}: must have transparency ({mode})")

for w in warnings: print("warning:", w)
if errors:
    print("\n".join("error: " + e for e in errors)); sys.exit(1)

# --- zip: flat, files at the root ---
if OUT.exists(): OUT.unlink()
with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
    z.writestr("manifest.json", json.dumps(manifest, indent=2) + "\n")
    z.writestr("klerq-plugin.json", json.dumps(klerq, indent=2) + "\n")
    for f in ("declarativeAgent.json", "klerq-tools.json", "color.png", "outline.png"):
        z.write(SRC / f, f)
    names = z.namelist()
print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")
for nme in names: print(" ", nme)
print(f"workspace: {mcp_url(TENANT)}; instructions: {n} characters; app id {manifest['id']}; KLERQ auth: {klerq['runtimes'][0]['auth']}")
