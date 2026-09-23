# Form mode

Contents: 0. App form mode (MCP Apps) · 1. Data gathering · 2. Filling the template · 3. Rendering rules · 4. The answer message · 5. Creating the record · 6. Known gaps

## 0. App form mode (MCP Apps: Claude.ai, ChatGPT, VS Code Copilot and others)

When the tools `presentation_brief` and `presentation_form` are in your tool list, the form is served by the KLERQ form server and rendered by the chat client itself. Everything else in this file still applies (what data to gather, how to prefill from the brief, what the answer messages look like, how to create the record); only the rendering changes:

- **Box 1:** call `presentation_brief` with no arguments (or `brief` to prefill it) before any KLERQ call, with at most one short sentence before it. Then load all KLERQ data in the same turn and end the turn with one line. The brief arrives as a chat message starting with `[Presentation form] Brief`.
- **Box 2:** on that message, build the same data JSON as in section 2 (with `"phase": "rest"`, `brief`, `general`, `ai`, `aiFields`, `chapters`, `pricing`, `textIns`, `aiDrafts`, `bioDrafts`, `bioPick`, `clients`, `texts`, `textRecs`, `specialists`, `industries`, `highlights`) and call `presentation_form` with it as the `data` argument, as a JSON object, not a string. No template, no `DATA_START` block, no `hostedScriptUrl`. The client shows the form; the tool result tells you it is open. Do not repeat the form's contents in chat; end the turn with one short line. The answers arrive as a chat message starting with `[Presentation form] Approve`, exactly as in section 4.
- **No ids:** the data goes to the client's sandbox, so the rule that record ids never enter the form still holds.
- **Fallback:** if either tool answers that this client cannot show the form, do not retry; continue in plain chat mode (numbered questions per chapter) for the rest of the run.
- **Size:** the data JSON is sent once as a tool argument, so keep drafts short (see section 2) and load at most what the form needs.

## 1. Data gathering

Keep a private name → id table as you go; ids never go into the form.

**Speed.** Loading time is almost entirely one-by-one calls, so:
- Render box 1 (the brief) before any call; then everything below happens in the same turn.
- Batch 0: `find_clients`, `find_presentations`, `find_specialists`, `find_matters` together in one block.
- Issue independent calls **in parallel**: put all calls of a batch in one tool-call block. Batch 1: every `specialists_get`, every `matter_overview` and the `presentations_get` calls together (split into blocks of about 10–15 if there are many).
- Read at most 5 recent presentations for texts, plus all presentations for the pitched client if it's known. Never loop sequentially over records.
- Don't re-fetch what you already have when box 2 renders; only add the pitched client's presentations if they're missing.

