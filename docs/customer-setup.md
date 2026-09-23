# Setting up the KLERQ deck builder for a customer

Every KLERQ workspace has its own MCP address: `https://<workspace>.mcp.klerq.app/mcp`, where
`<workspace>` is the label the customer already uses in `<workspace>.klerq.app`. The packages
in this repo point at KLERQ's own workspace by default; build a customer's packages with the
`--tenant` option and hand them the steps below. Signing in always happens in the customer's
own browser with their own KLERQ account; nothing in the packages holds credentials.

## Build the customer's packages

```bash
python scripts/build-claude-zip.py  --tenant <workspace>
python scripts/build-chatgpt-zip.py --tenant <workspace> [klerq=asdk_app_…]
python scripts/build-m365-zip.py    --tenant <workspace> --auth-ref <auth config id>
```

Each writes `…-<workspace>.zip` next to the repo folder. For Copilot the auth config id is
per customer too (see below).

## Claude

Two options; the first needs nothing built.

**A. Add the connector by URL** (Claude Team or Enterprise; an admin, or any user if the org
allows it):

1. In Claude, open Settings → Connectors → Add custom connector.
2. Name: KLERQ. URL: `https://<workspace>.mcp.klerq.app/mcp`. Save.
3. Click Connect and sign in with the KLERQ account when the KLERQ login opens.
4. Tell Claude "build a presentation for [client]". The deck-builder skill is not part of a
   connector, so without the plugin Claude follows the server's own instructions and asks the
   chapters in chat, or shows the form once the server serves it.

**B. Install the plugin zip** (`klerq-presentations-plugin-<workspace>.zip`): upload it under
Settings → Plugins. It carries the skill and the connector URL; the first KLERQ call opens
the sign-in.

## ChatGPT

1. Settings → Security and login → turn on Developer mode.
2. Open chatgpt.com/plugins, press the plus button, name it KLERQ and enter the URL
   `https://<workspace>.mcp.klerq.app/mcp`. Choose OAuth; no client id or secret is needed
   (the server registers the client itself). Sign in with the KLERQ account when prompted.
3. Optional, for the deck-builder skill: open the new app, copy the id from the address bar
   (`plugin_asdk_app_…`), send it to KLERQ. KLERQ builds
   `klerq-deck-builder-chatgpt-<workspace>.zip` with that id and the customer uploads it under
   Plugins. Without the zip, `@KLERQ` in a chat already gives access to all tools.

## Microsoft 365 Copilot

Requires a Microsoft 365 Copilot license (or pay-as-you-go billing) for the users.

1. **OAuth registration, once per customer.** In the Teams developer portal
   (dev.teams.microsoft.com → Tools → OAuth client registration) create a registration with
   Base URL `https://<workspace>.mcp.klerq.app/mcp`, the KLERQ OAuth endpoints
   (`/auth`, `/token`, `/token`), scope `openid offline_access`, PKCE on, "Restrict usage by
   app" = Any Teams app. The client id and secret come from registering a client at
   `https://<workspace>.mcp.klerq.app/reg` with redirect URL
   `https://teams.microsoft.com/api/platform/v1.0/oAuthRedirect`. The portal returns the
   auth config id used in the build command above. This can be done by KLERQ (registration
   restricted to the customer's organization) or by the customer's own admin.
2. **Upload.** In the Microsoft 365 admin center: Copilot → Agents → Upload custom agent →
   choose `klerq-deck-builder-m365-<workspace>.zip` → assign users → Finish deployment.
3. In Copilot, pick "KLERQ deck builder" under Agents and sign in to KLERQ on the first call.

## When the form appears

The brief box and chapter form are MCP Apps served by the KLERQ server. They render inline
in Claude, ChatGPT and Microsoft 365 Copilot once the server release with the form tools is
live for that workspace; until then each client asks the chapters in chat.
