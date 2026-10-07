# Next Stop image generation

Status: **CURRENT IMPLEMENTATION**. The active renderer was introduced in Alpha v30;
Alpha v31 also supplies its shared Where to Find Dusk data. These are code and SQL
contracts, not evidence that the corresponding migrations or paid APIs are configured
in any deployed environment.

## Entry points and scope

Deployment Ops renders [Alpha8NextStopCard](../../src/components/alpha8/Alpha8NextStopCard.tsx)
inside [Alpha8ConventionWorkspace](../../src/components/alpha8/Alpha8ConventionWorkspace.tsx).
The [con-prep layout](../../src/app/dashboard/con-prep/layout.tsx) renders this workspace
instead of its route children. Older Next Stop cards remain in the repository.

The [event API](../../src/app/api/events/[id]/next-stop/route.ts) serves state with GET
and generation/settings actions with POST. All actions run synchronously in the
request; there is no separate image-generation queue in this path.

| POST action | Implemented behavior |
| --- | --- |
| `update_settings` | Store `allowAiWording`; mark poster stale and reset validation. |
| `generate_copy` | Regenerate copy and shared find-Dusk lines; mark poster stale. |
| `generate_background` | Generate/save reusable background; mark final poster stale. |
| `generate_card_from_background`, `regenerate_image` | Render from saved background; fail with 400 if none exists. |
| `refresh_all` | Create a new background, then a final poster; reuse saved copy if present. |
| Default / `generate` | Reuse saved background, or create one first; then render final poster. |

The current card exposes background generation, final rebuild, wording toggle, previews,
validation feedback, and [download](../../src/app/api/events/[id]/next-stop/download/route.ts).
Generating an image does not create a Social Ops post or publish to any provider.

## Current render pipeline

1. [Route context](../../src/lib/next-stop/route-context.ts) selects route-visible events,
   ordered by `route_order` only when every selected row has one; otherwise by date/name.
   It includes up to two previous and two next stops. An explicitly requested hidden
   current event is inserted into the context. `published` is not a route filter.
2. [Copy generation](../../src/lib/next-stop/copy.ts) calls OpenAI Responses with a strict
   JSON schema and `store: false`. Event name/location/dates and `findMeItems` are assigned
   by application code. Find-me facts come from the shared
   [Where to Find Dusk builder](../../src/lib/alpha31/where-to-find-dusk.ts), not AI invention.
3. [Background generation](../../src/lib/next-stop/generate.ts) loads the requesting user's
   [brand settings/assets](../../src/lib/alpha71/brand-assets.ts). When enabled, selected
   primary mascot, secondary mascot, and logo are sent together to `images.edit`.
   Without selected references it uses `images.generate`. The background prompt requests
   reusable artwork without readable event text.
4. The final `images.edit` receives **only the saved background** and the app-built
   [poster text/fact ledger](../../src/lib/next-stop/poster-content.ts). It renders the entire
   finished layout and typography. Brand files are not resent in this step.
5. [Vision validation](../../src/lib/next-stop/validate.ts) checks visible text/facts through
   Responses, with a strict JSON result and `store: false`. One failed/error validation
   triggers one corrective render and a second validation. The second image is retained
   even if that validation fails; the UI asks the operator to review it.

[Prompts](../../src/lib/next-stop/prompt.ts) set `1152x2048` portrait output. Images are WebP,
with compression 90 for backgrounds and 92 for posters. Strict wording is the default;
creative mode may restyle/rewrite wording while retaining every fact. Both modes include
`@duskdawolf`. Dates use `America/New_York` in [format.ts](../../src/lib/next-stop/format.ts);
find-Dusk times use `DUSK_HOME_TIMEZONE` or `America/New_York`.

## Configuration and persistence

`OPENAI_API_KEY` is server-only. [Model selection](../../src/lib/next-stop/openai.ts) uses the
following literal defaults; model availability and account access must be checked at runtime.

