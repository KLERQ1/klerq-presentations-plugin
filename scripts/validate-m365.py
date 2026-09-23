import json, os, sys
from jsonschema import Draft7Validator, Draft202012Validator
S = os.path.join(os.environ["TEMP"], "m365schemas")
pairs = [("m365/manifest.json", "teams.json"), ("m365/declarativeAgent.json", "da.json"), ("m365/klerq-plugin.json", "plugin.json")]
bad = 0
for doc, sch in pairs:
    schema = json.load(open(os.path.join(S, sch), encoding="utf-8"))
    data = json.load(open(doc, encoding="utf-8"))
    V = Draft202012Validator if "2020-12" in schema.get("$schema", "") else Draft7Validator
    errs = sorted(V(schema).iter_errors(data), key=lambda e: list(e.path))
    print(f"{doc} vs {sch}: {'VALID' if not errs else str(len(errs)) + ' error(s)'}")
    for e in errs[:8]:
        bad += 1
        print("   -", "/".join(str(p) for p in e.path) or "(root)", ":", e.message[:220])
sys.exit(1 if bad else 0)
