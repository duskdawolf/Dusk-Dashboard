# Dusk Induskries v26 Alpha 7 — Next Stop Generator

Alpha 7 turns the event database into a branded social asset generator.

For any event, Dusk Induskries can build:

```text
past event #2
      ↓
past event #1
      ↓
CURRENT EVENT
      ↓
next event #1
      ↓
next event #2
```

The output is a mobile-first **1152x2048 9:16 WebP**.

## Architecture

```text
event data
    ↓
OpenAI structured copy
    ↓
OpenAI themed background artwork
    ↓
Dusk Induskries SVG typography + paw route
    ↓
Sharp compositor
    ↓
Supabase Storage
```

The image model is told to generate **no readable text**. The application itself renders the factual text exactly, which avoids malformed AI typography.

## 1. Install dependency

```bash
npm install sharp
```

If needed:

```bash
npm install openai @supabase/supabase-js @supabase/ssr
```

## 2. Run migration

Run the entire file:

```text
supabase/migrations/20261001_v26_alpha7_next_stop_generator.sql
```

It adds route/generator fields, asset history, and the public `next-stop-assets` storage bucket.

## 3. Vercel variables

Keep the existing v26 variables. Optional Alpha 7 tuning:

```text
OPENAI_NEXT_STOP_COPY_MODEL=
OPENAI_NEXT_STOP_IMAGE_MODEL=gpt-image-2.5-flare
OPENAI_NEXT_STOP_IMAGE_QUALITY=medium
```

If the copy-model variable is blank, the feature reuses `OPENAI_COPILOT_MODEL`.

## 4. Add admin card

```tsx
<NextStopGeneratorCard eventId={event.id} />
```

See `INTEGRATION_SNIPPETS.md`.

## 5. Add route metadata to events

Example:

```text
route_visible = true
route_order = 40
event_theme = "Rock 'N' Roll Nightmare / Halloween"
appearance_mode = "fullsuit + panel host + nightlife"
find_me_notes = "Dusk Donk Deployment; roaming in Dusk; dance events; photo ops"
```

`route_order` is optional.

Ordering behavior:
- if every visible route event has `route_order`, it is authoritative;
- otherwise the system falls back to chronological event date.

## 6. Generator actions

**Generate Next Stop Card** creates fresh copy + fresh AI background + deterministic poster overlay.

**Regenerate Art Only** reuses approved copy and produces a new visual treatment.

**Rewrite Poster Copy** regenerates only the short branded copy and marks the poster stale.

## 7. Stale detection

The system hashes the meaningful route state. If the current event or any of its visible neighboring route events changes, the dashboard reports **Stale**.

This is fingerprint-based rather than trigger-based, so updates made by Chaos Copilot are detected without coupling this feature to one mutation path.

## 8. Image settings

Defaults:

```text
model: gpt-image-2.5-flare
size: 1152x2048
quality: medium
format: webp
```

Set `OPENAI_NEXT_STOP_IMAGE_MODEL=gpt-image-2.5-sunburst` if you want the more capable art model.

## 9. Acceptance test

1. Run the migration.
2. Add `sharp` if needed.
3. Deploy.
4. Open an event.
5. Set route/theme/find-me metadata.
6. Confirm the correct previous/current/future sequence in the card.
7. Generate.
8. Confirm the WebP appears in Supabase Storage and the dashboard preview.
9. Change `find_me_notes`, date, or route order.
10. Reload the card and confirm status becomes **Stale**.
11. Regenerate.

## Merge note

The exact Alpha 6 archive was not available in the accessible project files, so this bundle is intentionally modular and does not overwrite your current source tree. Copy these files into the current repo and add the component hooks from `INTEGRATION_SNIPPETS.md`.

The bundle follows the v26 patterns already established in Dusk Induskries: server-side OpenAI, `DUSK_ADMIN_EMAILS`, Supabase service-role writes, public generated assets, and user-scoped event ownership.
