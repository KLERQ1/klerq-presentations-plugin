---
name: klerq-deck-builder
description: Build a presentation from scratch from KLERQ content, create it in KLERQ, then apply it to the open PowerPoint template. In Claude.ai the interview is an interactive KLERQ-branded form rendered inline in the chat, starting with a brief box that appears instantly while KLERQ data loads, then one box with a step per chapter, prefilled from the brief and marked as filled in by Claude, ending with an overview to approve; in PowerPoint it uses tappable questions. Use whenever the user wants to build, pitch, or put together a new deck or presentation from KLERQ content, even if they don't say "skill" or "form".
---

## When to use

The user wants to build a new presentation (pitch) from KLERQ content. Trigger phrases: "build a presentation", "make a pitch for [client]", "help me select the content for a presentation", "new KLERQ deck", "put a deck together for [prospect]".

Not for exporting a presentation that already exists in KLERQ — that's a straight `presentations_get` → slide build, no interview needed.

Requires the KLERQ MCP server declared in this plugin (`.mcp.json` for Claude, `mcp.json` for
other clients). Tool names are written here without a client prefix (`find_clients`); your
client may expose them prefixed (`klerq__find_clients`, `mcp__klerq__find_clients`). Match
what is in your tool list.


## Four modes: pick one at the start

