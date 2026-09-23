"""Build the Claude package of this plugin (the whole repo minus git and build output).

Usage (from the repo root):
    python scripts/build-claude-zip.py                 # KLERQ's own workspace
    python scripts/build-claude-zip.py --tenant acme   # a customer's workspace (acme.mcp.klerq.app)

Output: ../klerq-presentations-plugin[-<tenant>].zip next to the repo folder (Desktop).
"""
import json, pathlib, sys, zipfile
from tenant import mcp_url, out_name, parse_tenant

ROOT = pathlib.Path(__file__).resolve().parent.parent
TENANT, _ = parse_tenant(sys.argv[1:])
OUT = ROOT.parent / out_name("klerq-presentations-plugin", TENANT)
SKIP_DIRS = {".git", "node_modules", "__pycache__", "dist"}

if OUT.exists():
    OUT.unlink()
with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
    for p in sorted(ROOT.rglob("*")):
        rel = p.relative_to(ROOT)
        if not p.is_file() or SKIP_DIRS & set(rel.parts):
            continue
        name = rel.as_posix()
        if name in (".mcp.json", "mcp.json"):
            d = json.loads(p.read_text(encoding="utf-8"))
            d["mcpServers"]["klerq"]["url"] = mcp_url(TENANT)
            z.writestr(name, json.dumps(d, indent=2) + "\n")
        else:
            z.write(p, name)
    names = z.namelist()
print(f"wrote {OUT} ({OUT.stat().st_size} bytes, {len(names)} entries); workspace: {mcp_url(TENANT)}")
