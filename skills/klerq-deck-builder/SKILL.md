---
name: klerq-deck-builder
description: Build a new client presentation (pitch) from KLERQ content. Interview the user chapter by chapter with the real records from KLERQ, create the presentation record in KLERQ, then export it to PowerPoint through one of the firm's export templates. Use whenever someone wants to build, pitch, or put together a deck or presentation for a client or prospect from KLERQ content, even if they do not say "skill".
---

# KLERQ deck builder

Builds a pitch out of what the firm already has in KLERQ: matters, work highlights,
specialist bios, client references and the texts from earlier presentations.

Requires the KLERQ MCP server declared in this plugin's `mcp.json`. Tool names are
written here without a client prefix (`find_clients`); your client may expose them
prefixed (`klerq__find_clients`, `mcp__klerq__find_clients`). Match what is in the tool list.

## When to use

"Build a presentation for [client]", "make a pitch for [prospect]", "new KLERQ deck",
"help me pick the content for a pitch".

Not for a presentation that already exists in KLERQ. That is `find_presentations` →
`presentations_get` → `export_presentation`, with no interview.

## Core rules

- **Act, don't ask for permission.** Being triggered is the go-ahead for the whole flow.
  Never ask "shall I load the data?", "shall I create it?" or "shall I export?". The only
  questions the user answers are real content choices. On a failed tool call, retry or work
  around it and say what happened.
- **Never show internal ids.** Ids are plumbing for tool calls. Refer to every record by its
  human name, in chat and on slides. Two records with the same name are told apart by client,
  status or "version 2", never by id.
- **Never ask an empty question.** Query KLERQ first and offer real records. A chapter can
  only reference records that exist, so no free-text "add another" for specialists, practices,
  industries or clients. If KLERQ holds nothing for a chapter, say so and leave it out.
- **Never put another client's text in a pitch.** A text written for, or naming, a different
  client is not offered, recommended or copied. Neutral texts are fine; texts from earlier
  pitches for this same client come first. When drafting, carry over no other client's name,
  matters or figures.
- **Suggest, don't just list.** Pre-select what you would pick, with a one-line reason, ranked
  by the client, what the pitch is about, and earlier answers in the interview.
- **Use KLERQ data as-is, minus archived records.** Leave out archived specialists, matters,
  work highlights and clients. Otherwise do not filter or dedupe drafts, confidential entries,
  placeholders or near-duplicates: show them and let the user decide.
- **General information is mandatory; every other chapter is skippable.** It always needs a
  client and a title and is always the first chapter. Offer "skip" on all the others.
- **Label anything you wrote as Draft** until the user approves it.

## Step 1 — load the data

In one batch, before asking anything:

`find_clients`, `find_specialists`, `find_matters` (or `find_work_highlights`),
`find_presentations`. Then `presentations_get` on a handful of recent presentations to
collect reusable texts (preface, scope of work, firm), and `specialists_get` on the
specialists who may join, for their roles, practices and stored bios.

Keep your own name → id map for the calls that follow. Do not show it.

## Step 2 — the brief

Ask once, in one message: who the pitch is for, what it is about, who is on the team and
who leads, which experience to show, and the deadline. Use the answer to prefill everything
in step 3, and mark anything you inferred as "suggested" so the user can correct it.

## Step 3 — the interview

One chapter per message, with numbered options the user can answer with a number. Say which
option you would pick and why. Order:

1. **General information** — client (must match a client in KLERQ), title, what the pitch is about.
2. **Chapter picker** — which of the chapters below to include.
3. **Preface**, **Scope of work**, **Firm** — for each: stored texts from earlier presentations
   (labelled with the presentation they came from), or a new draft you write.
4. **Specialists** — pick people, then a role (lead or supporting) and a bio for each: a stored
   bio, or one you tailor to this client.
5. **Pricing** — one free-text description of the fee structure; you turn it into the chapter.
6. **Practices** — pre-ticked from the chosen specialists.
7. **Industries**.
8. **Work highlights** — one slide each; show client, status, date and summary so the user can choose.
9. **Clients** — reference list, pre-ticked from the chosen highlights.
10. **Overview** — the chapters in order with what is in each, to approve or amend.

## Step 4 — resolve

Write every new text and the pricing chapter, show them labelled **Draft**, and ask for
approval in one message. A draft the user already accepted needs no second approval.

## Step 5 — create it in KLERQ

`presentations_create` with the title, client, language, status `DRAFT`, the deadline, and the
chapters in the approved order. Chapter shapes are in `references/chapters.md`. Report the
result by title and chapter summary.

## Step 6 — export to PowerPoint

Call `export_presentation` with the presentation and no template to list the firm's export
templates, then again with the chosen template key. Give the user the download link and
mention that it expires. The file is also stored on the presentation in KLERQ.

If the client you are running in can also edit files, and the user wants their own template
filled rather than a firm template, ask them to attach the .pptx and fill it from the approved
chapters: one slide per chapter, one per work highlight, template masters and styling untouched.