- **App form mode (Claude.ai, ChatGPT, VS Code Copilot, Microsoft 365 Copilot, Cursor and any other MCP Apps host).** The tools `presentation_brief` and `presentation_form` are in your tool list (from the KLERQ form server, possibly prefixed). They render the same two boxes inline: call `presentation_brief` first (box 1), then `presentation_form` with the data JSON as its `data` argument (box 2). You never write HTML in this mode. Read `references/form-mode.md` first; section 0 covers the calls.
- **Widget form mode (Claude.ai without the form server).** An inline HTML widget tool is available (e.g. the Visualizer's `show_widget`, which exposes `sendPrompt()`) but the form tools are not. The interview runs in the same **two boxes**: box 1 is the brief (shown instantly), box 2 holds every chapter from General information on, prefilled from the brief, as steps with Continue inside the same box, ending with the overview. Build it from `assets/form-template.html` — read `references/form-mode.md` first.
- **Question mode (Claude in PowerPoint, or any client with a tappable-question tool).** HTML cannot be rendered. Ask each chapter with the tappable-question tool, one chapter per turn, offering the same options the form would show.
- **Plain chat mode (every other client: ChatGPT, Codex, GitHub Copilot, Cursor, Kiro, VS Code, or any model without a widget or question tool).** Ask each chapter as a plain text message with numbered options the user can answer with a number. Same chapters, same order, same recommendations as the form. Start with one message asking for the brief (client, what it is about, team and lead, experience to show, deadline), prefill everything from it and mark what you inferred as "suggested".

Decide by looking at your tool list, not by guessing the client, in this order: the `presentation_form` tool means app form mode; else an inline HTML widget tool means widget form mode; else a tappable-question tool means question mode; else plain chat mode. Never try to render HTML or call a tool that is not in your list. If a form tool answers that this client cannot show the form, switch to plain chat mode for the rest of the run.

In form mode there is usually no PowerPoint template open: do steps 1–4 in the chat, then hand off for step 5.

## Goal

A presentation record created in KLERQ with its chapters populated, and the PowerPoint template filled with slides matching those chapters.

## Core rules

These apply to every step and to both modes.

- **Don't ask for permission, just act.** Triggering the skill is the go-ahead for the whole flow. Never ask "shall I fetch the data?", "may I look up…?", "do you want me to render the form?", "shall I create it in KLERQ?" or "shall I build the slides?". Start gathering KLERQ data immediately, render the form as soon as the data is in, and after approval create the record without confirming. The only questions the user sees are real content choices (the form itself, and in step 3 the drafts and look-ups). If a tool call fails, retry or work around it and report what happened; don't stop to ask whether to continue.

- **Never show internal IDs.** Record ids are plumbing. Never put them in chat, in options, in the form (including its data block), in the text the form sends back, or on a slide. Refer to everything by human name. Keep the name → id mapping in your own working notes to make the API calls. When two records share a name, tell them apart with a visible label ("version 1", client, status), not an id.
- **Never ask an empty question.** Query KLERQ first and present real options. Only offer choices KLERQ can store: no free-text "add another" for practices, industries, clients or specialists, because a KLERQ chapter can only reference records that exist. If KLERQ has nothing for a chapter, say so and leave the chapter out. (When KLERQ gets endpoints for creating industries, practices or organisation texts, offer "add a new one" and create it in KLERQ first.)
- **Never put another client's text in a pitch.** A text written for, or naming, a different client must not be offered, recommended or copied into this presentation. Neutral texts from other pitches are fine; texts from earlier pitches for the same client come first. When drafting, never carry over another client's name, matters or specifics. The form enforces this live from the selected client, using the `c`/`cs` tags you set per text (see `references/form-mode.md` → Data gathering).
- **Offer organisation texts and earlier-presentation texts together.** Every text dropdown combines two sources: the organisation texts from KLERQ's description library (Company Bio, Team, Pricing and so on) and texts from earlier presentations. Organisation texts are the curated library, so they come first in the dropdown and are preferred in recommendations when they fit. At the start of every run, check whether the KLERQ connector can read organisation texts (`references/form-mode.md` → Data gathering); if it can, load all of them. Until that endpoint exists, show only the texts from earlier presentations, label each with the presentation it came from ("From: Meet KLERQ"), and never call them library texts. Apart from the client rule, show every eligible text from both sources.
- **Suggest, don't just list.** Pre-select what you'd pick and give a one-line reason. Rank by the client, the "what is it about" answer, and earlier choices.
- **Use KLERQ data as-is, minus archived records.** Never load or show archived specialists, archived matters or their work highlights, or archived clients: they are left out of the form, the recommendations and the record. Apart from that and the client rule above, don't filter or dedupe placeholder, Lorem ipsum, draft, confidential or duplicate entries — show them all; the user decides.
- **General information is mandatory; every other chapter is skippable.** Never offer a skip, leave-out or reorder option for General information, in either mode: it always needs a client and a title, is always the first chapter of the KLERQ record, and always becomes the title slide. For all other chapters, skip means no slides and no chapter in the KLERQ record.
- **Mark invented content clearly.** Anything Claude writes is labelled **Draft** wherever it's shown, until the user approves it.

## Steps

### 1–2. Load fast and run the interview (both form modes: two boxes)

Start right away, with no announcement or confirmation question. In the form modes the interview is split so the user can write while the data loads:

1. **Box 1, the brief, immediately.** Call `presentation_brief` (app form mode) or render `assets/brief-box.html` (widget form mode) before any KLERQ call: one textbox asking what the presentation is for, prefilled with a short example story whose parts in [brackets] the user replaces (client, what the presentation is about, team and lead, experience to show, deadline). Render it as-is; don't change the example. At most one short sentence before it.
2. **Load everything in the same turn.** Right after box 1 renders, gather all KLERQ data (`references/form-mode.md` → Data gathering). Put every call of a batch in **one tool-call block**; never issue them one per message. When done, end the turn with one line, e.g. "The chapters are ready as soon as you continue."
3. **Box 2, on `[Presentation form] Brief`.** Read the brief and prefill everything it supports (`references/form-mode.md` → Prefilling from the brief): client, a suggested title and about (always, see below), pricing, specialists and their roles, practices, industries, highlights, text choices and draft instructions. Fetch the pitched client's own presentations if they weren't loaded. Also write `aiDrafts` (one ready draft per ticked text chapter) and `bioDrafts` (a tailored bio for every specialist in the form, since Claude's version is the default bio), so the ✦ AI buttons show Claude's text instantly. In app form mode, call `presentation_form` with all of this as the `data` argument (`"phase": "rest"`). In widget form mode, render box 2 in fast mode if `assets/config.json` has a `hostedScriptUrl` (see `references/form-mode.md` → Rendering rules), otherwise the full template, with `"phase": "rest"`. Either way it opens at General information, and Back shows the brief.

If the Brief message arrives before loading has finished, finish loading first, then render box 2. If the user says they pressed Continue but nothing arrived, ask them to press "Try sending again" or paste the copy-box text.

**Mark what Claude filled in.** Everything prefilled from the brief carries a "✦ Filled in by Claude" marker: a banner at the top of each chapter saying what was taken from the brief, a tag on each prefilled general field (removed as soon as the user edits it), and a ✦ tag on those chapters in the overview. Only prefill what the brief actually says or clearly implies; never invent amounts, names or facts. The one exception is the presentation title and the "What is this pitch about?" field: Claude always suggests both by default, even when the brief doesn't state them (see `references/form-mode.md` → Prefilling from the brief), and marks them ✦ so the user can see and change them. Normal ranking without a basis in the brief stays "Recommended", not ✦.

Chapters, in order: brief → general information → **chapter picker** (two columns of tick boxes with only the chapter names: main chapters on the left, extra chapters on the right; General information always included; only ticked chapters are walked through afterwards) → preface → scope of work → firm → specialists (tick, then role + bio each) → pricing (one free-text box describing the pricing wanted) → practices (pre-ticked from chosen specialists) → industries → work highlights → clients (pre-ticked from chosen highlights) → setup for ticked extra chapters (team text, description slide, featured specialist/practice, testimonials, publications, featured industry) → overview → **export** (last question: "Do you want to export to PowerPoint?", with an upload hint for the template).

Box 2 sends one `[Presentation form] Approve` message, also shown in a copy box because sending can silently fail; handle a missing message the same way. Re-render only as a last resort, and warn that choices will be lost.

**Question mode:** one chapter per turn with tappable questions, then an overview in chat text. Start with General information and don't add a "Skip" option to it; add one to every other chapter. In General information, offer Claude's suggested title and about as the first, pre-selected option (labelled ✦ Suggested by Claude), with an option to type their own.

**Plain chat mode:** the same as question mode, but every chapter is a normal message with numbered options; the user answers with numbers or free text. Say which option you would pick and why. Never ask an empty question: load the KLERQ data first and list real records. Close with the overview in text and ask for one approval.

### 3. Resolve what the form couldn't do

After the answers arrive, in one turn:
- Write the pricing chapter from the user's pricing description (`references/form-mode.md` → The answer messages) and show it labelled **Draft**.
- Write every "draft a new one" text (including fallback ✦ AI requests, which may name a stored text to start from) and show it labelled **Draft**. A "Claude's draft" the user already accepted in the form needs no second approval, unless they asked for changes; then show the revised version labelled **Draft**.
- Look up content for additional chapters marked "look up after submit" (testimonials, publications, featured industry) and offer options.
- Flag anything that can't be stored in KLERQ.

Ask for approval of drafts and these choices together (tappable questions, max three). If there's nothing to resolve, go straight to step 4.

### 4. Create the presentation in KLERQ

Once drafts are approved, **create it without asking again** — approving the form is the go-ahead. Build the chapters per `references/form-mode.md` → Creating the record; `references/chapters.md` has the exact payload shapes for `presentations_create`. Report the result by title and chapter summary, never by id.

### PowerPoint export

Ask once whether the user wants a PowerPoint. Pick the path that your client supports:

- **KLERQ export (works in every client).** Call `export_presentation` with the presentation and no template to list the firm's export templates, then again with the chosen template key. Give the user the download link and mention that it expires. The file is also stored on the presentation in KLERQ. This is the default outside Claude.ai and Claude for PowerPoint.
- **Fill the user's own template (Claude.ai, or any client that can run code and edit files).** The user attaches their template (.pptx or .potx) to the same or the next message; the form itself can't send files. Once the record is created and the template is there, fill it with the approved content using the layout table in step 5 (one slide per chapter, one per work highlight; keep the template's masters and styling untouched), save it as `<title>.pptx` and present it. In Claude.ai, read `/mnt/skills/public/pptx/SKILL.md` first and save to `/mnt/user-data/outputs/`. If no template arrived yet, ask for it in one line.

If the answers say "Export: none", stop after step 4.

### Handoff (Claude in PowerPoint)

Alternatively, when the user works in Claude for PowerPoint, tell the user the presentation is in KLERQ under its title, and that to build the slides they open their template in Claude for PowerPoint and ask Claude to build the slides for that presentation by title. That run skips the interview and goes straight to steps 5–6.

### 5. Build the slides in the open template

Use the template already open — never restyle it, never touch the master. Map chapter types to layouts consistently:

| Chapter | Layout family |
|---|---|
| General information / title | Title Slide |
| Preface, scope of work, firm, description slide | Intro slides |
| Specialists | Team, option 1–4 |
| Team text | Intro slides |
| Pricing | Pricing slides option 1–3 |
| Practices, industries | Slide with List |
| Work highlights | Experience slides (one per highlight) |
| Clients | Slide with List and Photo |
| Testimonials | Feedback slide |
| Publications | Slide with List |
| Featured specialist / practice / industry | Slide with Text and Photo |

Fill placeholders with the selected KLERQ content verbatim. One slide per tool call so progress is visible. Keep the same layout for repeated chapters of the same type.

### 6. Verify

In Claude for PowerPoint, run `verify_slides` across the new slides and `verify_slide_visual` on each one. Elsewhere, re-open the file and check every placeholder is filled and nothing overflows. Fix overflows by trimming or resizing — never by dropping KLERQ content.