| Purpose | Environment override / fallback | Default |
| --- | --- | --- |
| Copy | `OPENAI_NEXT_STOP_COPY_MODEL` → `OPENAI_COPILOT_MODEL` | `gpt-5.6-luna` |
| Background | `OPENAI_NEXT_STOP_BACKGROUND_MODEL` → `OPENAI_NEXT_STOP_IMAGE_MODEL` | `gpt-image-2.5-flare` |
| Final poster | `OPENAI_NEXT_STOP_FINAL_MODEL` | `gpt-image-2.5-sunburst` |
| Validation | `OPENAI_NEXT_STOP_VALIDATION_MODEL` → `OPENAI_COPILOT_VISION_MODEL` → `OPENAI_COPILOT_MODEL` | `gpt-5.6-luna` |
| Image quality | `OPENAI_NEXT_STOP_IMAGE_QUALITY` (`low`, `medium`, `high`, `auto`) | `high` |

[Persistence](../../src/lib/next-stop/persist.ts) inserts each background/poster into
`event_generated_assets`, recording its URL/path, copy, prompt, model, size, and metadata.
Poster history includes source hash, wording mode, and validation. Event columns hold
the current background, poster, copy, prompts, text payload, timestamps, and validation.
Uploads use unique event-scoped paths in public `next-stop-assets`, no overwrite, and
one-year Storage cache headers. History inserts and event updates are separate operations.

[State](../../src/lib/next-stop/state.ts) computes staleness from the
[source hash](../../src/lib/next-stop/hash.ts) or a newer saved background. The hash includes
route-event identity, dates, location, theme, find-me notes, appearance/suiting, visibility,
order, and the renderer revision string. Status values are `not_generated`, `generating`,
`generated`, `stale`, `failed`; validation is separate (`not_run`, `passed`, `failed`, `error`).

Required schema history: [Alpha 7 foundation](../../supabase/migrations/20261001_v26_alpha7_next_stop_generator.sql),
[Alpha 7.1 brand assets](../../supabase/V26_ALPHA71_BRAND_ASSETS_RUN_THIS.sql),
[Alpha 7.2 backgrounds](../../supabase/V26_ALPHA72_BACKGROUND_REUSE_RUN_THIS.sql), and
[Alpha v30 render fields](../../supabase/ALPHA_V30_NEXT_STOP_AI_RENDER_RUN_THIS.sql).
The v30 SQL explicitly marks existing posters stale for regeneration.

## Boundaries, legacy code, and gaps

- [Authorization](../../src/lib/alpha7/auth.ts) checks Supabase cookie identity and
  `DUSK_ADMIN_EMAILS` when nonempty; an empty list accepts any signed-in user with email.
  Reads/writes then use the [secret/service-role client](../../src/lib/alpha7/supabase-admin.ts).
  The event endpoints do not enforce current-event ownership; neighboring-route ownership
  filtering derives from the event owner, and an ownerless current event has no owner filter.
- Brand originals are private in `dusk-brand-assets`; generated backgrounds/posters are
  public by bucket design. Keep private lodging/travel/confirmation facts out of poster copy.
- Failed validation does **not** block persistence, download, or public Storage access.
  Model QA is advisory and should not be described as guaranteed exact typography.
- The source hash does not include sub-event rows, saved copy, wording mode, or brand/model
  settings. Copy/settings actions explicitly mark stale, but sub-event edits alone are not
  detected. Normal renders, including `refresh_all`, reuse saved `findMeItems`; regenerate
  copy when those facts change. No automatic refresh/publication is provided here.
- [compose.tsx](../../src/lib/next-stop/compose.tsx) retains the historical Sharp +
  `ImageResponse` text/mascot/logo composition path. The current generator does not call it;
  its placement/scale controls do not drive the v30 final image-edit layout.
- [v30 verification](../../scripts/verify-alpha-v30.mjs) is a historical source-presence check
  with a v30-specific version assertion, not an end-to-end generation test. Paid generation
  or Storage writes require explicit operational intent and usable secrets.
