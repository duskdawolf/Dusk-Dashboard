-- Dusk Industries v18
-- Event-linked Case Studies in Chaos / incident reports.

alter table public.case_studies
  add column if not exists event_id uuid references public.events(id) on delete set null;

create index if not exists case_studies_event_id_idx
  on public.case_studies(event_id);

-- Link existing case studies to events by matching their stable slug.
update public.case_studies cs
set event_id = e.id
from public.events e
where cs.event_id is null
  and cs.slug = e.slug;
