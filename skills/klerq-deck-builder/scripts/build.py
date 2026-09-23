"""Build the minified inline form and the hosted script from assets/form-template.html.
Run after every change to the template:  python scripts/build.py"""
import re, subprocess, pathlib, tempfile, json
root = pathlib.Path(__file__).resolve().parent.parent / "assets"
src = (root / "form-template.html").read_text()
css = re.search(r"<style>(.*?)</style>", src, re.S).group(1)
body = re.search(r"</style>(.*?)<script>", src, re.S).group(1).strip()
js = re.search(r"<script>(.*)</script>", src, re.S).group(1)
js = re.sub(r"const DATA=/\*DATA_START\*/[\s\S]*?/\*DATA_END\*/;", "", js, count=1)
def run(cmd, text):
    with tempfile.NamedTemporaryFile("w", suffix=".tmp", delete=False) as f:
        f.write(text); name = f.name
    return subprocess.run(cmd + [name], capture_output=True, text=True, check=True).stdout.strip()
mcss = run(["csso"], css)
mjs = run(["terser", "--compress", "--mangle", "--"], js)
hosted = ("(function(){var s=document.createElement('style');s.textContent=" + json.dumps(mcss) +
          ";document.head.appendChild(s);})();\nvar DATA=window.KQ_DATA||{};\n" + mjs + "\n")
(root / "hosted" / "klerq-form.js").write_text(hosted)
loader = (body +
          '\n<script>window.KQ_DATA=/*DATA_START*/{}/*DATA_END*/;</script>\n<script src="{{HOSTED_URL}}"></script>\n')
(root / "hosted" / "loader.html").write_text(loader)
print("hosted script:", len(hosted), "bytes | loader without data:", len(loader), "bytes | inline template:", len(src), "bytes")
