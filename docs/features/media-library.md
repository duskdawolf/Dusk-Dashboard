# Media Library

Status: **CURRENT IMPLEMENTATION**. The library stores reusable assets; event
attachments and social-post attachments record how those assets are used.
Alpha v31.2 reuses this library for Series logos and Edition banners/logos; see [Convention Directory](convention-directory.md) for public image selection and privacy.

## Entry points and asset records

`/dashboard/media` renders [MediaLibraryPage](../../src/components/media/MediaLibraryPage.tsx).
[MediaLibraryPicker](../../src/components/media/MediaLibraryPicker.tsx) provides
the reusable sheet used by Case Study Media and Brand imports. The dashboard
supports upload, title/tag search, favorites, copying URLs and deleting assets.
It is not the older [MediaManager](../../src/components/MediaManager.tsx) UI.

`media` is the shared image/video table. Current fields include:

| Fields | Meaning |
| --- | --- |
| `id`, `title`, `kind`, `url` | Identity, human label, image/video classification and object URL |
| `storage_path`, `mime_type` | Storage object path and uploaded MIME type |
| `caption`, `alt_text` | Reusable notes/caption and accessibility text |
| `owner_user_id` | Owning user; null legacy rows are treated as shared |
| `tags`, `favorite`, `source` | Free-form deduplicated tags, preferred assets, source label (upload default) |
| `published` | Public database/list eligibility; **not** private object storage |
| `event_id`, `sort_order` | Legacy single-event association/order still used by older readers |
| `created_at`, `updated_at` | Asset timestamps |

There is no automatic semantic classification, tagging model or convention
edition image catalogue. `kind` is derived from the submitted MIME type; tags
are supplied by the operator and trimmed/deduplicated by the API.

## Upload and ownership behavior

The authenticated [Alpha 9.1 API](../../src/app/api/alpha91/media/route.ts):

- GET returns own or null-owner assets, favorites first/newest second, at most
  250 rows. `kind=image|video` and exact `tag` filters are supported.
- POST accepts nonempty JPEG, PNG, WebP, GIF, MP4, QuickTime or WebM files up to
  50 MiB. Uploads go to `public-media/{userId}/library/{timestamp}-{uuid}.{ext}`.
- New rows have `event_id=null`, `published=true`, `owner_user_id=currentUser`,
  `source=upload`, `favorite=false`. Upload alone does not attach an event.
- PATCH updates title, caption, alt text, tags and favorite, after checking owner.
  The current library page does not expose every PATCH field or a publish toggle.
- DELETE removes the asset record then attempts object cleanup. Foreign-key
  cascades remove attachment joins; failed storage cleanup is logged.
- A failed row insert after upload attempts to remove the newly created object.

These routes use [requireAlpha7Admin](../../src/lib/alpha7/auth.ts) and a server
Supabase secret client. That guard checks a valid session and an optional email
allowlist; an empty `DUSK_ADMIN_EMAILS` allows any authenticated user. Ownerless
records are editable by users admitted through this guard.

## Event, social and brand reuse

[Alpha 9.2 SQL](../../supabase/V26_ALPHA92_UNIFIED_EVENT_LIFECYCLE_RUN_THIS.sql)
introduces `event_media(event_id, media_id, caption_override, sort_order, featured)`
with a unique event/asset pair, backfills legacy `media.event_id` associations,
and enables RLS without a public-client attachment policy.

[Event attachment API](../../src/app/api/alpha92/events/[id]/media/route.ts) checks
event ownership and media ownership. It attaches an existing asset, reorders or
changes its event-specific caption, marks a featured asset, or detaches it.
Detaching leaves the library record and storage object intact. The first
attachment is featured by default; selecting another clears other featured flags.
This is application-enforced, not a unique featured-row database constraint.

After attachment edits, the API ensures a Case Study and updates its `image_url`
from the first attached image in featured/order sequence, without checking the
image's `published` flag. This can create a draft Case Study for a future event.
The [Case Study Media UI](../../src/components/alpha92/CaseStudyMediaManager.tsx)
uses the library picker and the attachment API.

Social Ops uses the separate `post_media` join. [PostManager](../../src/components/PostManager.tsx)
still filters candidates by legacy `media.event_id` when an event is selected;
an `event_media` attachment alone does not synchronize that field. Brand import
[fetches a selected image](../../src/app/api/alpha91/brand-from-media/route.ts) and
passes its bytes to `uploadBrandAsset`, creating a separate brand asset rather
than removing or converting the media row.

The older [admin media API](../../src/app/api/admin/media/route.ts) remains:
it can upload with a legacy event assignment/publish flag, edit those fields,
reorder or set a legacy cover, and delete. Its server queries are not scoped by
media ownership and its upload validation differs from Alpha 9.1's API. Do not
assume every media endpoint implements the same tenant or attachment semantics.

## Public visibility and current limits

[Alpha 9.1 bucket SQL](../../supabase/V26_ALPHA91_MEDIA_TAGS_FIX_RUN_THIS.sql)
explicitly makes `public-media` public with the same 50 MiB/MIME constraints.
Anyone holding an object URL can fetch its bytes. `published=false`, detachment
or owner checks do not make an uploaded object private; do not upload reservation
confirmations, private travel documents or other secrets to this library.

- [Public archive](../../src/lib/repository.ts) filters `media.published=true` but
  still groups/counts through legacy `media.event_id`.
- [Public detail loader](../../src/lib/incident-report.ts) prefers published
  `event_media` assets, falling back to published legacy media when none remain.
- [Public Case Study media API](../../src/app/api/case-studies/[slug]/media/route.ts)
  requires a published Case Study, published parent event and published attachment media.
- A Case Study hero URL may disclose an image independently of gallery filters.

Prerequisites include base `media`, [Ops storage/caption fields](../../supabase/migrations/20260921_ops_media_posts_conprep.sql),
[v26 ownership fields](../../supabase/migrations/20260923_v26_alpha_chaos_ops.sql), [Alpha 9.1 library/tags](../../supabase/V26_ALPHA91_MEDIA_TAGS_FIX_RUN_THIS.sql),
and [Alpha 9.2 joins](../../supabase/V26_ALPHA92_UNIFIED_EVENT_LIFECYCLE_RUN_THIS.sql).
See [public pages](public-deployment-pages.md) for publication boundaries and
[Alpha v31.2 directory specification](../product-specs/alpha-v31.2-convention-directory.md)
for the implemented image fallback requirements. Directory media selections require published images and never alter user-selected event features.
