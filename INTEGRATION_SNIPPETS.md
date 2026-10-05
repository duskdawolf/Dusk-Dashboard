# Integration snippets

## Event admin/detail page

```tsx
import { NextStopGeneratorCard } from "@/components/next-stop/NextStopGeneratorCard";

<NextStopGeneratorCard eventId={event.id} />
```

The component fetches its route/generation state from the Alpha 7 API.

## Public event page

```tsx
import { NextStopHero } from "@/components/next-stop/NextStopHero";

<NextStopHero
  imageUrl={event.next_stop_asset_url}
  eventTitle={event.title}
/>
```

## Event editor additions

Add controls for:

```text
route_visible
route_order
event_theme
appearance_mode
find_me_notes
```

Recommended UI:

- Route visible: toggle
- Route order: optional number
- Theme: short free text
- Appearance mode: short free text or select
- Find me notes: textarea

Example:

```text
event_theme:
Rock 'N' Roll Nightmare; Halloween; electric-guitar horror-comedy

appearance_mode:
Fullsuit + panel host + nightlife

find_me_notes:
Hosting Dusk Donk Deployment. Roaming in Dusk fullsuit. Likely at dance/nightlife events.
Do not invent times or rooms unless they exist in the event schedule.
```

## Chaos Copilot hook

No fragile trigger is required. Every time the Next Stop card loads, it recomputes a SHA-256 source fingerprint from:

- current event
- two previous route events
- two next route events
- names/dates/locations
- route visibility/order
- theme
- appearance mode
- find-me notes

If Alpha 6-style event mutation changes any of those fields, the poster automatically reads as **Stale** on the next load.
