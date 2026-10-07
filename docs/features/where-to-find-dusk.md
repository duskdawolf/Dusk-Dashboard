# Where to Find Dusk

This describes the Alpha v31.1 implementation before Alpha v31.2 work.
[buildWhereToFindDusk](../../src/lib/alpha31/where-to-find-dusk.ts) produces shared
appearance lines for the operational workspace, future public deployment reports,
and Next Stop copy. It reads persisted event/schedule inputs; it does not save a
separate Where to Find record or use AI to invent appearances.

## Stored inputs and schedule editing

The event supplies `suiting_mode` and `find_me_notes`. The builder reads
`deployment_sub_events` by `event_id`, while the workspace summary loads schedule
rows by `con_prep_id`. Records are created with both IDs by the supported helpers.
[The schedule migration](../../supabase/V26_ALPHA9_DEPLOYMENT_TIMELINE_RUN_THIS.sql)
defines exact `starts_at`, optional end/location/room, attendance and suiting modes,
public/Next Stop flags, priority, reminders, ownership, and provenance fields.

[Alpha9SubEventsCard](../../src/components/alpha9/Alpha9SubEventsCard.tsx) edits these
structured inputs through
[the schedule route](../../src/app/api/alpha9/con-preps/[id]/sub-events/route.ts).
[The CRUD helper](../../src/lib/alpha9/sub-events.ts) verifies the prep owner, requires
title/start for creation, scopes changes to the prep, and marks Next Stop stale after
create/update/delete. Reminder timing edits reset `reminder_last_queued_at`.
The schedule table has RLS enabled; this server path uses service-role access.

## Builder selection and line format

The builder's database query excludes `attendance_status=not_going`, orders
`next_stop_priority` descending, then `starts_at` ascending. It keeps rows where
`show_in_find_dusk` or `feature_on_next_stop` is true. Thus `maybe` appearances can
be included; attendance certainty is not added to the generated line.
There is no current-time, expiry, end-time, prep-status, or publication filter here.

Each selected schedule item contains its ID, title, exact start, formatted time,
effective location, role, suiting label, Next Stop flag, and complete text line.
`source` is always `schedule` for these returned items, even for manually entered rows.
The type permits `manual`, but freeform notes are strings rather than schedule items.

The line joins nonempty parts with ` · `:
`<weekday/time> — <title> · @ <room-or-location> · <suiting> · <role>`.
Room takes precedence over location. `hosting` renders Hosting and `performing`
renders Performing; `going`/`maybe` produce no role label.
Suiting labels are Fullsuiting, Partialing, or Not suiting. A schedule `inherit`
mode uses the event's default; other schedule modes override it.
Time formatting uses `en-US`, weekday/hour/minute, and `DUSK_HOME_TIMEZONE`
or `America/New_York`; it does not use each event's venue timezone.
The builder relies on valid timestamps/timezone settings; errors propagate to callers.

## Public and poster arrays

| Output | Selection and order | Limit |
| --- | --- | --- |
| `scheduleItems` | Selected schedule rows with either visibility flag | None |
| `publicLines` | `show_in_find_dusk` schedule lines, then manual-note lines | None |
| `nextStopLines` | Featured schedule lines if any; otherwise public schedule lines; then manual-note lines | First 5 lines |

Priority ordering also applies to public appearances, so public output is not strictly
chronological. A featured-only row can appear in Next Stop while absent from publicLines.
If any featured rows exist, unfeatured public schedule lines are excluded from Next Stop.
Manual-note lines are appended afterward, so a long schedule can consume the five-line cap.

Notes split on newline, bullet `•`, or semicolon, remove carriage returns, trim whitespace,
and remove a leading `-`/`*`. Empty parts are dropped; there is no deduplication.
If either output array is empty, that array receives
`Deployment default: <suiting label>`. This fallback does not assert a location/time.

## Workspace and public consumption

[The workspace card](../../src/components/alpha31/Alpha31WhereToFindDuskCard.tsx)
renders `publicLines` and edits Additional public note through the event resource
of the workspace records endpoint. That update uses the prep's linked event ID.
[The summary route](../../src/app/api/alpha8/con-preps/[id]/summary/route.ts) returns
the whole builder result; its `publicSubEventCount` counts `scheduleItems`, including
Next Stop-only rows, and therefore is not precisely a count of public schedule rows.

[The public deployment report](../../src/app/deployments/[slug]/page.tsx) calls the
builder only for the future/deployment lifecycle. It displays `publicLines` and catches
builder errors, falling back to an empty-details message. The event is first resolved
through [public repository/report loading](../../src/lib/incident-report.ts): database
events and case studies use published filtering, with seed fallback on unavailable/empty
public data. The builder itself uses server credentials and does not enforce publication.
Past report rendering does not display this appearance section.

[Next Stop copy](../../src/lib/next-stop/copy.ts) uses `nextStopLines` as `findMeItems`.
The AI schema does not regenerate those facts; they are attached to the returned copy,
and the AI instruction forbids invented schedule details. Saved posters are artifacts,
so changing a schedule does not itself redraw an existing image.

## Current consistency and verification limits

Normal schedule CRUD marks poster state stale. Chaos `upsert_sub_event` in
[record-actions.ts](../../src/lib/alpha7/record-actions.ts) writes the table directly
without that helper. [The poster source hash](../../src/lib/next-stop/hash.ts) includes
event notes/suiting but not schedule rows; these paths are not equivalent invalidation.
Note edits use generic event updates rather than the schedule stale-marking helper.
Code inspection establishes these paths, not live visibility, schema deployment,
authentication, timezone behavior, or poster refresh against an actual project.
