"""Build the ChatGPT / Codex package of this plugin.

ChatGPT validates more than the portable Agent Plugins format: it needs an
`extensions.com.openai.interface` block (display name, descriptions, category,
two square images) and, when the plugin uses MCP servers, an `.app.json` that
maps each server to the app you registered in ChatGPT developer mode.

Usage (from the repo root):
    python scripts/build-chatgpt-zip.py                       # KLERQ's own workspace, no app mapping
    python scripts/build-chatgpt-zip.py --tenant acme         # a customer's workspace (acme.mcp.klerq.app)
    python scripts/build-chatgpt-zip.py --tenant acme klerq=asdk_app_xxx

Output: ../klerq-deck-builder-chatgpt[-<tenant>].zip next to the repo folder (Desktop).
"""
from tenant import parse_tenant, mcp_url, out_name
import json, re, sys, zipfile, pathlib
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
TENANT, ARGS = parse_tenant(sys.argv[1:])
OUT = ROOT.parent / out_name("klerq-deck-builder-chatgpt", TENANT)
DARK = (28, 37, 48)  # KLERQ card background #1C2530

# --- app ids from the command line: name=id ---
apps = {}
for arg in ARGS:
    m = re.fullmatch(r"([a-z0-9-]+)=(\S+)", arg)
    if not m:
        sys.exit(f"bad argument {arg!r}: expected name=id")
    name, app_id = m.groups()
    app_id = re.sub(r"^plugin_", "", app_id)  # the URL shows plugin_asdk_app_…, the mapping wants asdk_app_…
    if not re.match(r"^(asdk_app_|connector_|templated_apps_)[A-Za-z0-9]", app_id):
        sys.exit(f"app id for {name} must start with asdk_app_, connector_ or templated_apps_: {app_id}")
    apps[name] = {"id": app_id}

# --- square images from the KLERQ logo ---
src = Image.open(ROOT / "assets" / "klerq-logo-source.png").convert("RGBA")
def square(size, pad_ratio):
    canvas = Image.new("RGBA", (size, size), DARK + (255,))
    inner = int(size * (1 - 2 * pad_ratio))
    im = src.copy()
    im.thumbnail((inner, inner), Image.LANCZOS)
    canvas.alpha_composite(im, ((size - im.width) // 2, (size - im.height) // 2))
    return canvas.convert("RGB")
(ROOT / "assets").mkdir(exist_ok=True)
square(512, 0.18).save(ROOT / "assets" / "logo.png")
square(256, 0.22).save(ROOT / "assets" / "icon.png")

# --- manifest: the portable one plus the OpenAI extension ---
base = json.loads((ROOT / "plugin.json").read_text(encoding="utf-8"))
openai = {
    "interface": {
        "displayName": "KLERQ deck builder",
        "shortDescription": "Build client pitches from KLERQ content",
        "longDescription": (
            "Build a client presentation from what your firm already has in KLERQ: matters, work highlights, "
            "specialist bios, client references and texts from earlier pitches. Give a short brief, choose the "
            "content chapter by chapter, and the presentation is created in KLERQ and exported to PowerPoint.\n\n"
            "Requires access to your firm's KLERQ workspace."
        ),
        "developerName": "KLERQ",
        "category": "Business & Operations",
        "capabilities": ["Interactive", "Read", "Write"],
        "websiteURL": "https://klerq.io",
        "privacyPolicyURL": "https://klerq.io/security#compliance-documents",
        "termsOfServiceURL": "https://klerq.io/security#compliance-documents",
        "screenshots": [],
        "defaultPrompt": [
            "Build a presentation for Van Doorne about faster pitching",
            "Put a pitch together for a prospect with our directory submission experience",
        ],
        "brandColor": "#5FB4BE",
        "composerIcon": "./assets/icon.png",
        "logo": "./assets/logo.png",
    }
}
if apps:
    openai["apps"] = "./.app.json"
manifest = dict(base)
manifest.setdefault("author", {"name": "KLERQ", "url": "https://klerq.io"})
manifest.setdefault("homepage", "https://klerq.io")
manifest.setdefault("repository", "https://github.com/KLERQ1/klerq-presentations-plugin")
manifest["extensions"] = {"com.openai": openai}

# --- zip: portable files only, no Claude-specific files, no server code ---
if OUT.exists():
    OUT.unlink()
with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
    z.writestr("plugin.json", json.dumps(manifest, indent=2) + "\n")
    mcp = json.loads((ROOT / "mcp.json").read_text(encoding="utf-8"))
    mcp["mcpServers"]["klerq"]["url"] = mcp_url(TENANT)
    z.writestr("mcp.json", json.dumps(mcp, indent=2) + "\n")
    if apps:
        z.writestr(".app.json", json.dumps({"apps": apps}, indent=2) + "\n")
    z.write(ROOT / "README.md", "README.md")
    z.write(ROOT / "assets" / "logo.png", "assets/logo.png")
    z.write(ROOT / "assets" / "icon.png", "assets/icon.png")
    for p in sorted((ROOT / "skills").rglob("*")):
        if p.is_file():
            z.write(p, p.relative_to(ROOT).as_posix())
    names = z.namelist()
print(f"wrote {OUT} ({OUT.stat().st_size} bytes, {len(names)} entries)")
print("workspace:", mcp_url(TENANT))
print("app mapping:", json.dumps(apps) if apps else "none (register the KLERQ MCP server in ChatGPT and pass klerq=<id>)")
for n in names:
    if "/" not in n or n.startswith("assets/"):
        print(" ", n)
