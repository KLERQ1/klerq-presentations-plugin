# Chapter shapes for `presentations_create`

Read this before building the payload in step 5.

## Top level

```json
{
  "title": "KLERQ for Van Doorne: faster pitches and submissions",
  "clientId": "<id of the client record>",
  "language": "eng",
  "status": "DRAFT",
  "deadline": "2026-09-28T00:00:00.000Z",
  "presentationRequirements": "one line on what the pitch is about",
  "chapters": [ ... ]
}
```

`language` is an ISO 639-2 three-letter code: `eng`, `nld`, `deu`, `fra`.

## Chapters

Every chapter has a `type`, a `sequence` (1, 2, 3 …) and usually a `title`. Types:
`general`, `description`, `specialists`, `practices`, `industries`, `work_highlights`,
`clients`, `testimonials`, `publications`, `featured_specialist`, `featured_practice`,
`featured_industry`, `contact`, `image`, `title`.

**General information** — always first, becomes the title slide:

```json
{ "type": "general", "sequence": 1, "title": "<presentation title>" }
```

**Preface / scope of work / firm / any text chapter** — `description` with a `subType`
(`preface`, `scope_of_work`, `firm`) and the text as an inline Tiptap document:

```json
{
  "type": "description", "sequence": 2, "subType": "preface", "title": "Preface",
  "content": { "type": "doc", "content": [
    { "type": "paragraph", "content": [ { "type": "text", "text": "First paragraph." } ] },
    { "type": "paragraph", "content": [ { "type": "text", "text": "Second paragraph." } ] }
  ] }
}
```

Bold is a mark on the text node: `{"type":"text","text":"Label","marks":[{"type":"bold"}]}`.
Bullets are a `bulletList` of `listItem` → `paragraph`.

**Specialists** — role is `lead` or `supporting`; `bio` is a Tiptap doc, and is what makes the
bio specific to this pitch. Omit `bio` to fall back to the stored one:

```json
{
  "type": "specialists", "sequence": 5, "title": "Specialists",
  "specialists": [
    { "specialistId": "<id>", "role": "lead", "sequence": 0, "bio": { "type": "doc", "content": [ ... ] } }
  ]
}
```

**Practices / industries** — reference rows, each with an optional `description` Tiptap doc:

```json
{ "type": "practices", "sequence": 6, "title": "Practices",
  "practices": [ { "practiceId": "<id>", "sequence": 0 } ] }
```

**Work highlights** — one slide each, in the order given:

```json
{ "type": "work_highlights", "sequence": 7, "title": "Work highlights",
  "workHighlights": [ { "workHighlightId": "<id>", "sequence": 0 } ] }
```

Optional per row: `viewAsTombstone`, `showClientLogo`, `showIndustries`, `showPractices`.

**Clients** — the reference list; the ids are firm-relation (client) ids:

```json
{ "type": "clients", "sequence": 8, "title": "Clients",
  "clientTombstones": [ { "firmRelationId": "<id>", "sequence": 0 } ] }
```

## Updating

`presentations_update` takes the same shape. A chapter sent with its `id` is updated; one
without an `id` is created. Send only what changes.

## Export

`export_presentation` with just the presentation lists the firm's export templates. Call it
again with `template` set to a template key (for example `default_pptx`) to get a download
link, valid for about 15 minutes. The rendered file is also stored on the presentation.
