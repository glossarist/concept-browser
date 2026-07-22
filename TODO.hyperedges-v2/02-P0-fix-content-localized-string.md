# 02-P0: content must be a localized string, not plain string

## Invariant I7

"content is a localized string: { "eng": "...", "fra": "..." }. A plain
string at wire level is normalized to { "default": "..." } on load."

## Current state (BUG)

`scripts/generate-data.mjs:697`:
```javascript
out['gl:content'] = he.content;  // plain string
```

`src/composables/use-concept-edges.ts:137`:
```typescript
label: he.content ?? undefined,  // plain string
```

Both treat content as a bare string, violating the localized-string
invariant.

## Fix

1. In generate-data.mjs: normalize `he.content` — if it's a string,
   wrap as `{ default: value }`. If already an object, pass through.
2. In use-concept-edges.ts: extract the localized text from the object
   using the current sphere language or fallback to `default`/`eng`.
3. In PartitiveHyperedgeList.vue: display the localized content.

## Verification
- A hyperedge with `content: "some text"` in YAML produces
  `gl:content: { default: "some text" }` in JSON-LD.
- A hyperedge with `content: { eng: "English", fra: "French" }` passes
  through unchanged.
- The UI displays the correct language version.