- **Clients:** `find_clients` (limit 200) without `includeArchived`. All active names go in `clients`, as-is (including test or placeholder clients).
- **Organisation texts (always check first):** run `tool_search` for KLERQ tools that list or read organisation descriptions / texts (e.g. query "KLERQ descriptions organisation texts"). If one exists, load every organisation text in every language and status, in the same parallel batch as the other searches. Add each to `texts` with `o: true`, `n` = its title, `src` = "Organisation text" plus its category if KLERQ has one ("Organisation text · Descriptions"), `st` = its status ("Approved"/"Draft"), `lang` = a short language label ("EN", "NL"), `c` = "" and `cs` = false unless it is clearly about one client. Remember its id for the record. If no such tool exists, skip this and say nothing about it in the chat.
- **Texts from earlier presentations (preface, scope of work, firm, team, description slide):** use `find_presentations` (e.g. statuses SENT, REVIEW, CLOSING, CLOSED_WON, CLOSED_LOST) and `presentations_get` on a handful of recent ones, including different titles. Take every non-empty `description` chapter's content, convert the Tiptap content to plain text (bullets as "• "), and add it to `texts` with `src` = presentation title (plus client when titles repeat). Skip exact duplicates of the same text. Tag every text with `c` = the client of the presentation it came from ("" if none) and `cs` = true if the text is written specifically for that client (mentions them, their matters, their situation), false if it's a neutral firm/team/approach text that fits any pitch. Judge `cs` by reading the text; when in doubt, set true. Also look specifically for earlier presentations for the pitched client (filter `find_presentations` by that client) so same-client texts are available. Remember which presentation and chapter each text came from, so you can copy the original Tiptap JSON when creating the record.
- **Specialists:** `find_specialists` without `includeArchived` (active only; drop any result that still comes back with `archived: true`), then `specialists_get` for each one to get role, practices, industries and bios (all bio versions, with status Approved/Draft). Remember each bio's content id (`bios[].content[].id`) for `bioContentId`.
- **Practices:** union of the specialists' practices (names + ids). The form derives the list from `specialists[].p`.
- **Industries:** union of industries on specialists (and highlights, if returned). If there are none, `industries` stays empty and the form leaves the chapter out.
- **Work highlights:** `find_matters` (limit 200) without `includeArchived`, so archived matters and their highlights are never loaded; also skip any matter or highlight flagged `archived: true`. Then call `matter_overview` for every remaining matter, all in one parallel block: it returns the matter and its highlights in one call, with every field the highlight filters need. Per highlight fill: `n` title, `v` version label when titles repeat ("version 1", "version 2"… in a stable order), `c` first matter client and `cs` all matter clients, `st` highlight status ("Approved"/"Draft", no confidential suffix), `conf` = `isConfidential`, `s` summary, `ls` lead specialist names and `ss` supporting specialist names (arrays), `sp` all of them comma-separated (used by the Specialists filter), `m` matter internal name, `ms` matter status ("Ongoing"/"Completed"), `sd`/`ed` start and end date as YYYY-MM-DD (the highlight's own dates, else the matter's), `dv`/`dvl`/`dvu` deal value and its lower/upper bound as numbers, `xb` = `isCrossBorder`. Also fill `ind`, `pr`, `of` (industries, practices, offices), `wl` (work highlight labels) and `ml` (matter labels) as arrays of names whenever KLERQ returns them (via `matters_get`/`work_highlights_get` if `matter_overview` lacks them); leave them out when the connector doesn't expose them — the form then shows that filter as "(none in KLERQ data)".

## 2. Filling the template

Copy `assets/form-template.html` and replace only the JSON between `/*DATA_START*/` and `/*DATA_END*/`. Everything else is tested; don't restyle or rewrite it. That includes the chapter logic: the template has no skip button for General information and shows it as a fixed, always-included first row in the overview. Don't add a skip for it or move it out of first place. The data block is plain JSON:

```json
{
 "phase": "rest",
 "brief": "The user's brief, verbatim",
 "ai": {"general": "Client, title and topic from your brief.", "pricing": "Fixed fee of EUR 50,000, as in your brief."},
 "aiFields": ["client", "title", "about"],
 "chapters": ["preface", "scope", "firm", "specialists", "pricing", "practices", "highlights", "clients"],
 "pricing": {"desc": "Fixed fee of EUR 50,000 for the full engagement, shown in a table with one row per phase."},
 "textIns": {"scope": "Focus on onboarding and training, as described in the brief"},
 "aiDrafts": {"preface": "Full draft text…", "scope": "Full draft text…", "firm": "Full draft text…"},
 "bioDrafts": {"Jorn Vermeulen": "Tailored bio…"},
 "bioPick": {"Jorn Vermeulen": "ai"},
 "general": {"client": "Van Doorne", "title": "KLERQ for Van Doorne: pitching and submissions in one place", "about": "Proposal to centralise Van Doorne's commercial data in KLERQ and speed up pitches and directory submissions."},
 "clients": ["AKD", "Van Doorne"],
 "texts": [{"n": "Directory strategy preface", "src": "Orka legal directory pitch", "c": "Orka", "cs": false, "t": "Full plain text…"}],
 "textRecs": {"preface": [0, "Why"], "scope": ["d", "Why a draft fits"], "firm": [1, "Why"]},
 "specialists": [{"n": "Jorn Vermeulen", "r": "CEO", "p": ["Law firm positioning"],
   "b": [{"n": "English bio", "st": "Approved", "t": "Full bio text"}], "rec": "Why (empty string = not recommended)"}],
 "industries": [{"n": "Energy", "rec": ""}],
 "highlights": [{"n": "Title", "v": "", "c": "Client", "cs": ["Client"], "st": "Approved", "conf": false, "s": "Summary", "ls": ["Lead name"], "ss": ["Supporting name"], "sp": "Lead name, Supporting name", "m": "Matter internal name", "ms": "Ongoing", "sd": "2025-01-01", "ed": "", "dv": 25000, "dvl": 20000, "dvu": 30000, "xb": false, "ind": [], "pr": [], "of": [], "wl": [], "ml": [], "rec": ""}]
}
```

