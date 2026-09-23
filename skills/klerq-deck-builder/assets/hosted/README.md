# Hosted form script (fast mode)

Without hosting, Claude writes the whole form (~50 KB of code) into the chat on every run, which is the slowest part of the skill. With hosting, Claude only writes a tiny loader plus the KLERQ data, and the browser downloads the form code from a CDN.

The chat widget may only load scripts from cdn.jsdelivr.net, unpkg.com, esm.sh and cdnjs.cloudflare.com, so the file has to be published through one of those.

## Publish (one time, then again after every template change)

1. Run `python scripts/build.py` in the skill folder. It rebuilds `assets/hosted/klerq-form.js` from `assets/form-template.html`.
2. Put `klerq-form.js` in a **public** GitHub repository (it contains only form code, no client data), e.g. `klerq/deck-form`.
3. Create a release tag, e.g. `v1.0.0`.
4. The file is now at `https://cdn.jsdelivr.net/gh/klerq/deck-form@v1.0.0/klerq-form.js`.
   (Alternative: publish it as an npm package and use `https://cdn.jsdelivr.net/npm/<package>@<version>/klerq-form.js`.)
5. Put that URL in `assets/config.json` as `hostedScriptUrl` and re-save the skill.

Always use a fixed version tag, never `@latest` or a branch, so a change to the file can't silently break running forms. After changing the template, publish a new tag and update the URL.
