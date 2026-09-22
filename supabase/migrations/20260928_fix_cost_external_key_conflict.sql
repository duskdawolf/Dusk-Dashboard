-- Dusk Industries v19
-- Repair the cost_entries external_key index so ON CONFLICT(external_key)
-- can infer a unique index.

drop index if exists public.cost_entries_external_key_unique;

create unique index cost_entries_external_key_unique
  on public.cost_entries(external_key);