- Box 1 uses `assets/brief-box.html`, not this template. It needs no data (leave `brief` empty) and sends `[Presentation form] Brief` followed by the user's text.
- `phase`: `"rest"` for box 2. Omit it (and `brief`) only for the fallback single form with everything, if box 1 failed to render.
- Prefill `general` with whatever the user already said (client, title, topic). Title and about are never left empty: when the brief doesn't give them, fill in Claude's suggestion (see Prefilling from the brief).
- `textRecs` values: an index into `texts`, or `"d"` to recommend drafting. Always include a reason. Prefer a fitting organisation text over an earlier-presentation text. Never recommend a text with `cs: true` from another client, or one that names another client; prefer same-client texts, then neutral ones, else `"d"`.
- The form hides, for the selected client, every text that has `cs: true` for a different client or that names any other KLERQ client, shows a count of hidden texts, puts same-client texts first with a "Same client" tag, and re-checks everything when the client field changes. This is on top of your tagging, not a replacement for it.
- Specialists with a non-empty `rec` are pre-ticked; the first becomes lead, the rest supporting.
- Highlights with a non-empty `rec` are pre-ticked. Recommend three to five, ranked by fit with the client and topic.
- Keep strings valid JSON (escape `"` and newlines as `\n`). Strip trailing spaces from names.

### Prefilling from the brief

The brief usually arrives as the example story ("We are preparing a presentation for … It is about … From our side, … with … leading. We want to show … The deadline is …"), sometimes with parts the user didn't fill in. Treat any part that is still a [bracketed placeholder] as not answered: ignore it and never read the placeholder text as content ("[date]" is not a deadline, "[name] leading" names no lead). Anything the user wrote in their own words counts as normal brief content.

Read the brief and fill in only what it says or clearly implies:
- `general`: client matched to a KLERQ client name when the brief names one. **Title and about are always filled in by default**, whether or not the brief states them:
  - `title`: the brief's title if it gives one; otherwise a short, client-facing title Claude writes from the client and the topic (e.g. "KLERQ for MLL Legal: putting your experience to work"), max ~60 characters, no internal jargon, no invented facts.
  - `about`: one sentence (max ~200 characters) summarising what the pitch is for, drawn from the brief and the pitched client's KLERQ context (their matters, earlier presentations for them). Keep it factual: never invent amounts, dates or scope the brief doesn't support.
  - Always list `title` and `about` in `aiFields` (plus `client` when you matched it), so both show the "✦ Filled in by Claude" tag until the user edits them, and mention them in `ai.general` (e.g. "Client from your brief; title and summary suggested by Claude.").
