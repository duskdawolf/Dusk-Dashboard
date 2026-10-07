-- Alpha v31 — run AFTER the v31 application has deployed successfully.
--
-- This replaces the Make "Social Dispatch" polling schedule.
-- It calls one unified Dusk automation endpoint every 5 minutes.
--
-- BEFORE RUNNING:
-- 1) Replace YOUR_MAKE_WEBHOOK_SECRET below with the SAME value already in
--    Vercel as MAKE_WEBHOOK_SECRET.
-- 2) Keep the production URL unless you intentionally deploy elsewhere.
--
-- The secret is stored in Supabase Vault, not in the cron command itself.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select vault.create_secret(
  'https://duskdawolf.com',
  'dusk_alpha31_base_url',
  'Dusk Alpha v31 automation base URL'
)
where not exists (
  select 1
  from vault.decrypted_secrets
  where name = 'dusk_alpha31_base_url'
);

select vault.create_secret(
  'YOUR_MAKE_WEBHOOK_SECRET',
  'dusk_alpha31_automation_secret',
  'Bearer secret for Dusk Alpha v31 automation tick'
)
where not exists (
  select 1
  from vault.decrypted_secrets
  where name = 'dusk_alpha31_automation_secret'
);

select cron.unschedule(jobid)
from cron.job
where jobname = 'dusk-alpha31-automation-tick';

select cron.schedule(
  'dusk-alpha31-automation-tick',
  '*/5 * * * *',
  $cron$
    select net.http_post(
      url := (
        select decrypted_secret || '/api/integrations/automation/tick'
        from vault.decrypted_secrets
        where name = 'dusk_alpha31_base_url'
        limit 1
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization',
        'Bearer ' || (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'dusk_alpha31_automation_secret'
          limit 1
        )
      ),
      body := jsonb_build_object(
        'source', 'supabase_cron',
        'requested_at', now()
      )
    );
  $cron$
);