- `pricing`: `{"desc": "…"}`, a plain-language description of the pricing the brief asks for (fee structure, amounts or rates, what the table or conditions should show), written the way the user would say it. Only what the brief says; leave `desc` empty if it says nothing about fees. The pricing step is one free-text box: the user describes the pricing they want, and Claude turns it into the chapter after approval.
- Specialists, industries and highlights: set `rec` with a reason that quotes the brief ("Named as lead in your brief"). Texts: `textRecs`, and `textIns` for draft instructions drawn from the brief.
- `ai`: one short note per chapter key you prefilled from the brief (general, chapters, preface, scope, firm, specialists, pricing, practices, industries, highlights, clients) saying what you took from it. The template shows it as a "✦ Filled in by Claude from your brief" banner and a ✦ tag in the overview. Leave a chapter out of `ai` if the brief said nothing about it, even if you recommend something there. Exception: `ai.general` is always present, because title and about are always suggested by Claude.
- `chapters`: which chapters start ticked in the chapter picker. Keys: preface, scope, firm, specialists, pricing, practices, industries, highlights, clients, and the extras team, desc, fspec, fprac, testi, pubs, find. Default to the core chapters that have content; add or drop ones the brief asks for or rules out, and explain that in `ai.chapters`. Omitting `chapters` ticks all core chapters. Industries is greyed out when KLERQ has none.
- `aiDrafts`: a ready-written draft for every ticked text chapter (keys preface, scope, firm, and team / desc when those extras are ticked). The form can't call Claude while the user fills it in, so these are written up front: that is what makes the ✦ AI button show a text instantly. Write each one for this pitch: the client, the brief, and the best-fitting stored text as a starting point; 80–180 words, plain text, blank lines between paragraphs, "• " for bullets; never another client's names or details. Skip a key only if there's truly nothing to base it on; that chapter then falls back to drafting after approval. When you'd recommend drafting a chapter, set its `textRecs` to `["ai", "reason"]` so Claude's draft is preselected.
- `bioDrafts`: a tailored bio for **every** specialist in the form (Claude's version is the default bio for each ticked specialist, and for anyone the user ticks later) (keyed by specialist name, as in `specialists[].n`), based on their best stored bio and adapted to this client and brief; 60–120 words, plain text. The bio box starts on Claude's version; the user can switch to a stored bio in the Bio dropdown or edit the text with the pencil. There is no instructions field for bios: Claude never revises a bio after approval, it uses the version shown (edited or not). `bioPick` is only needed to start a specialist on the stored bio instead (`"stored"`).
- Keep every draft short (`aiDrafts` 80–150 words, `bioDrafts` 60–120): they are written before box 2 appears, so their length adds directly to the loading time.
- `brief`: the user's text verbatim; it's shown on the Back step and turns on the brief step.

## 3. Rendering rules

- **App form mode** needs none of this section: the client renders the page the form server provides. The rules below are for widget form mode only.
- **Fast mode.** If `assets/config.json` has a non-empty `hostedScriptUrl`, render box 2 from `assets/hosted/loader.html` instead of the full template: replace `{{HOSTED_URL}}` with that URL and put the same data JSON between `/*DATA_START*/` and `/*DATA_END*/`. Claude then writes only the data, not ~50 KB of form code, which is by far the biggest speed-up. Without a URL, use `assets/form-template.html` as before. After any template change, run `python scripts/build.py` and republish the hosted script (see `assets/hosted/README.md`).

- Load the widget tool's design guidance first (e.g. `read_me` with the `interactive` module) without mentioning it.
- The form uses the KLERQ palette on a solid dark card: background `#1C2530`, fields `#26303C`, accent yellow `#F4E6A1` for labels and chips, teal `#5FB4BE` for the Continue button, white text. No gradients (they flicker while streaming). The template's CSS uses `!important` and `color-scheme: dark` on purpose: the chat's built-in control styles otherwise override it and make text unreadable.
- Text choices (preface, scope of work, firm, team text, description slide) use a selection menu, not a list of cards. The menu is a white panel with a search field, grouped into "Organisation texts", "From <client> presentations" and "From other presentations" (each with a count; organisation texts also show their status and language), where every option shows its name, tags (Recommended, Edited), source and a two-line preview of the text; "+ Draft a new one" sits at the bottom. Below the menu the selected text shows in a white box in larger type, with its name, source and reason small above it on the dark background. A pencil button in the corner of the white box lets the user edit the text in place (Done, Cancel, Restore original); edited texts get an "Edited" tag. Next to it, a "✦ AI" button instantly swaps in Claude's draft for that chapter from `aiDrafts` (tagged "✦ Written by Claude", editable with the pencil, with a field for changes Claude applies after approval); the dropdown lists the same draft as "✦ Claude's draft". Only when a chapter has no pre-written draft does the button fall back to a panel that asks Claude to write one after approval (optional instructions, optionally based on the shown text). The template does all this; don't replace it with cards or radio lists.
- Specialists: each ticked specialist has a Role and a Bio dropdown (stored bio versions plus "✦ Claude's version", selected by default), and the chosen bio in a white box with a pencil to edit it by hand. Unlike the text chapters, bios have no "Want changes? Tell Claude what to adjust" field.
- Work highlights are built for large databases. Four basic filters are always shown: Work highlight commercial title (text), Companies, Specialists and Status. A "More filters ▾" button expands the rest, matching KLERQ's own filter panel: Matter internal name, Industries, Practices, Offices, Matter status, Start date from/to, End date from/to, Min/Max deal value, Cross border, Confidential, Work highlight labels and Matter label. The button shows how many advanced filters are on while collapsed, and "Clear filters" appears as soon as any filter is set. Then "Recommended" and "Selected" toggles, and each highlight as a white card styled like a KLERQ work highlight: status pill (● Approved / ● Draft), Confidential, version and Recommended pills, a Select tick box, the title in large type and the summary (three lines, "Show more" for the rest) on the left; a grey side panel on the right with Company, Lead specialists and Supporting specialists (initials avatars), Offices, Practices and Industries as chips, and the matter name and dates. Selected cards get a teal border. Cards come 25 at a time, with "Show more" for the next 25. No chips of the current selection on top.
- Clients are shown in a multi-column grid with a filter field.
- The last step is Export: "Do you want to export to PowerPoint?" Yes (fill my template) or No. On Yes it tells the user to attach the template to their next chat message; widgets cannot pass files to Claude.
- Validation shows an inline error on Continue; buttons are never greyed out in advance.
- Render with one or two sentences before it at most, then end the turn.

## 4. The answer messages

Box 1 sends:

```
[Presentation form] Brief
<the user's text>
```

Box 2 sends:

```
[Presentation form] Approve
Title: …
Client: … (adds "(not in KLERQ)" if typed freely)
About: …
Order: General information | Preface | …
Left out: …
Preface: Directory strategy preface (from: Orka legal directory pitch)
Scope of work: Draft a new one (instructions if given)
Specialists: Jorn Vermeulen (lead, bio: English bio [Approved]) | …
Pricing: Claude to write from: <the user's description>
Practices: … | …
Industries: … | …
Work highlights: Title (version 1) [Client] | …
Clients: … | …
Team text / Featured specialist / …: …
```

A line can read "Claude's draft [see below]": the user saw and accepted the draft written into `aiDrafts` (possibly edited in the form); the final text follows between "--- Claude's draft: <chapter> ---" and "--- end ---". Use it as-is, with no further approval, unless the line also says "(changes requested: …)"; then revise it accordingly and show the revision labelled **Draft** in step 3. A draft line can read "Draft a new one based on: <text> (from: <source>) (<instructions>)": write the new text using that stored text (or its edited version, given below the message) as the starting point, adapted to the instructions and the pitched client, and never carry over another client's names or details. If a stored text was edited in the form, its line ends with "[edited, see below]" and the full edited text follows at the end of the message between "--- Edited text: <chapter> ---" and "--- end ---". Use that edited text, not the original.

Pricing: "Claude to write from: <description>" is the user's own description of the pricing they want. After approval, turn it into the pricing chapter: a short intro sentence, the fees laid out as a clear list or table (one line per phase, role or fee item, with currency and amount), and the conditions (VAT, expenses, validity, payment terms) the user mentioned. Use only the amounts, rates and terms the user gave, never invent any; where something needed is missing, write a clearly marked placeholder such as [amount] and say so. Show it labelled **Draft** in step 3 together with the other drafts, and save it once approved.

Bios: "bio: Claude's version [see below]" (optionally "[edited in the form]") with the final text between "--- Claude's bio: <name> ---" and "--- end ---": use it exactly as-is, never revise it. "[edited, see below]" with "--- Edited bio: <name> ---" for a hand-edited stored bio. Only when a specialist had no Claude's version does ", Claude to tailor" or "no bio, Claude to write one" appear; then write it after approval and show it labelled **Draft**. The last line "Export: …" says whether to fill a PowerPoint template (see SKILL.md → PowerPoint export).

Map each name back to its id with your private table. Highlights are identified by title + version + client.

## 5. Creating the record

`presentations_create` with `title`, `language` (default `eng`), `clientId`, `status: "DRAFT"`, and `presentationRequirements` set to the "About" text. Chapters in the approved order, each with `sequence`. General information is always included as sequence 1, even if the answer message somehow lists it under "Left out":

| Chapter | Shape |
|---|---|
| General information | `{type: "general", title}` |
| Preface / Scope of work / Firm / Team text / Pricing | `{type: "description", subType: "preface" \| "scope_of_work" \| "firm" \| "team" \| "pricing", title, content: <Tiptap doc>}` — for organisation texts, link the library text by its id if the chapter schema offers a description reference (as practices and industries do with `descriptionId`), otherwise copy its Tiptap content; for texts from an earlier presentation, copy that chapter's original Tiptap JSON unless the user edited it; for edited texts and drafts, build a Tiptap doc from the plain text (a paragraph per block separated by blank lines, lines starting with "• " as a bulletList); for pricing, build it from the approved pricing draft, with fee lines as a bulletList ("Phase or item: EUR amount") because description chapters take Tiptap text, not table cells, and put the pricing type in the title (e.g. "Pricing: fixed fee") so the export picks the right pricing slide |
| Description slide | `{type: "description", title, content}` |
| Specialists | `{type: "specialists", specialists: [{specialistId, role, sequence, bioContentId}]}`; for a Claude, edited or tailored bio, pass it as inline `bio` (Tiptap) instead of `bioContentId` |
| Practices | `{type: "practices", practices: [{practiceId, sequence}]}` |
| Industries | `{type: "industries", industries: [{industryId, sequence}]}` |
| Work highlights | `{type: "work_highlights", workHighlights: [{workHighlightId, sequence}]}` |
| Clients | `{type: "clients", clientTombstones: [{firmRelationId: <client id>, sequence}]}` |
| Featured specialist / practice / industry | `{type: "featured_specialist" \| "featured_practice" \| "featured_industry", …}` with the matching list |
| Testimonials / Publications | `{type: "testimonials" \| "publications", …}` with the matching list |

Check the response: every chapter should come back with its content or references. Report by title and a one-line summary per chapter.

## 6. Known gaps (as of the last test run)

- No endpoint yet to read or write organisation descriptions (checked September 2026: the connector has none, and `description` chapters take inline `content` only, no description id). The skill checks for it on every run and uses it automatically once it appears; until then there are no library texts and no saving drafts to the library. Drafts live inside the presentation only; say so when showing them.
- No endpoint to create industries or practices yet. Until it exists, offer only what KLERQ has.
- No list endpoints for testimonials or publications were found; the form marks those additional chapters "look up after submit". Try `search` for them after submission, and say so if nothing is reachable.
